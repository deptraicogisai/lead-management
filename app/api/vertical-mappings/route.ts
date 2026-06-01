import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import { SellerModel } from "@/lib/models/seller";
import { ensureVerticalMappingReferencesMigrated, VerticalMappingModel } from "@/lib/models/vertical-mapping";
import { getCustomMappingFields } from "@/lib/mapping-fields";
import { normalizeSearchParam, parsePageParam, parsePageSizeParam } from "@/lib/pagination";

type VerticalMappingPayload = {
  verticalId?: string;
  sellerId?: string;
};

type VerticalFieldDoc = {
  _id?: { toString(): string };
  fieldName: string;
  description: string;
  type: string;
  required: boolean;
  format?: string | null;
};

function toMappingResponse(doc: {
  _id?: { toString(): string };
  verticalId: string;
  sellerId: string;
  verticalFields?: VerticalFieldDoc[];
  apiRequest?: {
    apiKey: string;
    url: string;
    method: string;
  } | null;
  fields?: unknown;
}) {
  const fields = (doc.fields ?? []) as Array<{
    _id?: { toString(): string } | string;
    sourceVerticalFieldId?: string | null;
    fieldName: string;
    description: string;
    type: string;
    required: boolean;
    format?: string | null;
  }>;

  return {
    id: doc._id?.toString() ?? "",
    verticalId: doc.verticalId,
    sellerId: doc.sellerId,
    apiRequest: doc.apiRequest,
    fields: getCustomMappingFields(fields, doc.verticalFields ?? []).map((field) => ({
      id: typeof field._id === "string" ? field._id : field._id?.toString() ?? "",
      sourceVerticalFieldId: field.sourceVerticalFieldId,
      fieldName: field.fieldName,
      description: field.description,
      type: field.type,
      required: field.required,
      format: field.format,
    })),
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
    await ensureVerticalCollectionMigrated();
    await ensureVerticalMappingReferencesMigrated();

    let sellerIds: string[] = [];
    let verticalIds: string[] = [];
    if (search) {
      const [matchedSellers, matchedVerticals] = await Promise.all([
        SellerModel.find({ name: { $regex: search, $options: "i" } }, { _id: 1 }).lean(),
        VerticalModel.find({ name: { $regex: search, $options: "i" } }, { _id: 1 }).lean(),
      ]);
      sellerIds = matchedSellers.map((seller) => seller._id.toString());
      verticalIds = matchedVerticals.map((vertical) => vertical._id.toString());
    }

    const orConditions = search
      ? [
          ...(sellerIds.length > 0 ? [{ sellerRef: { $in: sellerIds } }] : []),
          ...(verticalIds.length > 0 ? [{ verticalRef: { $in: verticalIds } }] : []),
        ]
      : [];
    const filter = search ? (orConditions.length > 0 ? { $or: orConditions } : { _id: null }) : {};

    const totalItems = hasListParams ? await VerticalMappingModel.countDocuments(filter) : 0;
    const mappings = await VerticalMappingModel.find(filter)
      .sort({ createdAt: 1 })
      .skip(hasListParams ? (page - 1) * pageSize : 0)
      .limit(hasListParams ? pageSize : 0)
      .lean();
    const sellerRefs = mappings.map((mapping) => mapping.sellerRef).filter(Boolean);
    const verticalRefs = mappings.map((mapping) => mapping.verticalRef).filter(Boolean);
    const [sellers, verticals] = await Promise.all([
      SellerModel.find({ _id: { $in: sellerRefs } }, { _id: 1 }).lean(),
      VerticalModel.find({ _id: { $in: verticalRefs } }, { name: 1, fields: 1 }).lean(),
    ]);
    const sellerIdByRef = new Map(sellers.map((seller) => [seller._id.toString(), seller._id.toString()]));
    const verticalByRef = new Map(
      verticals.map((vertical) => [
        vertical._id.toString(),
        {
          verticalId: vertical._id.toString(),
          fields: (vertical.fields as VerticalFieldDoc[] | undefined) ?? [],
        },
      ])
    );

    const items = mappings
        .map((mapping) => {
          const sellerId = mapping.sellerRef ? sellerIdByRef.get(mapping.sellerRef.toString()) : undefined;
          const vertical = mapping.verticalRef ? verticalByRef.get(mapping.verticalRef.toString()) : undefined;
          if (!sellerId || !vertical) return null;

          return toMappingResponse({
            ...mapping,
            sellerId,
            verticalId: vertical.verticalId,
            verticalFields: vertical.fields,
          });
        })
        .filter((mapping): mapping is NonNullable<typeof mapping> => Boolean(mapping));

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
    return NextResponse.json({ message: "Failed to fetch vertical mappings." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as VerticalMappingPayload;
    if (!body.verticalId?.trim() || !body.sellerId?.trim()) {
      return NextResponse.json({ message: "Vertical and seller are required." }, { status: 400 });
    }

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    await ensureVerticalMappingReferencesMigrated();

    const [vertical, seller] = await Promise.all([
      VerticalModel.findById(body.verticalId.trim()).lean(),
      SellerModel.findById(body.sellerId.trim()).lean(),
    ]);

    if (!vertical) {
      return NextResponse.json({ message: "Vertical not found." }, { status: 404 });
    }

    if (!seller) {
      return NextResponse.json({ message: "Seller not found." }, { status: 404 });
    }

    const duplicate = await VerticalMappingModel.findOne({
      verticalRef: vertical._id,
      sellerRef: seller._id,
    }).lean();

    if (duplicate) {
      return NextResponse.json({ message: "Duplicate vertical and seller mapping." }, { status: 409 });
    }

    const mapping = await VerticalMappingModel.create({
      verticalRef: vertical._id,
      sellerRef: seller._id,
      fields: [],
    });

    return NextResponse.json(
      toMappingResponse({
        ...mapping.toObject(),
        sellerId: seller._id.toString(),
        verticalId: vertical._id.toString(),
        verticalFields: (vertical.fields as VerticalFieldDoc[] | undefined) ?? [],
      }),
      { status: 201 }
    );
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return NextResponse.json({ message: "Duplicate vertical and seller mapping." }, { status: 409 });
    }

    return NextResponse.json({ message: "Failed to create vertical mapping." }, { status: 500 });
  }
}
