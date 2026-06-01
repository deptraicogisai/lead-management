import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureSellerCollectionMigrated, SellerModel } from "@/lib/models/seller";
import { normalizeSearchParam, parsePageParam, parsePageSizeParam } from "@/lib/pagination";

type SellerPayload = {
  name?: string;
  email?: string;
  region?: string;
  status?: "Active" | "Inactive";
};

function toSellerResponse(doc: {
  _id?: { toString(): string };
  name: string;
  email: string;
  region: string;
  status: "Active" | "Inactive";
  apiFields?: Array<{
    _id?: { toString(): string };
    fieldName: string;
    description: string;
    type: string;
    required: boolean;
    format?: string;
  }>;
}) {
  return {
    id: doc._id?.toString() ?? "",
    name: doc.name,
    email: doc.email,
    region: doc.region,
    status: doc.status,
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
    const hasListParams = searchParams.has("page") || searchParams.has("pageSize") || searchParams.has("search");
    const page = parsePageParam(searchParams.get("page"), 1);
    const pageSize = parsePageSizeParam(searchParams.get("pageSize"), 10);
    const search = normalizeSearchParam(searchParams.get("search"));
    const filter = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { region: { $regex: search, $options: "i" } },
            { status: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    await connectToDatabase();
    await ensureSellerCollectionMigrated();
    if (!hasListParams) {
      const sellers = await SellerModel.find().sort({ createdAt: 1 }).lean();
      return NextResponse.json(sellers.map((seller) => toSellerResponse(seller)));
    }

    const totalItems = await SellerModel.countDocuments(filter);
    const sellers = await SellerModel.find(filter)
      .sort({ createdAt: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean();

    return NextResponse.json({
      items: sellers.map((seller) => toSellerResponse(seller)),
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
    if (!body.name?.trim() || !body.email?.trim() || !body.region?.trim() || !body.status) {
      return NextResponse.json({ message: "Missing required fields." }, { status: 400 });
    }

    await connectToDatabase();
    await ensureSellerCollectionMigrated();
    const seller = await SellerModel.create({
      name: body.name.trim(),
      email: body.email.trim(),
      region: body.region.trim(),
      status: body.status,
    });

    return NextResponse.json(toSellerResponse(seller), { status: 201 });
  } catch {
    return NextResponse.json({ message: "Failed to create seller." }, { status: 500 });
  }
}
