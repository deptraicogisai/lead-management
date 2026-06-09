import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import { ensureSellerCollectionMigrated, SellerModel } from "@/lib/models/seller";
import { ensureSellerLeadReferencesMigrated, SellerLeadModel } from "@/lib/models/seller-lead";
import { buildVerticalIndexMap, formatProductLabel } from "@/lib/integration-builder";
import {
  buildPublisherLeadFieldColumnsFromLeads,
  mapLeadDocToPublisherRow,
  normalizeLeadPayload,
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
  userAgent?: string;
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
  tableSearch: string;
}) {
  const andConditions: Record<string, unknown>[] = [];

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
    andConditions.push({ verticalRef: new Types.ObjectId(params.productId) });
  }

  if (params.publisherId && Types.ObjectId.isValid(params.publisherId)) {
    andConditions.push({ sellerRef: new Types.ObjectId(params.publisherId) });
  }

  if (params.status.toLowerCase() === "sold") {
    andConditions.push({ validationStatus: "success" });
  } else if (params.status.toLowerCase() === "reject") {
    andConditions.push({ validationStatus: "fail" });
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
      const postedAt = toIsoString(doc.postedAt, doc.createdAt);
      const createdAt = toIsoString(doc.createdAt, doc.postedAt);

      return mapLeadDocToPublisherRow({
        id: doc._id?.toString() ?? "",
        validationStatus: doc.validationStatus,
        postedAt,
        createdAt,
        userAgent: doc.userAgent,
        validationErrors: doc.validationErrors,
        payload,
        sellerName: sellerNameById.get(sellerRef) ?? "Unknown",
        sellerIndex: sellerIndexById.get(sellerRef) ?? 0,
        verticalName: verticalNameById.get(verticalRef) ?? "Unknown",
        verticalIndex: verticalIndexById.get(verticalRef) ?? 0,
        mappingLabel: doc.mappingRef ? `[${doc.mappingRef.toString().slice(-4)}]` : "—",
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
