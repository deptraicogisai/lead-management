import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureSellerCollectionMigrated, SellerModel } from "@/lib/models/seller";

type Params = { params: Promise<{ id: string; fieldId: string }> };

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

export async function PATCH(req: Request, context: Params) {
  try {
    const { id, fieldId } = await context.params;
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

    const fields = (Array.isArray(seller.apiFields) ? seller.apiFields : []) as ApiFieldDoc[];
    const fieldIndex = fields.findIndex((item) => item._id?.toString() === fieldId);
    if (fieldIndex === -1) {
      return NextResponse.json({ message: "Field not found." }, { status: 404 });
    }

    fields[fieldIndex].fieldName = body.fieldName.trim();
    fields[fieldIndex].description = body.description.trim();
    fields[fieldIndex].type = body.type.trim();
    fields[fieldIndex].required = Boolean(body.required);
    fields[fieldIndex].format = body.format?.trim() || undefined;
    await seller.save();

    const field = fields[fieldIndex];

    if (!field) {
      return NextResponse.json({ message: "Field not found." }, { status: 404 });
    }

    return NextResponse.json(toFieldResponse(field));
  } catch {
    return NextResponse.json({ message: "Failed to update API field." }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: Params) {
  try {
    const { id, fieldId } = await context.params;
    await connectToDatabase();
    await ensureSellerCollectionMigrated();

    const seller = await SellerModel.findById(id);
    if (!seller) {
      return NextResponse.json({ message: "Seller not found." }, { status: 404 });
    }

    const fields = (Array.isArray(seller.apiFields) ? seller.apiFields : []) as ApiFieldDoc[];
    const fieldIndex = fields.findIndex((item) => item._id?.toString() === fieldId);
    if (fieldIndex === -1) {
      return NextResponse.json({ message: "Field not found." }, { status: 404 });
    }

    fields.splice(fieldIndex, 1);
    await seller.save();

    return NextResponse.json({ message: "Field deleted." });
  } catch {
    return NextResponse.json({ message: "Failed to delete API field." }, { status: 500 });
  }
}
