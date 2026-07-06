import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import { ensureSellerCollectionMigrated, SellerModel } from "@/lib/models/seller";
import { BuyerModel, ensureBuyerFieldsMigrated } from "@/lib/models/buyer";
import { LeadDeliveryModel } from "@/lib/models/lead-delivery";
import { SellerLeadModel } from "@/lib/models/seller-lead";
import { formatProductLabel } from "@/lib/integration-builder";
import { resolveBuyerName } from "@/lib/buyer";
import { normalizeSearchParam, parsePageParam } from "@/lib/pagination";
import { excludeDeletedStatusFilter } from "@/lib/soft-delete";
import {
  emptyBuyerPerformanceMetrics,
  finalizeBuyerPerformanceMetrics,
  type BuyerPerformanceMetrics,
  type BuyerPerformanceRow,
} from "@/lib/buyer-performance-summary";

type DeliveryProjection = {
  buyerRef?: { toString(): string } | string;
  sellerLeadRef?: { toString(): string } | string;
  buyerStatus?: string;
  price?: number | null;
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

function refToString(ref?: { toString(): string } | string | null) {
  if (!ref) return "";
  return typeof ref === "string" ? ref : ref.toString();
}

type BuyerAccumulator = {
  post: number;
  rejected: number;
  accept: number;
  sendError: number;
  timeout: number;
  redirect: number;
  pub: number;
  ttl: number;
};

function createAccumulator(): BuyerAccumulator {
  return {
    post: 0,
    rejected: 0,
    accept: 0,
    sendError: 0,
    timeout: 0,
    redirect: 0,
    pub: 0,
    ttl: 0,
  };
}

function isRejectedStatus(status: string) {
  return status === "Reject" || status === "Price Reject" || status === "Price Conflict";
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parsePageParam(searchParams.get("page"), 1);
    const pageSize = parsePageSize(searchParams.get("pageSize"));
    const dateFrom = parseDate(searchParams.get("dateFrom"));
    const dateTo = parseDate(searchParams.get("dateTo"));
    const productId = normalizeSearchParam(searchParams.get("productId"));
    const buyerId = normalizeSearchParam(searchParams.get("buyerId"));
    const publisherId = normalizeSearchParam(searchParams.get("publisherId"));
    const tableSearch = normalizeSearchParam(searchParams.get("tableSearch"));

    await connectToDatabase();
    await ensureBuyerFieldsMigrated();
    await ensureSellerCollectionMigrated();
    await ensureVerticalCollectionMigrated();

    const [verticals, sellers, buyers] = await Promise.all([
      VerticalModel.find().sort({ createdAt: 1 }).select({ _id: 1, name: 1 }).lean(),
      SellerModel.find().sort({ createdAt: 1 }).select({ _id: 1, name: 1 }).lean(),
      BuyerModel.find(excludeDeletedStatusFilter())
        .sort({ displayId: 1, createdAt: 1 })
        .select({ _id: 1, displayId: 1, name: 1, company: 1, firstName: 1, lastName: 1 })
        .lean(),
    ]);

    const buyerNameById = new Map(
      buyers.map((buyer) => [buyer._id.toString(), resolveBuyerName(buyer)])
    );
    const buyerDisplayIdById = new Map(
      buyers.map((buyer) => [buyer._id.toString(), buyer.displayId ?? 0])
    );

    const deliveryMatch: Record<string, unknown> = {};

    if (dateFrom || dateTo) {
      deliveryMatch.postedAt = {
        ...(dateFrom ? { $gte: dateFrom } : {}),
        ...(dateTo ? { $lte: dateTo } : {}),
      };
    }

    if (productId && Types.ObjectId.isValid(productId)) {
      deliveryMatch.verticalRef = new Types.ObjectId(productId);
    }

    if (buyerId && Types.ObjectId.isValid(buyerId)) {
      deliveryMatch.buyerRef = new Types.ObjectId(buyerId);
    } else if (buyerId && !Types.ObjectId.isValid(buyerId)) {
      return NextResponse.json(buildEmptyResponse(page, pageSize, verticals, sellers, buyers));
    }

    if (publisherId && Types.ObjectId.isValid(publisherId)) {
      deliveryMatch.sellerRef = new Types.ObjectId(publisherId);
    } else if (publisherId && !Types.ObjectId.isValid(publisherId)) {
      return NextResponse.json(buildEmptyResponse(page, pageSize, verticals, sellers, buyers));
    }

    const deliveries = (await LeadDeliveryModel.find(deliveryMatch)
      .select({
        buyerRef: 1,
        sellerLeadRef: 1,
        buyerStatus: 1,
        price: 1,
      })
      .lean()) as DeliveryProjection[];

    const acceptLeadIds = new Set<string>();
    for (const delivery of deliveries) {
      if (delivery.buyerStatus === "Accept") {
        const leadId = refToString(delivery.sellerLeadRef);
        if (leadId) acceptLeadIds.add(leadId);
      }
    }

    const sellerLeadDocs =
      acceptLeadIds.size > 0
        ? await SellerLeadModel.find({ _id: { $in: [...acceptLeadIds] } })
            .select({ soldPrice: 1, redirectConfirmedAt: 1 })
            .lean()
        : [];

    const soldPriceByLeadId = new Map<string, number>();
    const redirectedLeadIds = new Set<string>();
    for (const lead of sellerLeadDocs) {
      const leadId = lead._id?.toString() ?? "";
      if (!leadId) continue;
      if (typeof lead.soldPrice === "number" && Number.isFinite(lead.soldPrice)) {
        soldPriceByLeadId.set(leadId, lead.soldPrice);
      }
      if (lead.redirectConfirmedAt) {
        redirectedLeadIds.add(leadId);
      }
    }

    const accumulators = new Map<string, BuyerAccumulator>();
    const ensureAccumulator = (id: string) => {
      let accumulator = accumulators.get(id);
      if (!accumulator) {
        accumulator = createAccumulator();
        accumulators.set(id, accumulator);
      }
      return accumulator;
    };

    for (const delivery of deliveries) {
      const buyerRefId = refToString(delivery.buyerRef);
      if (!buyerRefId) continue;

      const status = String(delivery.buyerStatus ?? "");
      const accumulator = ensureAccumulator(buyerRefId);
      const leadId = refToString(delivery.sellerLeadRef);

      if (status === "Skipped") {
        continue;
      }

      accumulator.post += 1;

      if (status === "Accept") {
        accumulator.accept += 1;
        if (typeof delivery.price === "number" && Number.isFinite(delivery.price)) {
          accumulator.ttl += delivery.price;
        }
        if (leadId) {
          accumulator.pub += soldPriceByLeadId.get(leadId) ?? 0;
          if (redirectedLeadIds.has(leadId)) {
            accumulator.redirect += 1;
          }
        }
      } else if (isRejectedStatus(status)) {
        accumulator.rejected += 1;
      } else if (status === "Error") {
        accumulator.sendError += 1;
      } else if (status === "Timeout") {
        accumulator.timeout += 1;
      }
    }

    const normalizedSearch = tableSearch.trim().toLowerCase();
    const rows: BuyerPerformanceRow[] = [];

    for (const [id, accumulator] of accumulators.entries()) {
      const name = buyerNameById.get(id) ?? "Unknown";
      const displayId = buyerDisplayIdById.get(id) ?? 0;
      const buyerLabel = displayId ? `[${displayId}] ${name}` : name;

      if (normalizedSearch && !buyerLabel.toLowerCase().includes(normalizedSearch)) {
        continue;
      }

      const metrics = finalizeBuyerPerformanceMetrics(accumulator);
      rows.push({ id, buyerLabel, ...metrics });
    }

    rows.sort((left, right) => right.ttl - left.ttl || right.post - left.post);

    const totals = computeTotals(rows);
    const totalItems = rows.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const start = (page - 1) * pageSize;
    const pageRows = rows.slice(start, start + pageSize);

    return NextResponse.json({
      items: pageRows,
      totals,
      page,
      pageSize,
      totalItems,
      totalPages,
      filters: {
        products: verticals.map((vertical, index) => ({
          id: vertical._id.toString(),
          label: formatProductLabel(vertical.name, index + 1),
        })),
        buyers: buyers.map((buyer) => ({
          id: buyer._id.toString(),
          label: buyer.displayId
            ? `[${buyer.displayId}] ${resolveBuyerName(buyer)}`
            : resolveBuyerName(buyer),
        })),
        publishers: sellers.map((seller, index) => ({
          id: seller._id.toString(),
          label: `[${index + 1001}] ${seller.name}`,
        })),
      },
    });
  } catch (error) {
    console.error("Failed to fetch buyer performance summary:", error);
    return NextResponse.json({ message: "Failed to fetch buyer performance summary." }, { status: 500 });
  }
}

