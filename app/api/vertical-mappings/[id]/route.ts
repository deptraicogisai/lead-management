import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import { SellerModel } from "@/lib/models/seller";
import { ensureVerticalMappingReferencesMigrated, VerticalMappingModel } from "@/lib/models/vertical-mapping";
import { getCustomMappingFields } from "@/lib/mapping-fields";

type Params = { params: Promise<{ id: string }> };

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

export async function PATCH(req: Request, context: Params) {
  try {
    const { id } = await context.params;
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
      _id: { $ne: id },
      verticalRef: vertical._id,
      sellerRef: seller._id,
    }).lean();

    if (duplicate) {
      return NextResponse.json({ message: "Duplicate vertical and seller mapping." }, { status: 409 });
    }

    const mapping = await VerticalMappingModel.findById(id);
    if (!mapping) {
      return NextResponse.json({ message: "Vertical mapping not found." }, { status: 404 });
    }

    const customFields = getCustomMappingFields(
      (mapping.fields as Array<{
        sourceVerticalFieldId?: string;
        fieldName: string;
        description: string;
        type: string;
        required: boolean;
        format?: string;
      }> | undefined) ?? [],
      (vertical.fields as VerticalFieldDoc[] | undefined) ?? []
    ).map((field) => ({
      fieldName: field.fieldName,
      description: field.description,
      type: field.type,
      required: field.required,
      format: field.format,
      sourceVerticalFieldId: undefined,
    }));

    mapping.verticalRef = vertical._id;
    mapping.sellerRef = seller._id;
    mapping.set("fields", customFields);
    await mapping.save();

    return NextResponse.json(
      toMappingResponse({
        ...mapping.toObject(),
        sellerId: seller._id.toString(),
        verticalId: vertical._id.toString(),
        verticalFields: (vertical.fields as VerticalFieldDoc[] | undefined) ?? [],
      })
    );
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return NextResponse.json({ message: "Duplicate vertical and seller mapping." }, { status: 409 });
    }

    return NextResponse.json({ message: "Failed to update vertical mapping." }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: Params) {
  try {
    const { id } = await context.params;
    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    await ensureVerticalMappingReferencesMigrated();

    const mapping = await VerticalMappingModel.findByIdAndDelete(id).lean();
    if (!mapping) {
      return NextResponse.json({ message: "Vertical mapping not found." }, { status: 404 });
    }

    return NextResponse.json({ message: "Vertical mapping deleted." });
  } catch {
    return NextResponse.json({ message: "Failed to delete vertical mapping." }, { status: 500 });
  }
}
