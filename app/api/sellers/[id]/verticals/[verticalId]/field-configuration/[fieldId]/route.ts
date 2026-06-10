import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated } from "@/lib/models/industry";
import { ensureVerticalMappingReferencesMigrated } from "@/lib/models/vertical-mapping";
import { findSellerVerticalMapping } from "@/lib/seller-vertical-mapping";
import {
  type MappingFieldDoc,
  type MappingFieldPayload,
  normalizeMappingFieldConfig,
  normalizeMappingFieldOptions,
  toMappingFieldResponse,
} from "@/lib/mapping-field-api";

type Params = { params: Promise<{ id: string; verticalId: string; fieldId: string }> };

export async function PATCH(req: Request, context: Params) {
  try {
    const { id, verticalId, fieldId } = await context.params;
    const body = (await req.json()) as MappingFieldPayload;
    if (!body.fieldName?.trim() || !body.description?.trim() || !body.type?.trim()) {
      return NextResponse.json({ message: "Missing required fields." }, { status: 400 });
    }

    const normalizedConfig = normalizeMappingFieldConfig(body);
    if ("error" in normalizedConfig) {
      return NextResponse.json({ message: normalizedConfig.error }, { status: 400 });
    }

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    await ensureVerticalMappingReferencesMigrated();
    const mapping = await findSellerVerticalMapping(id, verticalId);

    if (!mapping) {
      return NextResponse.json({ message: "Vertical mapping not found." }, { status: 404 });
    }

    const field = mapping.fields.id(fieldId) as MappingFieldDoc | null;
    if (!field) {
      return NextResponse.json({ message: "Field not found." }, { status: 404 });
    }

    field.fieldName = body.fieldName.trim();
    field.description = body.description.trim();
    field.type = body.type.trim();
    field.required = Boolean(body.required);
    field.format = normalizedConfig.value.format;
    field.emailDuplicateRule = normalizedConfig.value.emailDuplicateRule;
    field.ignoreValues = normalizedConfig.value.ignoreValues;
    field.displayArrayMapping = Boolean(body.displayArrayMapping);
    field.dataTypeFilter = body.dataTypeFilter?.trim() || null;
    field.options = normalizeMappingFieldOptions(body.options) as typeof field.options;

    await mapping.save();

    return NextResponse.json(toMappingFieldResponse(field));
  } catch {
    return NextResponse.json({ message: "Failed to update field configuration." }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: Params) {
  try {
    const { id, verticalId, fieldId } = await context.params;
    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    await ensureVerticalMappingReferencesMigrated();

    const mapping = await findSellerVerticalMapping(id, verticalId);

    if (!mapping) {
      return NextResponse.json({ message: "Vertical mapping not found." }, { status: 404 });
    }

    const field = mapping.fields.id(fieldId);
    if (!field) {
      return NextResponse.json({ message: "Field not found." }, { status: 404 });
    }

    field.deleteOne();
    await mapping.save();

    return NextResponse.json({ message: "Field deleted." });
  } catch {
    return NextResponse.json({ message: "Failed to delete field configuration." }, { status: 500 });
  }
}