function computeTotals(rows: BuyerPerformanceRow[]): BuyerPerformanceMetrics {
  if (rows.length === 0) {
    return emptyBuyerPerformanceMetrics();
  }

  const aggregate = rows.reduce(
    (accumulator, row) => {
      accumulator.post += row.post;
      accumulator.rejected += row.rejected;
      accumulator.accept += row.accept;
      accumulator.redirect += row.redirect;
      accumulator.pub += row.pub;
      accumulator.ttl += row.ttl;
      accumulator.sendError += row.sendError;
      accumulator.timeout += row.timeout;
      return accumulator;
    },
    {
      post: 0,
      rejected: 0,
      accept: 0,
      redirect: 0,
      pub: 0,
      ttl: 0,
      sendError: 0,
      timeout: 0,
    }
  );

  return finalizeBuyerPerformanceMetrics(aggregate);
}

function buildEmptyResponse(
  page: number,
  pageSize: number,
  verticals: Array<{ _id: { toString(): string }; name: string }>,
  sellers: Array<{ _id: { toString(): string }; name: string }>,
  buyers: Array<{
    _id: { toString(): string };
    displayId?: number | null;
    name?: string | null;
    company?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  }>
) {
  return {
    items: [],
    totals: emptyBuyerPerformanceMetrics(),
    page,
    pageSize,
    totalItems: 0,
    totalPages: 1,
    filters: {
      products: verticals.map((vertical, index) => ({
        id: vertical._id.toString(),
        label: formatProductLabel(vertical.name, index + 1),
      })),
      buyers: buyers.map((buyer) => ({
        id: buyer._id.toString(),
        label: buyer.displayId
          ? `[${buyer.displayId}] ${resolveBuyerName(buyer)}`
          : resolveBuyerName(buyer),
      })),
      publishers: sellers.map((seller, index) => ({
        id: seller._id.toString(),
        label: `[${index + 1001}] ${seller.name}`,
      })),
    },
  };
}
