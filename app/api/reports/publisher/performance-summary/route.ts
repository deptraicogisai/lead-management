import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import { ensureSellerCollectionMigrated, SellerModel } from "@/lib/models/seller";
import { ensureSellerLeadReferencesMigrated, SellerLeadModel } from "@/lib/models/seller-lead";
import { LeadDeliveryModel } from "@/lib/models/lead-delivery";
import { formatProductLabel } from "@/lib/integration-builder";
import { normalizeSearchParam, parsePageParam } from "@/lib/pagination";
import {
  emptyPublisherPerformanceMetrics,
  finalizePublisherPerformanceMetrics,
  type PublisherPerformanceMetrics,
  type PublisherPerformanceRow,
} from "@/lib/publisher-performance-summary";

const DUP_WINDOWS_DAYS = [1, 14, 30, 45] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

type LeadProjection = {
  sellerRef?: { toString(): string } | string;
  validationStatus?: "success" | "fail";
  publisherStatus?: "Sold" | "Reject" | "Post Error" | "Test";
  soldPrice?: number | null;
  postedAt?: Date | string;
  payload?: Record<string, unknown>;
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

function readFingerprint(payload: Record<string, unknown> | undefined) {
  if (!payload) return "";

  const emailKeys = ["email", "email_address", "emailAddress", "Email"];
  for (const key of emailKeys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return `e:${value.trim().toLowerCase()}`;
    }
  }

  const phoneKeys = ["phone", "phone_number", "phoneNumber", "Phone", "phone1"];
  for (const key of phoneKeys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      const digits = value.replace(/\D/g, "");
      if (digits) return `p:${digits}`;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return `p:${String(value)}`;
    }
  }

  return "";
}

type PublisherAccumulator = {
  post: number;
  lead: number;
  sold: number;
  reject: number;
  redirect: number;
  pub: number;
  ttl: number;
  dupCounts: [number, number, number, number];
  // fingerprint -> last seen timestamp (ms), per publisher, for duplicate windows
  lastSeenByFingerprint: Map<string, number>;
};

