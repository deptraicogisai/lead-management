import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureSellerLeadReferencesMigrated, SellerLeadModel } from "@/lib/models/seller-lead";

type RedirectResolution =
  | { ok: true; targetUrl: string }
  | { ok: false; status: number; message: string };

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

export async function resolvePublisherRedirect(leadId: string): Promise<RedirectResolution> {
  const objectId = normalizeRedirectLeadObjectId(leadId);
  if (!objectId) {
    return { ok: false, status: 400, message: "Invalid lead id." };
  }

  await connectToDatabase();
  await ensureSellerLeadReferencesMigrated();

  const lead = await SellerLeadModel.findById(objectId)
    .select({ publisherStatus: 1, redirectUrl: 1, redirectConfirmedAt: 1 })
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
    await SellerLeadModel.updateOne(
      { _id: objectId },
      { $set: { redirectConfirmedAt: new Date() } }
    );
  }

  return { ok: true, targetUrl: buyerRedirectUrl };
}
