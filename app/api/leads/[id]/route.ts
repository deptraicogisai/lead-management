import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import { ensureSellerCollectionMigrated, SellerModel } from "@/lib/models/seller";
import { ensureSellerLeadReferencesMigrated, SellerLeadModel } from "@/lib/models/seller-lead";
import { LeadDeliveryModel } from "@/lib/models/lead-delivery";
import { CampaignModel } from "@/lib/models/campaign";
import { BuyerModel } from "@/lib/models/buyer";
import { PingTreeConfigModel } from "@/lib/models/ping-tree-config";
import { resolveBuyerName, type BuyerDoc } from "@/lib/buyer";
import { buildVerticalIndexMap, formatProductLabel } from "@/lib/integration-builder";
import {
  buildLeadDetailRecord,
  buildLeadFilterLog,
  buildLeadFilterProcessing,
} from "@/lib/lead-detail";
import {
  normalizeLeadPayload,
  normalizePublisherLeadPingTreeAllocations,
  type PublisherLeadAcceptedDelivery,
} from "@/lib/publisher-lead-details";

type Params = { params: Promise<{ id: string }> };

type LeadDoc = {
  _id?: { toString(): string };
  sellerRef?: { toString(): string } | string;
  verticalRef?: { toString(): string } | string;
  payload?: Record<string, unknown>;
  rawData?: string;
  validationStatus: "success" | "fail";
  validationErrors?: string[];
  publisherStatus?: "Sold" | "Reject" | "Post Error" | "Test";
  redirectConfirmedAt?: Date | string | null;
  redirectUrl?: string | null;
  redirectClientIp?: string | null;
  redirectReferrer?: string | null;
  redirectClickUserAgent?: string | null;
  userAgent?: string | null;
  soldPrice?: number | null;
  pingTreeAllocations?: unknown;
  postedAt?: Date | string;
  createdAt?: Date | string;
};

function buildLeadIdCondition(leadId: string) {
  const trimmed = leadId.trim();
  if (!trimmed) return null;

  if (Types.ObjectId.isValid(trimmed)) {
    return { _id: new Types.ObjectId(trimmed) };
  }

  const withoutPrefix = trimmed.replace(/^W_/i, "");
  if (Types.ObjectId.isValid(withoutPrefix)) {
    return { _id: new Types.ObjectId(withoutPrefix) };
  }

  const suffix = withoutPrefix.replace(/[^a-zA-Z0-9]/g, "").slice(-6);
  if (!suffix) return null;

  return {
    $expr: {
      $regexMatch: {
        input: { $toString: "$_id" },
        regex: `${suffix}$`,
        options: "i",
      },
    },
  };
}

