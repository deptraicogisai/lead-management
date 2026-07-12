import { type PipelineStage, Types } from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import { ensureSellerCollectionMigrated, SellerModel } from "@/lib/models/seller";
import { BuyerModel, ensureBuyerFieldsMigrated } from "@/lib/models/buyer";
import { CampaignModel } from "@/lib/models/campaign";
import { LeadDeliveryModel } from "@/lib/models/lead-delivery";
import {
  ensurePingTreeConfigDisplayIdMigrated,
  PingTreeConfigModel,
} from "@/lib/models/ping-tree-config";
import { resolveBuyerName } from "@/lib/buyer";
import { formatProductLabel } from "@/lib/integration-builder";
import { mapBuyerDeliveryToLeadDetailsRow } from "@/lib/buyer-lead-details";
import { normalizeSearchParam, parsePageParam } from "@/lib/pagination";
import { excludeDeletedStatusFilter } from "@/lib/soft-delete";

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

function buildSellerLeadRefCondition(leadId: string) {
  if (Types.ObjectId.isValid(leadId) && leadId.length === 24) {
    return { sellerLeadRef: new Types.ObjectId(leadId) };
  }

  const normalized = leadId.replace(/^W_/i, "").trim();
  if (normalized && Types.ObjectId.isValid(normalized) && normalized.length === 24) {
    return { sellerLeadRef: new Types.ObjectId(normalized) };
  }

  const suffix = escapeRegex(normalized || leadId);
  return {
    $expr: {
      $regexMatch: {
        input: { $toString: "$sellerLeadRef" },
        regex: `${suffix}$`,
        options: "i",
      },
    },
  };
}

type BuyerLeadQueryParams = {
  leadId: string;
  buyerId: string;
  campaignId: string;
  pingTreeId: string;
  productId: string;
  publisherId: string;
  redirectStatus: string;
  publisherTag: string;
  status: string;
  dateFrom: Date | null;
  dateTo: Date | null;
  tableSearch: string;
};

function buildDeliveryMatch(params: BuyerLeadQueryParams) {
  const andConditions: Record<string, unknown>[] = [];

  if (params.leadId) {
    andConditions.push(buildSellerLeadRefCondition(params.leadId));
  }

  if (params.buyerId && Types.ObjectId.isValid(params.buyerId)) {
    andConditions.push({ buyerRef: new Types.ObjectId(params.buyerId) });
  } else if (params.buyerId) {
    return null;
  }

  if (params.campaignId && Types.ObjectId.isValid(params.campaignId)) {
    andConditions.push({ campaignRef: new Types.ObjectId(params.campaignId) });
  } else if (params.campaignId) {
    return null;
  }

  if (params.productId && Types.ObjectId.isValid(params.productId)) {
    andConditions.push({ verticalRef: new Types.ObjectId(params.productId) });
  } else if (params.productId) {
    return null;
  }

  if (params.publisherId && Types.ObjectId.isValid(params.publisherId)) {
    andConditions.push({ sellerRef: new Types.ObjectId(params.publisherId) });
  } else if (params.publisherId) {
    return null;
  }

  if (params.status && params.status !== "All") {
    andConditions.push({ buyerStatus: params.status });
  }

  if (params.dateFrom || params.dateTo) {
    andConditions.push({
      postedAt: {
        ...(params.dateFrom ? { $gte: params.dateFrom } : {}),
        ...(params.dateTo ? { $lte: params.dateTo } : {}),
      },
    });
  }

  if (params.tableSearch) {
    const regex = { $regex: escapeRegex(params.tableSearch), $options: "i" };
    andConditions.push({
      $or: [{ postLeadUrl: regex }, { errorReason: regex }, { rejectReason: regex }],
    });
  }

  if (andConditions.length === 0) {
    return {};
  }

  if (andConditions.length === 1) {
    return andConditions[0];
  }

  return { $and: andConditions };
}

function buildPostLookupStages(): PipelineStage[] {
  return [
    {
      $lookup: {
        from: "leads",
        localField: "sellerLeadRef",
        foreignField: "_id",
        as: "sellerLead",
      },
    },
    { $unwind: { path: "$sellerLead", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "sellers",
        localField: "sellerRef",
        foreignField: "_id",
        as: "seller",
      },
    },
    { $unwind: { path: "$seller", preserveNullAndEmptyArrays: true } },
  ];
}

