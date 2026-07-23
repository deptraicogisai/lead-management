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
import { resolveJsonUploadFieldImport, type VerticalFieldRecord } from "@/lib/vertical-field";

type Params = { params: Promise<{ id: string; mappingId: string }> };

type ImportField = Omit<VerticalFieldRecord, "id">;

async function importMappingFieldsFromParsed(
  sellerId: string,
  mappingId: string,
  fields: ImportField[]
) {
  const mapping = await findSellerVerticalMappingById(sellerId, mappingId);
  if (!mapping) {
    return NextResponse.json({ message: "Seller API not found." }, { status: 404 });
  }

  mapping.set(
    "fields",
    fields.map((field) => ({
      fieldName: field.fieldName,
      description: field.description,
      type: field.type,
      required: field.required ?? false,
      format: field.format,
      emailDuplicateRule: field.emailDuplicateRule,
      ignoreValues: field.ignoreValues ?? [],
      displayArrayMapping: field.displayArrayMapping,
      dataTypeFilter: field.dataTypeFilter ?? null,
      options: field.options ?? [],
      sourceVerticalFieldId: undefined,
    }))
  );

  await mapping.save();

  return NextResponse.json({
    message: "Fields imported successfully.",
    count: fields.length,
  });
}

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
    const body = (await req.json()) as unknown;

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    await ensureVerticalMappingReferencesMigrated();

    const resolved = resolveJsonUploadFieldImport(body);

    if ("fields" in resolved) {
      return importMappingFieldsFromParsed(id, mappingId, resolved.fields);
    }

    if ("error" in resolved) {
      return NextResponse.json({ message: resolved.error }, { status: 400 });
    }

    const fieldBody = body as MappingFieldPayload;
    if (!fieldBody.fieldName?.trim() || !fieldBody.description?.trim() || !fieldBody.type?.trim()) {
      return NextResponse.json(
        {
          message:
            "Missing required fields. Upload a lead sample JSON object to create fields from its keys, or a field definition with fieldName, description, and type.",
        },
        { status: 400 }
      );
    }

    const normalizedConfig = normalizeMappingFieldConfig(fieldBody);
    if ("error" in normalizedConfig) {
      return NextResponse.json({ message: normalizedConfig.error }, { status: 400 });
    }

    const mapping = await findSellerVerticalMappingById(id, mappingId);
    if (!mapping) {
      return NextResponse.json({ message: "Seller API not found." }, { status: 404 });
    }

    const field = {
      fieldName: fieldBody.fieldName.trim(),
      description: fieldBody.description.trim(),
      type: fieldBody.type.trim(),
      required: Boolean(fieldBody.required),
      format: normalizedConfig.value.format,
      emailDuplicateRule: normalizedConfig.value.emailDuplicateRule,
      ignoreValues: normalizedConfig.value.ignoreValues,
      displayArrayMapping: Boolean(fieldBody.displayArrayMapping),
      dataTypeFilter: fieldBody.dataTypeFilter?.trim() || null,
      options: normalizeMappingFieldOptions(fieldBody.options),
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
