import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { softDeleteUpdate } from "@/lib/soft-delete";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import { IntegrationBuilderModel } from "@/lib/models/integration-builder";
import {
  buildVerticalIndexMap,
  toIntegrationBuilderRecord,
  type IntegrationBuilderArrayMappingEntry,
  type IntegrationBuilderConfigField,
  type IntegrationBuilderRequestMapping,
  type IntegrationBuilderResponseMapping,
  type IntegrationBuilderStatus,
} from "@/lib/integration-builder";
import { validateRequestMappingTwigPayload, validateResponseMappingTwigPayload, buildTwigConfigFieldsFromIntegration } from "@/lib/twig-template";

type Params = { params: Promise<{ id: string }> };

type IntegrationBuilderPayload = {
  name?: string;
  status?: IntegrationBuilderStatus;
  arrayMappings?: IntegrationBuilderArrayMappingEntry[];
  requestMapping?: Partial<IntegrationBuilderRequestMapping>;
  responseMapping?: IntegrationBuilderResponseMapping;
  configFields?: IntegrationBuilderConfigField[];
};

type IntegrationBuilderDoc = {
  _id?: { toString(): string };
  displayId: number;
  name: string;
  status: IntegrationBuilderStatus;
  verticalRef?: { toString(): string } | string | null;
  arrayMappings?: IntegrationBuilderArrayMappingEntry[] | null;
  requestMapping?: IntegrationBuilderRequestMapping | null;
  responseMapping?: IntegrationBuilderResponseMapping | null;
  configFields?: IntegrationBuilderConfigField[] | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

async function buildTwigValidationContext(
  existing: {
    verticalRef?: { toString(): string } | string | null;
    configFields?: IntegrationBuilderConfigField[] | { toObject(): IntegrationBuilderConfigField[] } | null;
    arrayMappings?: IntegrationBuilderArrayMappingEntry[] | { toObject(): IntegrationBuilderArrayMappingEntry[] } | null;
  },
  body: IntegrationBuilderPayload
) {
  const verticalId =
    typeof existing.verticalRef === "string" ? existing.verticalRef : existing.verticalRef?.toString() ?? "";

  let leadFieldNames: string[] = [];

  if (Types.ObjectId.isValid(verticalId)) {
    const vertical = await VerticalModel.findById(verticalId).select({ fields: 1 }).lean();
    const fields = vertical?.fields;

    if (Array.isArray(fields)) {
      leadFieldNames = fields
        .map((field) => (field as { fieldName?: string }).fieldName?.trim() ?? "")
        .filter(Boolean);
    }
  }

  const configSource =
    body.configFields ??
    (existing.configFields && typeof existing.configFields === "object" && "toObject" in existing.configFields
      ? (existing.configFields as { toObject(): IntegrationBuilderConfigField[] }).toObject()
      : (existing.configFields as IntegrationBuilderConfigField[] | null));

  const integrationConfigFields = buildTwigConfigFieldsFromIntegration(
    Array.isArray(configSource) ? configSource : null
  );

  const arrayMappingSource =
    body.arrayMappings ??
    (existing.arrayMappings && typeof existing.arrayMappings === "object" && "toObject" in existing.arrayMappings
      ? (existing.arrayMappings as { toObject(): IntegrationBuilderArrayMappingEntry[] }).toObject()
      : (existing.arrayMappings as IntegrationBuilderArrayMappingEntry[] | null));

  const arrayMappingSlugs = (Array.isArray(arrayMappingSource) ? arrayMappingSource : [])
    .map((entry) => ({
      slug: entry.slug?.trim() ?? "",
      fieldName: entry.fieldName?.trim() ?? "",
    }))
    .filter((entry) => entry.slug);

  return { leadFieldNames, integrationConfigFields, arrayMappingSlugs };
}

async function getVerticalMaps() {
  const verticals = await VerticalModel.find().sort({ createdAt: 1 }).select({ _id: 1, name: 1 }).lean();
  const verticalIds = verticals.map((vertical) => vertical._id.toString());
  const verticalNameById = new Map(verticals.map((vertical) => [vertical._id.toString(), vertical.name]));
  const verticalIndexById = buildVerticalIndexMap(verticalIds);

  return { verticalNameById, verticalIndexById };
}

export async function GET(_req: Request, context: Params) {
  try {
    const { id } = await context.params;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid integration builder id." }, { status: 400 });
    }

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();

    const record = await IntegrationBuilderModel.findById(id).lean();
    if (!record) {
      return NextResponse.json({ message: "Integration builder record not found." }, { status: 404 });
    }

    const { verticalNameById, verticalIndexById } = await getVerticalMaps();

    return NextResponse.json(
      toIntegrationBuilderRecord(record as IntegrationBuilderDoc, verticalNameById, verticalIndexById)
    );
  } catch {
    return NextResponse.json({ message: "Failed to fetch integration builder record." }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: Params) {
  try {
    const { id } = await context.params;
    const body = (await req.json()) as IntegrationBuilderPayload;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid integration builder id." }, { status: 400 });
    }

    if (!body.name?.trim() && !body.arrayMappings && !body.requestMapping && !body.responseMapping && !body.configFields) {
      return NextResponse.json({ message: "Name is required." }, { status: 400 });
    }

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();

    const existing = await IntegrationBuilderModel.findById(id);
    if (!existing) {
      return NextResponse.json({ message: "Integration builder record not found." }, { status: 404 });
    }

    if (body.name?.trim()) {
      existing.name = body.name.trim();
    }

    if (body.status) {
      existing.status = body.status;
    }

    if (body.arrayMappings) {
      existing.set(
        "arrayMappings",
        body.arrayMappings.map((entry) => ({
          fieldName: entry.fieldName.trim(),
          slug: entry.slug.trim(),
          mappings: entry.mappings.map((row) => ({
            label: row.label.trim(),
            mapping: row.mapping ?? "",
          })),
        }))
      );
    }

    if (body.configFields) {
      existing.set(
        "configFields",
        body.configFields.map((field) => ({
          variableName: field.variableName.trim(),
          label: field.label.trim(),
          type: field.type.trim() || "string",
          required: Boolean(field.required),
        }))
      );
    }

    if (body.responseMapping) {
      const twigValidationContext = await buildTwigValidationContext(existing, body);
      const twigError = validateResponseMappingTwigPayload(body.responseMapping, twigValidationContext);

      if (twigError) {
        return NextResponse.json({ message: twigError }, { status: 400 });
      }

      existing.set("responseMapping", {
        dataType: body.responseMapping.dataType?.trim() || "JSON",
        fields: body.responseMapping.fields.map((field) => ({
          key: field.key.trim(),
          value: field.value ?? "",
        })),
      });
    }

    if (body.requestMapping) {
      const twigValidationContext = await buildTwigValidationContext(existing, body);
      const twigError = validateRequestMappingTwigPayload(body.requestMapping, twigValidationContext);

      if (twigError) {
        return NextResponse.json({ message: twigError }, { status: 400 });
      }

      const currentRequestMapping = existing.requestMapping as
        | IntegrationBuilderRequestMapping
        | ({ toObject(): IntegrationBuilderRequestMapping } & IntegrationBuilderRequestMapping)
        | null
        | undefined;
      const current: Partial<IntegrationBuilderRequestMapping> = currentRequestMapping
        ? "toObject" in currentRequestMapping && typeof (currentRequestMapping as { toObject?: unknown }).toObject === "function"
          ? (currentRequestMapping as { toObject(): IntegrationBuilderRequestMapping }).toObject()
          : currentRequestMapping
        : {};

      existing.set("requestMapping", {
        requestUrl:
          body.requestMapping.requestUrl !== undefined
            ? body.requestMapping.requestUrl.trim()
            : (current.requestUrl ?? "{{ config.url }}"),
        methodType:
          body.requestMapping.methodType !== undefined
            ? body.requestMapping.methodType.trim()
            : (current.methodType ?? "POST"),
        dataType:
          body.requestMapping.dataType !== undefined
            ? body.requestMapping.dataType.trim()
            : (current.dataType ?? "JSON"),
        payloadType:
          body.requestMapping.payloadType !== undefined
            ? body.requestMapping.payloadType.trim()
            : (current.payloadType ?? "Object"),
        isPrePingEnabled:
          body.requestMapping.isPrePingEnabled !== undefined
            ? Boolean(body.requestMapping.isPrePingEnabled)
            : Boolean(current.isPrePingEnabled),
        headers:
          body.requestMapping.headers !== undefined
            ? body.requestMapping.headers.map((row) => ({
                key: row.key.trim(),
                value: row.value ?? "",
              }))
            : (current.headers ?? []),
        dataRows:
          body.requestMapping.dataRows !== undefined
            ? body.requestMapping.dataRows.map((row) => ({
                name: row.name.trim(),
                type: row.type.trim() || "String",
                value: row.value ?? "",
              }))
            : (current.dataRows ?? []),
      });
    }

    await existing.save();
    const record = existing.toObject();

    const { verticalNameById, verticalIndexById } = await getVerticalMaps();

    return NextResponse.json(
      toIntegrationBuilderRecord(record as IntegrationBuilderDoc, verticalNameById, verticalIndexById)
    );
  } catch {
    return NextResponse.json({ message: "Failed to update integration builder record." }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: Params) {
  try {
    const { id } = await context.params;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid integration builder id." }, { status: 400 });
    }

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();

    const objectId = new Types.ObjectId(id);
    const record = await IntegrationBuilderModel.findById(objectId).lean();
    if (!record) {
      return NextResponse.json({ message: "Integration builder record not found." }, { status: 404 });
    }

    await IntegrationBuilderModel.findByIdAndUpdate(objectId, softDeleteUpdate());

    return NextResponse.json({ message: "Integration builder record removed." });
  } catch {
    return NextResponse.json({ message: "Failed to remove integration builder record." }, { status: 500 });
  }
}
