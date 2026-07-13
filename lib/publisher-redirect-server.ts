import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureSellerLeadReferencesMigrated, SellerLeadModel } from "@/lib/models/seller-lead";

type RedirectResolution =
  | { ok: true; targetUrl: string }
  | { ok: false; status: number; message: string };

export type RedirectClickMeta = {
  clientIp?: string;
  referrer?: string;
  userAgent?: string;
};

function normalizeRedirectLeadObjectId(leadId: string) {
  const trimmed = leadId.trim();
  if (!trimmed) return null;

  if (Types.ObjectId.isValid(trimmed) && trimmed.length === 24) {
    return new Types.ObjectId(trimmed);
  }

  const withoutPrefix = trimmed.replace(/^W_/i, "");
  if (Types.ObjectId.isValid(withoutPrefix) && withoutPrefix.length === 24) {
    return new Types.ObjectId(withoutPrefix);
  }

  return null;
}

export function readRedirectClientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;

  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const cfIp = req.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;

  return "";
}

export function readRedirectClickMeta(req: Request): RedirectClickMeta {
  return {
    clientIp: readRedirectClientIp(req),
    referrer: req.headers.get("referer")?.trim() || req.headers.get("referrer")?.trim() || "",
    userAgent: req.headers.get("user-agent")?.trim() || "",
  };
}

export async function resolvePublisherRedirect(
  leadId: string,
  clickMeta?: RedirectClickMeta
): Promise<RedirectResolution> {
  const objectId = normalizeRedirectLeadObjectId(leadId);
  if (!objectId) {
    return { ok: false, status: 400, message: "Invalid lead id." };
  }

  await connectToDatabase();
  await ensureSellerLeadReferencesMigrated();

  const lead = await SellerLeadModel.findById(objectId)
    .select({
      publisherStatus: 1,
      redirectUrl: 1,
      redirectConfirmedAt: 1,
      redirectClientIp: 1,
      redirectReferrer: 1,
      redirectClickUserAgent: 1,
    })
    .lean();

  if (!lead) {
    return { ok: false, status: 404, message: "Lead not found." };
  }

  if (lead.publisherStatus !== "Sold") {
    return { ok: false, status: 409, message: "Lead is not eligible for redirect." };
  }

  const buyerRedirectUrl = typeof lead.redirectUrl === "string" ? lead.redirectUrl.trim() : "";
  if (!buyerRedirectUrl) {
    return { ok: false, status: 409, message: "No buyer redirect URL is available for this lead." };
  }

  if (!lead.redirectConfirmedAt) {
    const update: Record<string, unknown> = {
      redirectConfirmedAt: new Date(),
    };
    const clientIp = clickMeta?.clientIp?.trim();
    const referrer = clickMeta?.referrer?.trim();
    const userAgent = clickMeta?.userAgent?.trim();
    if (clientIp) update.redirectClientIp = clientIp;
    if (referrer) update.redirectReferrer = referrer;
    if (userAgent) update.redirectClickUserAgent = userAgent;

    await SellerLeadModel.updateOne({ _id: objectId }, { $set: update });
  }

  return { ok: true, targetUrl: buyerRedirectUrl };
}