function buildPostLookupMatch(params: BuyerLeadQueryParams) {
  const andConditions: Record<string, unknown>[] = [];
  const normalizedRedirect = params.redirectStatus.trim().toLowerCase();

  if (normalizedRedirect === "redirected") {
    andConditions.push({ "sellerLead.redirectConfirmedAt": { $ne: null } });
  } else if (normalizedRedirect === "not redirected") {
    andConditions.push({
      pingTreeType: "Redirect",
      buyerStatus: "Accept",
      $or: [
        { "sellerLead.redirectConfirmedAt": { $exists: false } },
        { "sellerLead.redirectConfirmedAt": null },
      ],
    });
  }

  if (params.publisherTag) {
    andConditions.push({ "seller.publisherTag": params.publisherTag });
  }

  if (params.pingTreeId) {
    andConditions.push({
      $expr: {
        $gt: [
          {
            $size: {
              $filter: {
                input: { $ifNull: ["$sellerLead.pingTreeAllocations", []] },
                as: "alloc",
                cond: {
                  $and: [
                    { $eq: ["$$alloc.configId", params.pingTreeId] },
                    { $eq: ["$$alloc.pingTreeType", "$pingTreeType"] },
                  ],
                },
              },
            },
          },
          0,
        ],
      },
    });
  }

  if (andConditions.length === 0) {
    return null;
  }

  if (andConditions.length === 1) {
    return andConditions[0];
  }

  return { $and: andConditions };
}