function toIsoString(primary?: Date | string | null, fallback?: Date | string | null) {
  const value = primary ?? fallback;
  if (!value) return new Date().toISOString();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export async function GET(_req: Request, context: Params) {
  try {
    const { id } = await context.params;
    const condition = buildLeadIdCondition(id);
    if (!condition) {
      return NextResponse.json({ message: "Invalid lead id." }, { status: 400 });
    }

    await connectToDatabase();
    await ensureSellerCollectionMigrated();
    await ensureSellerLeadReferencesMigrated();
    await ensureVerticalCollectionMigrated();

    const lead = (await SellerLeadModel.findOne(condition).lean()) as LeadDoc | null;
    if (!lead) {
      return NextResponse.json({ message: "Lead not found." }, { status: 404 });
    }

    const leadId = lead._id?.toString() ?? "";
    const sellerRef =
      typeof lead.sellerRef === "string" ? lead.sellerRef : lead.sellerRef?.toString() ?? "";
    const verticalRef =
      typeof lead.verticalRef === "string" ? lead.verticalRef : lead.verticalRef?.toString() ?? "";

    const [seller, vertical, sellers, verticals, deliveries] = await Promise.all([
      sellerRef && Types.ObjectId.isValid(sellerRef)
        ? SellerModel.findById(sellerRef).select({ name: 1 }).lean()
        : null,
      verticalRef && Types.ObjectId.isValid(verticalRef)
        ? VerticalModel.findById(verticalRef).lean()
        : null,
      SellerModel.find({}, { name: 1 }).sort({ createdAt: -1 }).lean(),
      VerticalModel.find({}, { name: 1, fields: 1 }).sort({ createdAt: 1 }).lean(),
      LeadDeliveryModel.find({ sellerLeadRef: new Types.ObjectId(leadId) })
        .sort({ campaignOrder: 1, postedAt: 1 })
        .lean(),
    ]);

    const sellerIndexById = new Map(
      sellers.map((entry, index) => [entry._id.toString(), index + 1001])
    );
    const verticalIndexById = buildVerticalIndexMap(
      verticals.map((entry) => entry._id.toString())
    );

    const buyerIds = [
      ...new Set(
        deliveries
          .map((delivery) => delivery.buyerRef?.toString() ?? "")
          .filter((value) => Types.ObjectId.isValid(value))
      ),
    ].map((value) => new Types.ObjectId(value));
    const campaignIds = [
      ...new Set(
        deliveries
          .map((delivery) => delivery.campaignRef?.toString() ?? "")
          .filter((value) => Types.ObjectId.isValid(value))
      ),
    ].map((value) => new Types.ObjectId(value));

    const [buyers, campaigns] = await Promise.all([
      buyerIds.length > 0
        ? BuyerModel.find({ _id: { $in: buyerIds } }).select({ company: 1, name: 1, displayId: 1 }).lean()
        : [],
      campaignIds.length > 0
        ? CampaignModel.find({ _id: { $in: campaignIds } })
            .select({ name: 1, displayId: 1, minPrice: 1 })
            .lean()
        : [],
    ]);

    const buyerById = new Map(buyers.map((buyer) => [buyer._id.toString(), buyer]));
    const campaignById = new Map(campaigns.map((campaign) => [campaign._id.toString(), campaign]));

    const acceptedDeliveries = deliveries.filter((delivery) => delivery.buyerStatus === "Accept");
    const acceptedRedirect = acceptedDeliveries.find((delivery) => delivery.pingTreeType === "Redirect");
    const acceptedAny = acceptedRedirect ?? acceptedDeliveries[0] ?? null;

    let acceptedDelivery: PublisherLeadAcceptedDelivery | null = null;
    let buyerLabel = "";
    let redirectCampaignId = "";
    let redirectCampaignName = "";
    let redirectCreatedAt = "";
    if (acceptedAny) {
      const buyer = buyerById.get(acceptedAny.buyerRef?.toString() ?? "");
      const campaign = campaignById.get(acceptedAny.campaignRef?.toString() ?? "");
      const buyerCompany = buyer ? resolveBuyerName(buyer as BuyerDoc) : "Buyer";
      acceptedDelivery = {
        buyerDisplayId: typeof buyer?.displayId === "number" ? buyer.displayId : null,
        buyerCompany,
        campaignDisplayId: typeof campaign?.displayId === "number" ? campaign.displayId : null,
        campaignName: campaign?.name?.trim() || "Campaign",
        price: typeof acceptedAny.price === "number" ? acceptedAny.price : null,
        pingTreeType: acceptedAny.pingTreeType === "Silent" ? "Silent" : "Redirect",
      };
      buyerLabel = acceptedDelivery.buyerDisplayId
        ? `[${acceptedDelivery.buyerDisplayId}] ${buyerCompany}`
        : buyerCompany;
    }

    const redirectDelivery = acceptedRedirect ?? null;
    if (redirectDelivery) {
      const campaign = campaignById.get(redirectDelivery.campaignRef?.toString() ?? "");
      redirectCampaignId = redirectDelivery.campaignRef?.toString() ?? "";
      redirectCampaignName = campaign?.name?.trim() || "Campaign";
      redirectCreatedAt = toIsoString(redirectDelivery.postedAt, lead.postedAt);
    }

    const buyerRevenue = acceptedDeliveries.reduce((sum, delivery) => {
      return sum + (typeof delivery.price === "number" && Number.isFinite(delivery.price) ? delivery.price : 0);
    }, 0);

    const fieldLabelsByName = new Map<string, string>();
    const verticalFields = Array.isArray((vertical as { fields?: unknown } | null)?.fields)
      ? ((vertical as { fields: Array<{ fieldName?: string; description?: string }> }).fields ?? [])
      : [];
    for (const field of verticalFields) {
      const name = field.fieldName?.trim();
      if (!name) continue;
      fieldLabelsByName.set(name, field.description?.trim() || name);
    }

    const payload = normalizeLeadPayload(lead as Record<string, unknown>);
    const pingTreeAllocations = normalizePublisherLeadPingTreeAllocations(lead.pingTreeAllocations);
    const pingTreeConfigIds = [
      ...new Set(
        pingTreeAllocations
          .map((allocation) => allocation.configId)
          .filter((configId) => Types.ObjectId.isValid(configId))
      ),
    ].map((configId) => new Types.ObjectId(configId));

    const pingTreeConfigs =
      pingTreeConfigIds.length > 0
        ? await PingTreeConfigModel.find({ _id: { $in: pingTreeConfigIds } })
            .select({ activeCampaignIds: 1, inactiveCampaignIds: 1 })
            .lean()
        : [];

    const campaignCountByConfigId: Record<string, number> = {};
    for (const config of pingTreeConfigs) {
      const active = Array.isArray(config.activeCampaignIds) ? config.activeCampaignIds.length : 0;
      campaignCountByConfigId[config._id.toString()] = active;
    }

    const filterLog = buildLeadFilterLog({
      validationErrors: lead.validationErrors ?? [],
      deliveryTraces: deliveries.map((delivery) => {
        const campaign = campaignById.get(delivery.campaignRef?.toString() ?? "");
        const buyer = buyerById.get(delivery.buyerRef?.toString() ?? "");
        return {
          campaignName: campaign?.name?.trim() || "Campaign",
          buyerCompany: buyer ? resolveBuyerName(buyer as BuyerDoc) : "Buyer",
          buyerStatus: delivery.buyerStatus,
          deliveryTrace: Array.isArray(delivery.deliveryTrace) ? delivery.deliveryTrace : [],
        };
      }),
    });

    const filterProcessing = buildLeadFilterProcessing({
      pingTreeAllocations,
      campaignCountByConfigId,
      deliveries: deliveries.map((delivery) => {
        const campaign = campaignById.get(delivery.campaignRef?.toString() ?? "");
        const buyer = buyerById.get(delivery.buyerRef?.toString() ?? "");
        const responseHeaders =
          delivery.responseHeaders && typeof delivery.responseHeaders === "object"
            ? Object.fromEntries(
                Object.entries(delivery.responseHeaders as Record<string, unknown>).map(([key, value]) => [
                  key,
                  String(value ?? ""),
                ])
              )
            : {};

        return {
          id: delivery._id?.toString?.() ?? `${delivery.campaignRef?.toString() ?? ""}-${delivery.postedAt}`,
          pingTreeType: delivery.pingTreeType === "Silent" ? "Silent" : "Redirect",
          processingType:
            typeof (delivery as { processingType?: unknown }).processingType === "string"
              ? ((delivery as { processingType?: string }).processingType ?? "")
              : "",
          postedAt: toIsoString(delivery.postedAt),
          buyerStatus: delivery.buyerStatus,
          price: typeof delivery.price === "number" ? delivery.price : null,
          campaignMinPrice: typeof campaign?.minPrice === "number" ? campaign.minPrice : null,
          buyerDisplayId: typeof buyer?.displayId === "number" ? buyer.displayId : null,
          buyerCompany: buyer ? resolveBuyerName(buyer as BuyerDoc) : "Buyer",
          campaignId: delivery.campaignRef?.toString() ?? "",
          campaignDisplayId: typeof campaign?.displayId === "number" ? campaign.displayId : null,
          campaignName: campaign?.name?.trim() || "Campaign",
          rejectReason: delivery.rejectReason,
          errorReason: delivery.errorReason,
          validationErrors: Array.isArray(delivery.validationErrors) ? delivery.validationErrors : [],
          responseTimeMs: typeof delivery.responseTimeMs === "number" ? delivery.responseTimeMs : null,
          httpStatus: typeof delivery.httpStatus === "number" ? delivery.httpStatus : 0,
          postLeadUrl: delivery.postLeadUrl,
          requestPayload:
            delivery.requestPayload && typeof delivery.requestPayload === "object"
              ? (delivery.requestPayload as Record<string, unknown>)
              : null,
          responseBody: typeof delivery.responseBody === "string" ? delivery.responseBody : "",
          responseHeaders,
        };
      }),
    });

    const publisherIndex = sellerIndexById.get(sellerRef) ?? 0;
    const publisherName = seller?.name?.trim() || "Unknown";
    const verticalIndex = verticalIndexById.get(verticalRef) ?? 0;
    const verticalName = vertical?.name?.trim() || "Unknown";

    const detail = buildLeadDetailRecord({
      id: leadId,
      validationStatus: lead.validationStatus,
      publisherStatus: lead.publisherStatus,
      redirectConfirmedAt: lead.redirectConfirmedAt,
      redirectUrl: lead.redirectUrl,
      redirectClientIp: lead.redirectClientIp,
      redirectReferrer: lead.redirectReferrer,
      redirectClickUserAgent: lead.redirectClickUserAgent,
      userAgent: lead.userAgent,
      soldPrice: lead.soldPrice,
      postedAt: toIsoString(lead.postedAt, lead.createdAt),
      redirectCreatedAt: redirectCreatedAt || undefined,
      redirectCampaignId: redirectCampaignId || undefined,
      redirectCampaignName: redirectCampaignName || undefined,
      payload,
      validationErrors: lead.validationErrors,
      publisherLabel: publisherIndex ? `[${publisherIndex}] ${publisherName}` : publisherName,
      productLabel: formatProductLabel(verticalName, verticalIndex || 1),
      acceptedDelivery,
      buyerRevenue,
      buyerLabel,
      fieldLabelsByName,
      filterLog,
      filterProcessing,
    });

    return NextResponse.json(detail);
  } catch (error) {
    console.error("Failed to fetch lead detail:", error);
    return NextResponse.json({ message: "Failed to fetch lead detail." }, { status: 500 });
  }
}
