import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureSellerCollectionMigrated, SellerModel } from "@/lib/models/seller";
import { ensureSellerLeadReferencesMigrated, SellerLeadModel } from "@/lib/models/seller-lead";
import { normalizeSearchParam, parsePageParam, parsePageSizeParam } from "@/lib/pagination";

type LeadDoc = {
  _id?: { toString(): string };
  sellerRef?: { toString(): string } | string;
  payload: Record<string, unknown>;
  validationStatus: "success" | "fail";
  validationErrors?: string[];
  postedAt?: Date | string;
  userAgent?: string;
  createdAt?: Date | string;
};

type DeleteLeadsPayload = {
  ids?: string[];
  deleteAll?: boolean;
};

function toLeadResponse(doc: LeadDoc, sellerName: string) {
  const postedAt = doc.postedAt instanceof Date ? doc.postedAt : doc.postedAt ? new Date(doc.postedAt) : doc.createdAt ? new Date(doc.createdAt) : null;

  return {
    id: doc._id?.toString() ?? "",
    sellerName,
    rawData: JSON.stringify(doc.payload),
    status: doc.validationStatus === "success" ? "Accept" : "Reject",
    postedAt: postedAt ? postedAt.toISOString() : "",
    userAgent: doc.userAgent ?? "Unknown",
    reasons: doc.validationErrors ?? [],
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const hasListParams = searchParams.has("page") || searchParams.has("pageSize") || searchParams.has("search");
    const page = parsePageParam(searchParams.get("page"), 1);
    const pageSize = parsePageSizeParam(searchParams.get("pageSize"), 10);
    const search = normalizeSearchParam(searchParams.get("search"));

    await connectToDatabase();
    await ensureSellerCollectionMigrated();
    await ensureSellerLeadReferencesMigrated();

    let sellerIds: string[] = [];
    if (search) {
      const matchedSellers = await SellerModel.find(
        { name: { $regex: search, $options: "i" } },
        { _id: 1 }
      ).lean();
      sellerIds = matchedSellers.map((seller) => seller._id.toString());
    }

    const normalizedSearch = search.toLowerCase();
    const orConditions: Array<Record<string, unknown>> = [];

    if (sellerIds.length > 0) {
      orConditions.push({ sellerRef: { $in: sellerIds } });
    }
    if (normalizedSearch.includes("accept")) {
      orConditions.push({ validationStatus: "success" });
    }
    if (normalizedSearch.includes("reject") || normalizedSearch.includes("fail")) {
      orConditions.push({ validationStatus: "fail" });
    }
    orConditions.push({ userAgent: { $regex: search, $options: "i" } });
    orConditions.push({ validationErrors: { $elemMatch: { $regex: search, $options: "i" } } });

    const finalFilter: Record<string, unknown> = search ? { $or: orConditions } : {};

    const totalItems = hasListParams ? await SellerLeadModel.countDocuments(finalFilter) : 0;
    const leads = await SellerLeadModel.find(finalFilter)
      .sort({ postedAt: -1, createdAt: -1 })
      .skip(hasListParams ? (page - 1) * pageSize : 0)
      .limit(hasListParams ? pageSize : 0)
      .lean();

    const sellerRefs = leads.map((lead) => lead.sellerRef).filter(Boolean);
    const sellers = await SellerModel.find({ _id: { $in: sellerRefs } }, { name: 1 }).lean();
    const sellerIdByRef = new Map(sellers.map((seller) => [seller._id.toString(), seller.name]));

    const items = leads.map((lead) =>
      toLeadResponse(
        lead as LeadDoc,
        lead.sellerRef ? sellerIdByRef.get(typeof lead.sellerRef === "string" ? lead.sellerRef : lead.sellerRef.toString()) ?? "" : ""
      )
    );

    if (!hasListParams) {
      return NextResponse.json(items);
    }

    return NextResponse.json({
      items,
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    });
  } catch {
    return NextResponse.json({ message: "Failed to fetch leads." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as DeleteLeadsPayload;
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === "string" && Types.ObjectId.isValid(id))
      : [];

    if (!body.deleteAll && ids.length === 0) {
      return NextResponse.json({ message: "No lead items selected." }, { status: 400 });
    }

    await connectToDatabase();
    await ensureSellerLeadReferencesMigrated();

    const result = body.deleteAll
      ? await SellerLeadModel.deleteMany({})
      : await SellerLeadModel.deleteMany({ _id: { $in: ids } });

    return NextResponse.json({
      deletedCount: result.deletedCount ?? 0,
    });
  } catch {
    return NextResponse.json({ message: "Failed to delete leads." }, { status: 500 });
  }
}
