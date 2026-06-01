import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureSellerCollectionMigrated, SellerModel } from "@/lib/models/seller";

type Params = { params: Promise<{ id: string }> };

type ApiFieldPayload = {
  fieldName?: string;
  description?: string;
  type?: string;
  required?: boolean;
  format?: string;
};

type ApiFieldDoc = {
  _id?: { toString(): string };
  fieldName: string;
  description: string;
  type: string;
  required: boolean;
  format?: string | null;
};

function toFieldResponse(doc: ApiFieldDoc) {
  return {
    id: doc._id?.toString() ?? "",
    fieldName: doc.fieldName,
    description: doc.description,
    type: doc.type,
    required: doc.required,
    format: doc.format,
  };
}

export async function GET(_: Request, context: Params) {
  try {
    const { id } = await context.params;
    await connectToDatabase();
    await ensureSellerCollectionMigrated();
    const seller = await SellerModel.findById(id).lean();
    if (!seller) {
      return NextResponse.json({ message: "Seller not found." }, { status: 404 });
    }

    const fields = (Array.isArray(seller.apiFields) ? seller.apiFields : []) as ApiFieldDoc[];
    return NextResponse.json(fields.map((field) => toFieldResponse(field)));
  } catch {
    return NextResponse.json({ message: "Failed to fetch API fields." }, { status: 500 });
  }
}

export async function POST(req: Request, context: Params) {
  try {
    const { id } = await context.params;
    const body = (await req.json()) as ApiFieldPayload;
    if (!body.fieldName?.trim() || !body.description?.trim() || !body.type?.trim()) {
      return NextResponse.json({ message: "Missing required fields." }, { status: 400 });
    }

    await connectToDatabase();
    await ensureSellerCollectionMigrated();
    const seller = await SellerModel.findById(id);
    if (!seller) {
      return NextResponse.json({ message: "Seller not found." }, { status: 404 });
    }

    const field = {
      fieldName: body.fieldName.trim(),
      description: body.description.trim(),
      type: body.type.trim(),
      required: Boolean(body.required),
      format: body.format?.trim() || undefined,
    };
    seller.apiFields.push(field);
    await seller.save();

    return NextResponse.json(toFieldResponse(field), { status: 201 });
  } catch {
    return NextResponse.json({ message: "Failed to create API field." }, { status: 500 });
  }
}
