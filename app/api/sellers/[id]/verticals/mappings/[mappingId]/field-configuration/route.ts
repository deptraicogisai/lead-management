import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated } from "@/lib/models/industry";
import { ensureVerticalMappingReferencesMigrated } from "@/lib/models/vertical-mapping";
import { getEffectiveMappingFields } from "@/lib/mapping-fields";
import {
  ensureSellerVerticalMappingFieldsSeededById,
  findSellerVerticalMappingById,
} from "@/lib/seller-vertical-mapping";
import {
  type MappingFieldDoc,
  type MappingFieldPayload,
  normalizeMappingFieldConfig,
  normalizeMappingFieldOptions,
  toMappingFieldResponse,
} from "@/lib/mapping-field-api";

type Params = { params: Promise<{ id: string; mappingId: string }> };

export async function GET(_: Request, context: Params) {
  try {
    const { id, mappingId } = await context.params;
    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    await ensureVerticalMappingReferencesMigrated();

    const seeded = await ensureSellerVerticalMappingFieldsSeededById(id, mappingId);
    if (!seeded) {
      return NextResponse.json({ message: "Seller API not found." }, { status: 404 });
    }

    return NextResponse.json(getEffectiveMappingFields(seeded.verticalFields, seeded.mappingFields));
  } catch {
    return NextResponse.json({ message: "Failed to fetch field configuration." }, { status: 500 });
  }
}

export async function POST(req: Request, context: Params) {
  try {
    const { id, mappingId } = await context.params;
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

    const mapping = await findSellerVerticalMappingById(id, mappingId);
    if (!mapping) {
      return NextResponse.json({ message: "Seller API not found." }, { status: 404 });
    }

    const field = {
      fieldName: body.fieldName.trim(),
      description: body.description.trim(),
      type: body.type.trim(),
      required: Boolean(body.required),
      format: normalizedConfig.value.format,
      emailDuplicateRule: normalizedConfig.value.emailDuplicateRule,
      ignoreValues: normalizedConfig.value.ignoreValues,
      displayArrayMapping: Boolean(body.displayArrayMapping),
      dataTypeFilter: body.dataTypeFilter?.trim() || null,
      options: normalizeMappingFieldOptions(body.options),
      sourceVerticalFieldId: undefined,
    };

    mapping.fields.push(field);
    await mapping.save();

    const createdField = mapping.fields[mapping.fields.length - 1] as MappingFieldDoc;
    return NextResponse.json(toMappingFieldResponse(createdField), { status: 201 });
  } catch {
    return NextResponse.json({ message: "Failed to create field configuration." }, { status: 500 });
  }
}