async function queryDeliveries(params: {
  match: Record<string, unknown>;
  postLookupMatch: Record<string, unknown> | null;
  skip: number;
  pageSize: number;
}) {
  const pipeline: PipelineStage[] = [{ $match: params.match }, ...buildPostLookupStages()];

  if (params.postLookupMatch) {
    pipeline.push({ $match: params.postLookupMatch });
  }

  pipeline.push(
    { $sort: { postedAt: -1, campaignOrder: 1 } },
    {
      $facet: {
        data: [{ $skip: params.skip }, { $limit: params.pageSize }],
        total: [{ $count: "count" }],
      },
    }
  );

  const [result] = await LeadDeliveryModel.aggregate(pipeline);
  const docs = (result?.data ?? []) as Array<Record<string, unknown>>;
  const total = Number((result?.total?.[0] as { count?: number } | undefined)?.count ?? 0);
  return { docs, total };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const leadId = normalizeSearchParam(searchParams.get("leadId"));
    const buyerId = normalizeSearchParam(searchParams.get("buyerId"));
    const campaignId = normalizeSearchParam(searchParams.get("campaignId"));
    const pingTreeId = normalizeSearchParam(searchParams.get("pingTreeId"));
    const productId = normalizeSearchParam(searchParams.get("productId"));
    const publisherId = normalizeSearchParam(searchParams.get("publisherId"));
    const redirectStatus = normalizeSearchParam(searchParams.get("redirectStatus")) || "All";
    const publisherTag = normalizeSearchParam(searchParams.get("publisherTag"));
    const status = normalizeSearchParam(searchParams.get("status")) || "All";
    const dateFrom = parseDate(searchParams.get("dateFrom"));
    const dateTo = parseDate(searchParams.get("dateTo"));
    const tableSearch = normalizeSearchParam(searchParams.get("tableSearch"));
    const page = parsePageParam(searchParams.get("page"), 1);
    const pageSize = parsePageSize(searchParams.get("pageSize"));
    const skip = (page - 1) * pageSize;

    await connectToDatabase();
    await ensureBuyerFieldsMigrated();
    await ensureSellerCollectionMigrated();
    await ensureVerticalCollectionMigrated();
    await ensurePingTreeConfigDisplayIdMigrated();

    if (pingTreeId && !Types.ObjectId.isValid(pingTreeId)) {
      return NextResponse.json(buildEmptyResponse(page, pageSize));
    }

    const queryParams: BuyerLeadQueryParams = {
      leadId,
      buyerId,
      campaignId,
      pingTreeId,
      productId,
      publisherId,
      redirectStatus,
      publisherTag,
      status,
      dateFrom,
      dateTo,
      tableSearch,
    };

    const match = buildDeliveryMatch(queryParams);
    if (match === null) {
      return NextResponse.json(buildEmptyResponse(page, pageSize));
    }

    const pingTreeQuery =
      productId && Types.ObjectId.isValid(productId)
        ? { ...excludeDeletedStatusFilter(), verticalRef: new Types.ObjectId(productId) }
        : excludeDeletedStatusFilter();

    const [verticals, sellers, buyers, campaignDocs, pingTreeConfigs, deliveryResult] = await Promise.all([
      VerticalModel.find().sort({ createdAt: 1 }).select({ _id: 1, name: 1 }).lean(),
      SellerModel.find().sort({ createdAt: 1 }).select({ _id: 1, name: 1, publisherTag: 1 }).lean(),
      BuyerModel.find(excludeDeletedStatusFilter())
        .sort({ displayId: 1, createdAt: 1 })
        .select({ _id: 1, displayId: 1, name: 1, company: 1, firstName: 1, lastName: 1 })
        .lean(),
      CampaignModel.find(
        productId && Types.ObjectId.isValid(productId)
          ? { verticalRef: new Types.ObjectId(productId) }
          : {}
      )
        .sort({ displayId: 1, name: 1 })
        .select({ _id: 1, name: 1, displayId: 1, buyerRef: 1, minPrice: 1 })
        .lean(),
      PingTreeConfigModel.find(pingTreeQuery)
        .select({ name: 1, displayId: 1 })
        .sort({ displayId: 1, name: 1 })
        .lean(),
      queryDeliveries({
        match,
        postLookupMatch: buildPostLookupMatch(queryParams),
        skip,
        pageSize,
      }),
    ]);

    const { docs, total } = deliveryResult;

    const sellerIndexById = new Map(sellers.map((seller, index) => [seller._id.toString(), index + 1001]));
    const sellerNameById = new Map(sellers.map((seller) => [seller._id.toString(), seller.name]));
    const sellerTagById = new Map(
      sellers.map((seller) => [seller._id.toString(), (seller.publisherTag ?? "").trim()])
    );
    const verticalIndexById = new Map(verticals.map((vertical, index) => [vertical._id.toString(), index + 1]));
    const verticalNameById = new Map(verticals.map((vertical) => [vertical._id.toString(), vertical.name]));
    const buyerById = new Map(buyers.map((buyer) => [buyer._id.toString(), buyer]));
    const campaignById = new Map(campaignDocs.map((campaign) => [campaign._id.toString(), campaign]));

    const items = docs.map((doc) => {
      const buyer = buyerById.get(String(doc.buyerRef ?? ""));
      const campaign = campaignById.get(String(doc.campaignRef ?? ""));
      const sellerLead = doc.sellerLead as
        | {
            redirectConfirmedAt?: Date | string | null;
            soldPrice?: number | null;
            pingTreeAllocations?: unknown;
            payload?: Record<string, unknown>;
          }
        | undefined;
      const sellerId = String(doc.sellerRef ?? "");
      const verticalId = String(doc.verticalRef ?? "");
      const pingTreeType = doc.pingTreeType === "Silent" ? "Silent" : "Redirect";

      return mapBuyerDeliveryToLeadDetailsRow({
        deliveryId: String(doc._id ?? ""),
        leadId: String(doc.sellerLeadRef ?? ""),
        postedAt: doc.postedAt ? new Date(doc.postedAt as string | Date).toISOString() : "",
        buyerStatus: String(doc.buyerStatus ?? ""),
        price: typeof doc.price === "number" ? doc.price : null,
        pingTreeType,
        redirectConfirmedAt: sellerLead?.redirectConfirmedAt,
        publisherPayout: typeof doc.publisherPayout === "number" ? doc.publisherPayout : null,
        soldPrice: sellerLead?.soldPrice,
        productName: verticalNameById.get(verticalId) ?? "",
        productIndex: verticalIndexById.get(verticalId) ?? 0,
        buyerLabel: buyer ? resolveBuyerName(buyer) : "",
        buyerDisplayId: buyer?.displayId ?? null,
        campaignName: campaign?.name ?? "",
        campaignDisplayId: campaign?.displayId ?? null,
        campaignMinPrice: typeof campaign?.minPrice === "number" ? campaign.minPrice : null,
        publisherName: sellerNameById.get(sellerId) ?? "",
        publisherIndex: sellerIndexById.get(sellerId) ?? 0,
        publisherTag: sellerTagById.get(sellerId) ?? "",
        leadPayload:
          sellerLead?.payload && typeof sellerLead.payload === "object" && !Array.isArray(sellerLead.payload)
            ? sellerLead.payload
            : null,
        responseTimeMs: typeof doc.responseTimeMs === "number" ? doc.responseTimeMs : null,
        redirectUrl: typeof doc.redirectUrl === "string" ? doc.redirectUrl : "",
        rejectReason: typeof doc.rejectReason === "string" ? doc.rejectReason : "",
        errorReason: typeof doc.errorReason === "string" ? doc.errorReason : "",
        postLeadUrl: typeof doc.postLeadUrl === "string" ? doc.postLeadUrl : "",
        httpStatus: typeof doc.httpStatus === "number" ? doc.httpStatus : 0,
        requestPayload:
          doc.requestPayload && typeof doc.requestPayload === "object" && !Array.isArray(doc.requestPayload)
            ? (doc.requestPayload as Record<string, unknown>)
            : null,
        responseBody: typeof doc.responseBody === "string" ? doc.responseBody : "",
        responseHeaders:
          doc.responseHeaders && typeof doc.responseHeaders === "object" && !Array.isArray(doc.responseHeaders)
            ? (doc.responseHeaders as Record<string, string>)
            : {},
        validationErrors: Array.isArray(doc.validationErrors) ? doc.validationErrors : [],
        campaignId: String(doc.campaignRef ?? ""),
        buyerId: String(doc.buyerRef ?? ""),
        campaignOrder: Number(doc.campaignOrder ?? 0),
        pingTreeAllocations: sellerLead?.pingTreeAllocations,
      });
    });

    const publisherTagOptions = [
      ...new Set(
        sellers
          .map((seller) => (seller.publisherTag ?? "").trim())
          .filter((tag): tag is string => tag.length > 0)
      ),
    ].sort((left, right) => left.localeCompare(right));

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return NextResponse.json({
      items,
      page,
      pageSize,
      totalItems: total,
      totalPages,
      filters: {
        products: verticals.map((vertical, index) => ({
          id: vertical._id.toString(),
          label: formatProductLabel(vertical.name, index + 1),
        })),
        publishers: sellers.map((seller, index) => ({
          id: seller._id.toString(),
          label: `[${index + 1001}] ${seller.name}`,
        })),
        buyers: buyers.map((buyer) => ({
          id: buyer._id.toString(),
          label: buyer.displayId
            ? `[${buyer.displayId}] ${resolveBuyerName(buyer)}`
            : resolveBuyerName(buyer),
        })),
        campaigns: campaignDocs.map((campaign) => ({
          id: campaign._id.toString(),
          label: campaign.displayId
            ? `[${campaign.displayId}] ${campaign.name}`
            : campaign.name?.trim() || "Unknown",
        })),
        pingTrees: pingTreeConfigs.map((config) => ({
          id: config._id?.toString() ?? "",
          label:
            config.displayId != null
              ? `[${config.displayId}] ${config.name}`
              : config.name?.trim() || "Unknown",
        })),
        publisherTags: publisherTagOptions,
      },
    });
  } catch (error) {
    console.error("Failed to load buyer lead details:", error);
    return NextResponse.json({ message: "Failed to load buyer lead details." }, { status: 500 });
  }
}

function buildEmptyResponse(page: number, pageSize: number) {
  return {
    items: [],
    page,
    pageSize,
    totalItems: 0,
    totalPages: 1,
    filters: {
      products: [],
      publishers: [],
      buyers: [],
      campaigns: [],
      pingTrees: [],
      publisherTags: [],
    },
  };
}