function createAccumulator(): PublisherAccumulator {
  return {
    post: 0,
    lead: 0,
    sold: 0,
    reject: 0,
    redirect: 0,
    pub: 0,
    ttl: 0,
    dupCounts: [0, 0, 0, 0],
    lastSeenByFingerprint: new Map(),
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parsePageParam(searchParams.get("page"), 1);
    const pageSize = parsePageSize(searchParams.get("pageSize"));
    const dateFrom = parseDate(searchParams.get("dateFrom"));
    const dateTo = parseDate(searchParams.get("dateTo"));
    const productId = normalizeSearchParam(searchParams.get("productId"));
    const publisherId = normalizeSearchParam(searchParams.get("publisherId"));
    const publisherTag = normalizeSearchParam(searchParams.get("publisherTag"));
    const tableSearch = normalizeSearchParam(searchParams.get("tableSearch"));

    await connectToDatabase();
    await ensureSellerCollectionMigrated();
    await ensureVerticalCollectionMigrated();
    await ensureSellerLeadReferencesMigrated();

    const [verticals, sellers] = await Promise.all([
      VerticalModel.find().sort({ createdAt: 1 }).select({ _id: 1, name: 1 }).lean(),
      SellerModel.find().sort({ createdAt: 1 }).select({ _id: 1, name: 1, publisherTag: 1 }).lean(),
    ]);

    const sellerIndexById = new Map(sellers.map((seller, index) => [seller._id.toString(), index + 1001]));
    const sellerNameById = new Map(sellers.map((seller) => [seller._id.toString(), seller.name]));
    const sellerTagById = new Map(
      sellers.map((seller) => [seller._id.toString(), (seller.publisherTag ?? "").trim()])
    );

    // Resolve the set of publishers in scope (publisher + tag filters narrow this set).
    const tagFilteredSellerIds = publisherTag
      ? new Set(
          sellers
            .filter((seller) => (seller.publisherTag ?? "").trim() === publisherTag)
            .map((seller) => seller._id.toString())
        )
      : null;

    const leadMatch: Record<string, unknown> = {};
    const deliveryMatch: Record<string, unknown> = { buyerStatus: "Accept" };

    if (dateFrom || dateTo) {
      const range = {
        ...(dateFrom ? { $gte: dateFrom } : {}),
        ...(dateTo ? { $lte: dateTo } : {}),
      };
      leadMatch.postedAt = range;
      deliveryMatch.postedAt = range;
    }

    if (productId && Types.ObjectId.isValid(productId)) {
      leadMatch.verticalRef = new Types.ObjectId(productId);
      deliveryMatch.verticalRef = new Types.ObjectId(productId);
    }

    const scopedSellerObjectIds: Types.ObjectId[] = [];
    if (publisherId && Types.ObjectId.isValid(publisherId)) {
      scopedSellerObjectIds.push(new Types.ObjectId(publisherId));
    } else if (tagFilteredSellerIds) {
      for (const id of tagFilteredSellerIds) {
        if (Types.ObjectId.isValid(id)) scopedSellerObjectIds.push(new Types.ObjectId(id));
      }
    }

    if (scopedSellerObjectIds.length > 0) {
      leadMatch.sellerRef = { $in: scopedSellerObjectIds };
      deliveryMatch.sellerRef = { $in: scopedSellerObjectIds };
    } else if ((publisherId && !Types.ObjectId.isValid(publisherId)) || (tagFilteredSellerIds && tagFilteredSellerIds.size === 0)) {
      // Filter requested but resolved to no publishers -> empty result.
      return NextResponse.json(buildEmptyResponse(page, pageSize, verticals, sellers));
    }

    const [leads, deliveryTotals, redirectTotals] = await Promise.all([
      SellerLeadModel.find(leadMatch)
        .select({
          sellerRef: 1,
          validationStatus: 1,
          publisherStatus: 1,
          soldPrice: 1,
          postedAt: 1,
          "payload.email": 1,
          "payload.email_address": 1,
          "payload.emailAddress": 1,
          "payload.Email": 1,
          "payload.phone": 1,
          "payload.phone_number": 1,
          "payload.phoneNumber": 1,
          "payload.Phone": 1,
          "payload.phone1": 1,
        })
        .sort({ postedAt: 1 })
        .lean(),
      LeadDeliveryModel.aggregate<{ _id: Types.ObjectId | null; ttl: number }>([
        { $match: deliveryMatch },
        { $group: { _id: "$sellerRef", ttl: { $sum: { $ifNull: ["$price", 0] } } } },
      ]),
      SellerLeadModel.aggregate<{ _id: Types.ObjectId | null; redirect: number }>([
        {
          $match: {
            ...leadMatch,
            redirectConfirmedAt: { $ne: null },
          },
        },
        { $group: { _id: "$sellerRef", redirect: { $sum: 1 } } },
      ]),
    ]);

    const accumulators = new Map<string, PublisherAccumulator>();
    const ensureAccumulator = (sellerId: string) => {
      let accumulator = accumulators.get(sellerId);
      if (!accumulator) {
        accumulator = createAccumulator();
        accumulators.set(sellerId, accumulator);
      }
      return accumulator;
    };

    for (const lead of leads as LeadProjection[]) {
      const sellerId = refToString(lead.sellerRef);
      if (!sellerId) continue;

      const accumulator = ensureAccumulator(sellerId);
      accumulator.post += 1;

      const isValid = lead.validationStatus !== "fail";
      if (isValid) accumulator.lead += 1;

      if (lead.publisherStatus === "Sold") {
        accumulator.sold += 1;
        if (typeof lead.soldPrice === "number" && Number.isFinite(lead.soldPrice)) {
          accumulator.pub += lead.soldPrice;
        }
      } else if (lead.publisherStatus === "Reject" || lead.publisherStatus === "Post Error") {
        accumulator.reject += 1;
      }

      // Duplicate windows (leads sorted ascending by postedAt above).
      const fingerprint = readFingerprint(lead.payload);
      const postedTime = lead.postedAt ? new Date(lead.postedAt).getTime() : NaN;
      if (fingerprint && Number.isFinite(postedTime) && isValid) {
        const lastSeen = accumulator.lastSeenByFingerprint.get(fingerprint);
        if (lastSeen !== undefined) {
          const gapDays = (postedTime - lastSeen) / DAY_MS;
          DUP_WINDOWS_DAYS.forEach((windowDays, index) => {
            if (gapDays <= windowDays) accumulator.dupCounts[index] += 1;
          });
        }
        accumulator.lastSeenByFingerprint.set(fingerprint, postedTime);
      }
    }

    for (const entry of deliveryTotals) {
      const sellerId = entry._id ? entry._id.toString() : "";
      if (!sellerId) continue;
      ensureAccumulator(sellerId).ttl += entry.ttl ?? 0;
    }

    for (const entry of redirectTotals) {
      const sellerId = entry._id ? entry._id.toString() : "";
      if (!sellerId) continue;
      ensureAccumulator(sellerId).redirect = entry.redirect ?? 0;
    }

    const normalizedSearch = tableSearch.trim().toLowerCase();

    const rows: PublisherPerformanceRow[] = [];
    for (const [sellerId, accumulator] of accumulators.entries()) {
      const name = sellerNameById.get(sellerId) ?? "Unknown";
      const index = sellerIndexById.get(sellerId) ?? 0;
      const publisherLabel = index ? `[${index}] ${name}` : name;
      const tag = sellerTagById.get(sellerId) ?? "";

      if (normalizedSearch && !publisherLabel.toLowerCase().includes(normalizedSearch) && !tag.toLowerCase().includes(normalizedSearch)) {
        continue;
      }

      const lead = accumulator.lead;
      const metrics = finalizePublisherPerformanceMetrics({
        post: accumulator.post,
        lead,
        sold: accumulator.sold,
        reject: accumulator.reject,
        redirect: accumulator.redirect,
        pub: accumulator.pub,
        ttl: accumulator.ttl,
        ref: 0,
        agn: 0,
        dup1Rate: lead > 0 ? accumulator.dupCounts[0] / lead : 0,
        dup14Rate: lead > 0 ? accumulator.dupCounts[1] / lead : 0,
        dup30Rate: lead > 0 ? accumulator.dupCounts[2] / lead : 0,
        dup45Rate: lead > 0 ? accumulator.dupCounts[3] / lead : 0,
      });

      rows.push({ id: sellerId, publisherLabel, publisherTag: tag, ...metrics });
    }

    rows.sort((left, right) => right.pub - left.pub || right.post - left.post);

    const totals = computeTotals(rows);

    const totalItems = rows.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const start = (page - 1) * pageSize;
    const pageRows = rows.slice(start, start + pageSize);

    const publisherTagOptions = [
      ...new Set(
        sellers
          .map((seller) => (seller.publisherTag ?? "").trim())
          .filter((tag): tag is string => tag.length > 0)
      ),
    ].sort((left, right) => left.localeCompare(right));

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
        publishers: sellers.map((seller, index) => ({
          id: seller._id.toString(),
          label: `[${index + 1001}] ${seller.name}`,
        })),
        publisherTags: publisherTagOptions,
      },
    });
  } catch (error) {
    console.error("Failed to fetch publisher performance summary:", error);
    return NextResponse.json({ message: "Failed to fetch publisher performance summary." }, { status: 500 });
  }
}

