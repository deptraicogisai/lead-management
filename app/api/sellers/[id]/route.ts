import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureSellerCollectionMigrated, SellerModel } from "@/lib/models/seller";
import { normalizePublisherTag } from "@/lib/publisher-tag";

type Params = { params: Promise<{ id: string }> };

type SellerPayload = {
  name?: string;
  email?: string;
  region?: string;
  publisherTag?: string;
  status?: "Active" | "Inactive";
};

function toSellerResponse(doc: {
  _id?: { toString(): string };
  name: string;
  email: string;
  region: string;
  publisherTag?: string;
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
    publisherTag: normalizePublisherTag(doc.publisherTag),
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

export async function PATCH(req: Request, context: Params) {
  try {
    const { id } = await context.params;
    const body = (await req.json()) as SellerPayload;
    if (!body.name?.trim() || !body.email?.trim() || !body.status) {
      return NextResponse.json({ message: "Missing required fields." }, { status: 400 });
    }

    await connectToDatabase();
    await ensureSellerCollectionMigrated();
    const seller = await SellerModel.findByIdAndUpdate(
      id,
      {
        name: body.name.trim(),
        email: body.email.trim(),
        region: body.region?.trim() ?? "",
        publisherTag: normalizePublisherTag(body.publisherTag),
        status: body.status,
      },
      { new: true }
    ).lean();

    if (!seller) {
      return NextResponse.json({ message: "Seller not found." }, { status: 404 });
    }

    return NextResponse.json(toSellerResponse(seller));
  } catch {
    return NextResponse.json({ message: "Failed to update seller." }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: Params) {
  try {
    const { id } = await context.params;
    await connectToDatabase();
    await ensureSellerCollectionMigrated();

    const seller = await SellerModel.findByIdAndDelete(id).lean();
    if (!seller) {
      return NextResponse.json({ message: "Seller not found." }, { status: 404 });
    }

    return NextResponse.json({ message: "Seller deleted." });
  } catch {
    return NextResponse.json({ message: "Failed to delete seller." }, { status: 500 });
  }
}
