import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import { ensureSellerCollectionMigrated, SellerModel } from "@/lib/models/seller";
import { ensureSellerLeadReferencesMigrated, SellerLeadModel } from "@/lib/models/seller-lead";
import { LeadDeliveryModel } from "@/lib/models/lead-delivery";
import { CampaignModel } from "@/lib/models/campaign";
import { BuyerModel } from "@/lib/models/buyer";
import { resolveBuyerName, type BuyerDoc } from "@/lib/buyer";
import { buildVerticalIndexMap, formatProductLabel } from "@/lib/integration-builder";
import {
  buildPublisherLeadFieldColumnsFromLeads,
  mapLeadDocToPublisherRow,
  normalizeLeadPayload,
  normalizePublisherLeadPingTreeAllocations,
  type PublisherLeadAcceptedDelivery,
  type PublisherLeadDetailsRow,
} from "@/lib/publisher-lead-details";
import { normalizeSearchParam, parsePageParam } from "@/lib/pagination";

type LeadDoc = {
  _id?: { toString(): string };
  sellerRef?: { toString(): string } | string;
  verticalRef?: { toString(): string } | string;
  mappingRef?: { toString(): string } | string;
  payload?: Record<string, unknown>;
  rawData?: string;
  validationStatus: "success" | "fail";
  validationErrors?: string[];
  publisherStatus?: "Sold" | "Reject" | "Post Error" | "Test";
  redirectConfirmedAt?: Date | string | null;
  soldPrice?: number | null;
  userAgent?: string;
  pingTreeAllocations?: unknown;
  postedAt?: Date | string;
  createdAt?: Date | string;
};

function parsePageSize(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 100;
  return Math.min(parsed, 1000);
}