function computeTotals(rows: PublisherPerformanceRow[]): PublisherPerformanceMetrics {
  if (rows.length === 0) {
    return emptyPublisherPerformanceMetrics();
  }

  const aggregate = rows.reduce(
    (accumulator, row) => {
      accumulator.post += row.post;
      accumulator.lead += row.lead;
      accumulator.sold += row.sold;
      accumulator.reject += row.reject;
      accumulator.redirect += row.redirect;
      accumulator.pub += row.pub;
      accumulator.ttl += row.ttl;
      accumulator.ref += row.ref;
      accumulator.agn += row.agn;
      accumulator.dup1 += Math.round(row.dup1Rate * row.lead);
      accumulator.dup14 += Math.round(row.dup14Rate * row.lead);
      accumulator.dup30 += Math.round(row.dup30Rate * row.lead);
      accumulator.dup45 += Math.round(row.dup45Rate * row.lead);
      return accumulator;
    },
    {
      post: 0,
      lead: 0,
      sold: 0,
      reject: 0,
      redirect: 0,
      pub: 0,
      ttl: 0,
      ref: 0,
      agn: 0,
      dup1: 0,
      dup14: 0,
      dup30: 0,
      dup45: 0,
    }
  );

  const lead = aggregate.lead;
  return finalizePublisherPerformanceMetrics({
    post: aggregate.post,
    lead,
    sold: aggregate.sold,
    reject: aggregate.reject,
    redirect: aggregate.redirect,
    pub: aggregate.pub,
    ttl: aggregate.ttl,
    ref: aggregate.ref,
    agn: aggregate.agn,
    dup1Rate: lead > 0 ? aggregate.dup1 / lead : 0,
    dup14Rate: lead > 0 ? aggregate.dup14 / lead : 0,
    dup30Rate: lead > 0 ? aggregate.dup30 / lead : 0,
    dup45Rate: lead > 0 ? aggregate.dup45 / lead : 0,
  });
}

function buildEmptyResponse(
  page: number,
  pageSize: number,
  verticals: Array<{ _id: { toString(): string }; name: string }>,
  sellers: Array<{ _id: { toString(): string }; name: string; publisherTag?: string | null }>
) {
  const publisherTagOptions = [
    ...new Set(
      sellers
        .map((seller) => (seller.publisherTag ?? "").trim())
        .filter((tag): tag is string => tag.length > 0)
    ),
  ].sort((left, right) => left.localeCompare(right));

  return {
    items: [],
    totals: emptyPublisherPerformanceMetrics(),
    page,
    pageSize,
    totalItems: 0,
    totalPages: 1,
    filters: {
      products: verticals.map((vertical, index) => ({
        id: vertical._id.toString(),
        label: formatProductLabel(vertical.name, index + 1),
      })),
      publishers: sellers.map((seller, index) => ({
        id: seller._id.toString(),
        label: `[${index + 1001}] ${seller.name}`,
      })),
      publisherTags: publisherTagOptions,
    },
  };
}
