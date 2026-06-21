import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureSellerCollectionMigrated, SellerModel } from "@/lib/models/seller";
import { normalizeSearchParam, parsePageParam, parsePageSizeParam } from "@/lib/pagination";
import { resolveNewestFirstDisplayId, sortNewestFirst } from "@/lib/list-sort";

type SellerPayload = {
  name?: string;
  email?: string;
  region?: string;
  status?: "Active" | "Inactive";
};

function toSellerResponse(
  doc: {
    _id?: { toString(): string };
    name: string;
    email: string;
    region: string;
    status: "Active" | "Inactive";
    createdAt?: Date;
    apiFields?: Array<{
      _id?: { toString(): string };
      fieldName: string;
      description: string;
      type: string;
      required: boolean;
      format?: string;
    }>;
  },
  options?: { displayId?: number }
) {
  return {
    id: doc._id?.toString() ?? "",
    displayId: options?.displayId,
    name: doc.name,
    email: doc.email,
    region: doc.region,
    status: doc.status,
    createdAt: doc.createdAt?.toISOString() ?? null,
    apiFields: (doc.apiFields ?? []).map((field) => ({
      id: field._id?.toString() ?? "",
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
    const hasListParams = searchParams.has("page") || searchParams.has("pageSize");
    const page = parsePageParam(searchParams.get("page"), 1);
    const pageSize = parsePageSizeParam(searchParams.get("pageSize"), 15);
    const search = normalizeSearchParam(searchParams.get("search"));

    await connectToDatabase();
    await ensureSellerCollectionMigrated();

    const filter: Record<string, unknown> = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    if (!hasListParams) {
      const sellers = await SellerModel.find(filter).sort(sortNewestFirst).lean();
      const totalItems = sellers.length;
      return NextResponse.json(
        sellers.map((seller, index) =>
          toSellerResponse(seller, { displayId: resolveNewestFirstDisplayId(totalItems, 0, index) })
        )
      );
    }

    const totalItems = await SellerModel.countDocuments(filter);
    const skip = (page - 1) * pageSize;
    const sellers = await SellerModel.find(filter)
      .sort(sortNewestFirst)
      .skip(skip)
      .limit(pageSize)
      .lean();

    return NextResponse.json({
      items: sellers.map((seller, index) =>
        toSellerResponse(seller, { displayId: resolveNewestFirstDisplayId(totalItems, skip, index) })
      ),
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    });
  } catch {
    return NextResponse.json({ message: "Failed to fetch sellers." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SellerPayload;
    if (!body.name?.trim() || !body.email?.trim() || !body.status) {
      return NextResponse.json({ message: "Missing required fields." }, { status: 400 });
    }

    await connectToDatabase();
    await ensureSellerCollectionMigrated();
    const seller = await SellerModel.create({
      name: body.name.trim(),
      email: body.email.trim(),
      region: body.region?.trim() ?? "",
      status: body.status,
    });

    const totalItems = await SellerModel.countDocuments();

    return NextResponse.json(
      toSellerResponse(seller, { displayId: resolveNewestFirstDisplayId(totalItems, 0, 0) }),
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ message: "Failed to create seller." }, { status: 500 });
  }
}
