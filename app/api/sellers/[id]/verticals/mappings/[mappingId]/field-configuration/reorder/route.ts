import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getEffectiveMappingFields } from "@/lib/mapping-fields";
import { ensureVerticalCollectionMigrated } from "@/lib/models/industry";
import { ensureVerticalMappingReferencesMigrated } from "@/lib/models/vertical-mapping";
import { ensureSellerVerticalMappingFieldsSeededById } from "@/lib/seller-vertical-mapping";
import { reorderDocumentsByIds, validateReorderFieldIds } from "@/lib/reorder-fields";

type Params = { params: Promise<{ id: string; mappingId: string }> };

export async function PATCH(req: Request, context: Params) {
  try {
    const { id, mappingId } = await context.params;
    const body = (await req.json()) as { fieldIds?: unknown };

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    await ensureVerticalMappingReferencesMigrated();

    const seeded = await ensureSellerVerticalMappingFieldsSeededById(id, mappingId);
    if (!seeded) {
      return NextResponse.json({ message: "Seller API not found." }, { status: 404 });
    }

    const { mapping, verticalFields } = seeded;

    const existingIds = mapping.fields.map((field) => field._id?.toString() ?? "").filter(Boolean);
    const validation = validateReorderFieldIds(existingIds, body.fieldIds);
    if ("error" in validation) {
      return NextResponse.json({ message: validation.error }, { status: 400 });
    }

    const reordered = reorderDocumentsByIds(mapping.fields, validation.value);
    if (!reordered) {
      return NextResponse.json({ message: "Failed to reorder fields." }, { status: 400 });
    }

    mapping.set("fields", reordered);
    await mapping.save();

    return NextResponse.json(getEffectiveMappingFields(verticalFields, mapping.fields));
  } catch {
    return NextResponse.json({ message: "Failed to reorder field configuration." }, { status: 500 });
  }
}
