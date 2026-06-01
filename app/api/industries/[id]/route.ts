import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";

type Params = { params: Promise<{ id: string }> };

type VerticalPayload = {
  name?: string;
  description?: string;
};

function toVerticalResponse(doc: {
  _id?: { toString(): string };
  name: string;
  description: string;
  fields?: Array<{
    _id?: { toString(): string };
    fieldName: string;
    description: string;
    type: string;
    required: boolean;
    format?: string | null;
  }>;
}) {
  return {
    id: doc._id?.toString() ?? "",
    name: doc.name,
    description: doc.description,
    fields: (doc.fields ?? []).map((field) => ({
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
    const body = (await req.json()) as VerticalPayload;
    if (!body.name?.trim() || !body.description?.trim()) {
      return NextResponse.json({ message: "Missing required fields." }, { status: 400 });
    }

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    const vertical = await VerticalModel.findByIdAndUpdate(
      id,
      {
        name: body.name.trim(),
        description: body.description.trim(),
      },
      { new: true }
    ).lean();

    if (!vertical) {
      return NextResponse.json({ message: "Vertical not found." }, { status: 404 });
    }

    return NextResponse.json(toVerticalResponse(vertical));
  } catch {
    return NextResponse.json({ message: "Failed to update vertical." }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: Params) {
  try {
    const { id } = await context.params;
    await connectToDatabase();
    await ensureVerticalCollectionMigrated();

    const vertical = await VerticalModel.findByIdAndDelete(id).lean();
    if (!vertical) {
      return NextResponse.json({ message: "Vertical not found." }, { status: 404 });
    }

    return NextResponse.json({ message: "Vertical deleted." });
  } catch {
    return NextResponse.json({ message: "Failed to delete vertical." }, { status: 500 });
  }
}