function parseDate(value: string | null) {
  if (!value?.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildLeadIdCondition(leadId: string) {
  if (Types.ObjectId.isValid(leadId) && leadId.length === 24) {
    return { _id: new Types.ObjectId(leadId) };
  }

  const normalized = leadId.replace(/^W_/i, "").trim();
  if (normalized && Types.ObjectId.isValid(normalized) && normalized.length === 24) {
    return { _id: new Types.ObjectId(normalized) };
  }

  const suffix = escapeRegex(normalized || leadId);
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

function buildMongoFilter(params: {
  leadId: string;
  dateFrom: Date | null;
  dateTo: Date | null;
  productId: string;
  status: string;
  publisherId: string;
  publisherChannel: string;
  publisherSource: string;
  publisherTags: string;
  redirectStatus: string;
  leadScope: string;
  tableSearch: string;
}) {
  const andConditions: Record<string, unknown>[] = [];
  const normalizedScope = params.leadScope.trim().toLowerCase();

  if (normalizedScope === "post") {
    // All posts, including validation failures.
  } else if (normalizedScope === "lead") {
    andConditions.push({ validationStatus: "success" });
  } else if (normalizedScope === "sold") {
    andConditions.push({ publisherStatus: "Sold" });
  } else if (normalizedScope === "reject") {
    andConditions.push({ publisherStatus: { $in: ["Reject", "Post Error"] } });
  } else {
    // Default view includes every publisher post, including intake validation failures.
    const normalizedStatus = params.status.toLowerCase();
    if (normalizedStatus === "sold") {
      andConditions.push({ validationStatus: "success", publisherStatus: "Sold" });
    } else if (normalizedStatus === "intake reject") {
      andConditions.push({ validationStatus: "fail" });
    } else if (normalizedStatus === "reject") {
      andConditions.push({ validationStatus: "success", publisherStatus: "Reject" });
    } else if (normalizedStatus === "post error") {
      andConditions.push({ validationStatus: "success", publisherStatus: "Post Error" });
    } else if (normalizedStatus === "test") {
      andConditions.push({ validationStatus: "success", publisherStatus: "Test" });
    } else if (normalizedStatus === "new") {
      andConditions.push({ validationStatus: "success" });
      andConditions.push({
        $or: [
          { publisherStatus: { $exists: false } },
          { publisherStatus: null },
          { publisherStatus: { $nin: ["Sold", "Reject", "Post Error", "Test"] } },
        ],
      });
    } else if (normalizedStatus === "accepted") {
      andConditions.push({ validationStatus: "success", publisherStatus: "Sold" });
    }
  }

  if (params.leadId) {
    andConditions.push(buildLeadIdCondition(params.leadId));
  }

  if (params.dateFrom || params.dateTo) {
    andConditions.push({
      postedAt: {
        ...(params.dateFrom ? { $gte: params.dateFrom } : {}),
        ...(params.dateTo ? { $lte: params.dateTo } : {}),
      },
    });
  }

  if (params.productId && Types.ObjectId.isValid(params.productId)) {
    andConditions.push({
      $or: [
        { verticalRef: new Types.ObjectId(params.productId) },
        {
          validationStatus: "fail",
          $or: [{ verticalRef: null }, { verticalRef: { $exists: false } }],
        },
      ],
    });
  }

  if (params.publisherId && Types.ObjectId.isValid(params.publisherId)) {
    andConditions.push({ sellerRef: new Types.ObjectId(params.publisherId) });
  }

  if (params.publisherChannel) {
    const regex = { $regex: params.publisherChannel, $options: "i" };
    andConditions.push({
      $or: [
        { "payload.channel": regex },
        { "payload.publisher_channel": regex },
        { "payload.publisherChannel": regex },
        { "payload.channel_id": regex },
        { "payload.channelId": regex },
      ],
    });
  }

  if (params.publisherSource) {
    const regex = { $regex: params.publisherSource, $options: "i" };
    andConditions.push({
      $or: [
        { "payload.source": regex },
        { "payload.publisher_source": regex },
        { "payload.publisherSource": regex },
        { "payload.utm_source": regex },
      ],
    });
  }

  if (params.publisherTags) {
    const regex = { $regex: params.publisherTags, $options: "i" };
    andConditions.push({
      $or: [
        { "payload.tags": regex },
        { "payload.publisher_tags": regex },
        { "payload.publisherTags": regex },
      ],
    });
  }

  const normalizedRedirectStatus = params.redirectStatus.trim().toLowerCase();
  if (normalizedRedirectStatus === "redirected") {
    andConditions.push({ redirectConfirmedAt: { $ne: null } });
  } else if (normalizedRedirectStatus === "not redirected") {
    andConditions.push({
      publisherStatus: "Sold",
      redirectUrl: { $exists: true, $nin: ["", null] },
      $or: [{ redirectConfirmedAt: { $exists: false } }, { redirectConfirmedAt: null }],
    });
  }

  if (params.tableSearch) {
    const regex = { $regex: params.tableSearch, $options: "i" };
    andConditions.push({
      $or: [
        buildLeadIdCondition(params.tableSearch),
        { "payload.email": regex },
        { "payload.phone": regex },
        { "payload.first_name": regex },
        { "payload.last_name": regex },
        { "payload.firstName": regex },
        { "payload.lastName": regex },
        { "payload.channel": regex },
        { "payload.source": regex },
        { userAgent: regex },
      ],
    });
  }

  if (!andConditions.length) {
    return {};
  }

  if (andConditions.length === 1) {
    return andConditions[0];
  }

  return { $and: andConditions };
}

function toIsoString(value: Date | string | undefined, fallback?: Date | string) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  if (fallback instanceof Date) {
    return fallback.toISOString();
  }

  if (fallback) {
    const parsed = new Date(fallback);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return "";
}

type AcceptedDeliveryDoc = {
  sellerLeadRef?: { toString(): string } | string;
  buyerRef?: { toString(): string } | string;
  campaignRef?: { toString(): string } | string;
  pingTreeType?: "Redirect" | "Silent";
  buyerStatus?: string;
  price?: number | null;
  campaignOrder?: number;
};

function resolveRedirectCampaignDelivery(
  leadId: string,
  deliveries: AcceptedDeliveryDoc[]
): AcceptedDeliveryDoc | null {
  return (
    deliveries.find((delivery) => {
      const sellerLeadRef =
        typeof delivery.sellerLeadRef === "string"
          ? delivery.sellerLeadRef
          : delivery.sellerLeadRef?.toString() ?? "";
      return sellerLeadRef === leadId && delivery.pingTreeType === "Redirect";
    }) ?? null
  );
}

function sumAcceptedDeliveryRevenue(leadId: string, deliveries: AcceptedDeliveryDoc[]) {
  return deliveries.reduce((total, delivery) => {
    const sellerLeadRef =
      typeof delivery.sellerLeadRef === "string"
        ? delivery.sellerLeadRef
        : delivery.sellerLeadRef?.toString() ?? "";
    if (sellerLeadRef !== leadId) {
      return total;
    }

    const price = typeof delivery.price === "number" && Number.isFinite(delivery.price) ? delivery.price : 0;
    return total + price;
  }, 0);
}

function buildAcceptedDeliverySummary(
  delivery: AcceptedDeliveryDoc | null,
  campaignById: Map<string, { name?: string | null; displayId?: number | null }>,
  buyerById: Map<string, BuyerDoc>
): PublisherLeadAcceptedDelivery | null {
  if (!delivery) {
    return null;
  }

  const campaignId =
    typeof delivery.campaignRef === "string" ? delivery.campaignRef : delivery.campaignRef?.toString() ?? "";
  const buyerId =
    typeof delivery.buyerRef === "string" ? delivery.buyerRef : delivery.buyerRef?.toString() ?? "";
  const campaign = campaignById.get(campaignId);
  const buyer = buyerById.get(buyerId);

  return {
    buyerDisplayId: typeof buyer?.displayId === "number" ? buyer.displayId : null,
    buyerCompany: buyer ? resolveBuyerName(buyer) : "",
    campaignDisplayId: typeof campaign?.displayId === "number" ? campaign.displayId : null,
    campaignName: campaign?.name?.trim() || "",
    price: typeof delivery.price === "number" && Number.isFinite(delivery.price) ? delivery.price : null,
    pingTreeType: delivery.pingTreeType === "Silent" ? "Silent" : delivery.pingTreeType === "Redirect" ? "Redirect" : "",
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parsePageParam(searchParams.get("page"), 1);
    const pageSize = parsePageSize(searchParams.get("pageSize"));
    const leadId = normalizeSearchParam(searchParams.get("leadId"));
    const dateFrom = parseDate(searchParams.get("dateFrom"));
    const dateTo = parseDate(searchParams.get("dateTo"));
    const productId = normalizeSearchParam(searchParams.get("productId"));
    const status = normalizeSearchParam(searchParams.get("status"));
    const publisherId = normalizeSearchParam(searchParams.get("publisherId"));
    const publisherChannel = normalizeSearchParam(searchParams.get("publisherChannel"));
    const publisherSource = normalizeSearchParam(searchParams.get("publisherSource"));
    const publisherTags = normalizeSearchParam(searchParams.get("publisherTags"));
    const redirectStatus = normalizeSearchParam(searchParams.get("redirectStatus"));
    const leadScope = normalizeSearchParam(searchParams.get("leadScope"));
    const tableSearch = normalizeSearchParam(searchParams.get("tableSearch"));

    await connectToDatabase();
    await ensureSellerCollectionMigrated();
    await ensureVerticalCollectionMigrated();
    await ensureSellerLeadReferencesMigrated();

    const filter = buildMongoFilter({
      leadId,
      dateFrom,
      dateTo,
      productId,
      status,
      publisherId,
      publisherChannel,
      publisherSource,
      publisherTags,
      redirectStatus,
      leadScope,
      tableSearch,
    });

    const [verticals, sellers, totalItems, leads] = await Promise.all([
      VerticalModel.find().sort({ createdAt: 1 }).select({ _id: 1, name: 1, fields: 1 }).lean(),
      SellerModel.find().sort({ createdAt: 1 }).select({ _id: 1, name: 1 }).lean(),
      SellerLeadModel.countDocuments(filter),
      SellerLeadModel.find(filter)
        .sort({ postedAt: -1, createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    const verticalIds = verticals.map((vertical) => vertical._id.toString());
    const verticalIndexById = buildVerticalIndexMap(verticalIds);
    const verticalNameById = new Map(verticals.map((vertical) => [vertical._id.toString(), vertical.name]));
    const sellerIndexById = new Map(sellers.map((seller, index) => [seller._id.toString(), index + 1001]));
    const sellerNameById = new Map(sellers.map((seller) => [seller._id.toString(), seller.name]));

    const leadIds = leads
      .map((lead) => lead._id?.toString() ?? "")
      .filter((leadId) => leadId && Types.ObjectId.isValid(leadId))
      .map((leadId) => new Types.ObjectId(leadId));

    const acceptedDeliveries =
      leadIds.length > 0
        ? ((await LeadDeliveryModel.find({
            sellerLeadRef: { $in: leadIds },
            buyerStatus: "Accept",
          })
            .select({
              sellerLeadRef: 1,
              buyerRef: 1,
              campaignRef: 1,
              pingTreeType: 1,
              buyerStatus: 1,
              price: 1,
              campaignOrder: 1,
            })
            .sort({ campaignOrder: 1 })
            .lean()) as AcceptedDeliveryDoc[])
        : [];

    const campaignIds = [
      ...new Set(
        acceptedDeliveries
          .map((delivery) =>
            typeof delivery.campaignRef === "string"
              ? delivery.campaignRef
              : delivery.campaignRef?.toString() ?? ""
          )
          .filter(Boolean)
      ),
    ];
    const buyerIds = [
      ...new Set(
        acceptedDeliveries
          .map((delivery) =>
            typeof delivery.buyerRef === "string" ? delivery.buyerRef : delivery.buyerRef?.toString() ?? ""
          )
          .filter(Boolean)
      ),
    ];

    const [campaigns, buyers] = await Promise.all([
      campaignIds.length > 0
        ? CampaignModel.find({ _id: { $in: campaignIds } }).select({ name: 1, displayId: 1 }).lean()
        : [],
      buyerIds.length > 0
        ? BuyerModel.find({ _id: { $in: buyerIds } }).select({ company: 1, name: 1, displayId: 1 }).lean()
        : [],
    ]);

    const campaignById = new Map(campaigns.map((campaign) => [campaign._id?.toString() ?? "", campaign]));
    const buyerById = new Map(buyers.map((buyer) => [buyer._id?.toString() ?? "", buyer]));

    const normalizedLeads = leads.map((lead) => {
      const doc = lead as LeadDoc;
      const payload = normalizeLeadPayload(doc as Record<string, unknown>);
      const verticalRef =
        typeof doc.verticalRef === "string" ? doc.verticalRef : doc.verticalRef?.toString() ?? "";

      return { doc, payload, verticalRef };
    });

    const fieldColumns = buildPublisherLeadFieldColumnsFromLeads(
      normalizedLeads.map((lead) => ({ verticalRef: lead.verticalRef, payload: lead.payload })),
      verticals,
      productId
    );

    const items: PublisherLeadDetailsRow[] = normalizedLeads.map(({ doc, payload }) => {
      const sellerRef =
        typeof doc.sellerRef === "string" ? doc.sellerRef : doc.sellerRef?.toString() ?? "";
      const verticalRef =
        typeof doc.verticalRef === "string" ? doc.verticalRef : doc.verticalRef?.toString() ?? "";
      const leadId = doc._id?.toString() ?? "";
      const postedAt = toIsoString(doc.postedAt, doc.createdAt);
      const createdAt = toIsoString(doc.createdAt, doc.postedAt);
      const acceptedDeliveryDoc = resolveRedirectCampaignDelivery(leadId, acceptedDeliveries);
      const buyerRevenue = sumAcceptedDeliveryRevenue(leadId, acceptedDeliveries);

      return mapLeadDocToPublisherRow({
        id: leadId,
        validationStatus: doc.validationStatus,
        publisherStatus: doc.publisherStatus,
        redirectConfirmedAt: doc.redirectConfirmedAt,
        soldPrice: doc.soldPrice,
        postedAt,
        createdAt,
        userAgent: doc.userAgent,
        validationErrors: doc.validationErrors,
        payload,
        publisherName: sellerNameById.get(sellerRef) ?? "Unknown",
        publisherIndex: sellerIndexById.get(sellerRef) ?? 0,
        verticalName: verticalNameById.get(verticalRef) ?? "Unknown",
        verticalIndex: verticalIndexById.get(verticalRef) ?? 0,
        mappingLabel: doc.mappingRef ? `[${doc.mappingRef.toString().slice(-4)}]` : "—",
        pingTreeAllocations: normalizePublisherLeadPingTreeAllocations(doc.pingTreeAllocations),
        acceptedDelivery: buildAcceptedDeliverySummary(acceptedDeliveryDoc, campaignById, buyerById),
        buyerRevenue,
      });
    });

    return NextResponse.json({
      items,
      fieldColumns,
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
      filters: {
        products: verticals.map((vertical, index) => ({
          id: vertical._id.toString(),
          label: formatProductLabel(vertical.name, index + 1),
        })),
        publishers: sellers.map((seller, index) => ({
          id: seller._id.toString(),
          label: `[${index + 1001}] ${seller.name}`,
        })),
      },
    });
  } catch (error) {
    console.error("Failed to fetch publisher lead details:", error);
    return NextResponse.json({ message: "Failed to fetch publisher lead details." }, { status: 500 });
  }
}
