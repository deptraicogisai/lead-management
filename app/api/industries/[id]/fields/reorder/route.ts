import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated } from "@/lib/models/industry";
import { findVerticalById, isValidVerticalId } from "@/lib/vertical-db";
import { reorderDocumentsByIds, validateReorderFieldIds } from "@/lib/reorder-fields";
import { toVerticalFieldResponse } from "@/lib/vertical-field-api";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: Params) {
  try {
    const { id } = await context.params;
    if (!isValidVerticalId(id)) {
      return NextResponse.json({ message: "Vertical not found." }, { status: 404 });
    }

    const body = (await req.json()) as { fieldIds?: unknown };

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();

    const vertical = await findVerticalById(id);
    if (!vertical) {
      return NextResponse.json({ message: "Vertical not found." }, { status: 404 });
    }

    const fields = Array.isArray(vertical.fields) ? vertical.fields : [];
    const existingIds = fields.map((field) => field._id?.toString() ?? "").filter(Boolean);
    const validation = validateReorderFieldIds(existingIds, body.fieldIds);
    if ("error" in validation) {
      return NextResponse.json({ message: validation.error }, { status: 400 });
    }

    const reordered = reorderDocumentsByIds(fields, validation.value);
    if (!reordered) {
      return NextResponse.json({ message: "Failed to reorder fields." }, { status: 400 });
    }

    vertical.set("fields", reordered);
    await vertical.save();

    return NextResponse.json(reordered.map((field) => toVerticalFieldResponse(field)));
  } catch {
    return NextResponse.json({ message: "Failed to reorder fields." }, { status: 500 });
  }
}
