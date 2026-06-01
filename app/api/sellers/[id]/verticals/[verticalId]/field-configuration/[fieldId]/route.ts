import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import { ensureVerticalMappingReferencesMigrated, VerticalMappingModel } from "@/lib/models/vertical-mapping";

type Params = { params: Promise<{ id: string; verticalId: string; fieldId: string }> };

type MappingFieldPayload = {
  fieldName?: string;
  description?: string;
  type?: string;
  required?: boolean;
  format?: string;
  emailDuplicateRule?: {
    mode?: "days" | "forever";
    days?: number;
  };
  ignoreValues?: string[];
};

type MappingFieldDoc = {
  _id?: { toString(): string };
  fieldName: string;
  description: string;
  type: string;
  required: boolean;
  format?: string | null;
  emailDuplicateRule?: {
    mode?: "days" | "forever" | null;
    days?: number | null;
  } | null;
  ignoreValues?: string[] | null;
  sourceVerticalFieldId?: string | null;
};

function toFieldResponse(field: MappingFieldDoc) {
  return {
    id: field._id?.toString() ?? "",
    fieldName: field.fieldName,
    description: field.description,
    type: field.type,
    required: field.required,
    format: field.format ?? "",
    emailDuplicateRule: field.emailDuplicateRule?.mode
      ? {
          mode: field.emailDuplicateRule.mode,
          ...(field.emailDuplicateRule.mode === "days" && typeof field.emailDuplicateRule.days === "number"
            ? { days: field.emailDuplicateRule.days }
            : {}),
        }
      : undefined,
    ignoreValues: Array.isArray(field.ignoreValues) ? field.ignoreValues : [],
    sourceVerticalFieldId: field.sourceVerticalFieldId,
    isCustom: !field.sourceVerticalFieldId,
  };
}

function sanitizeIgnoreValues(ignoreValues?: string[]) {
  const seen = new Set<string>();

  return (ignoreValues ?? []).reduce<string[]>((accumulator, item) => {
    const normalized = item.trim();
    const dedupeKey = normalized.toLowerCase();

    if (!normalized || seen.has(dedupeKey)) {
      return accumulator;
    }

    seen.add(dedupeKey);
    accumulator.push(normalized);
    return accumulator;
  }, []);
}

function normalizeFieldConfig(body: MappingFieldPayload) {
  const normalizedType = body.type?.trim().toLowerCase() ?? "";
  const ignoreValues = normalizedType === "email" ? [] : sanitizeIgnoreValues(body.ignoreValues);

  if (normalizedType === "email") {
    const mode = body.emailDuplicateRule?.mode;

    if (mode !== "days" && mode !== "forever") {
      return { error: "Email duplicate rule is required for email fields." };
    }

    if (mode === "days") {
      const days = Number(body.emailDuplicateRule?.days);
      if (!Number.isInteger(days) || days <= 0) {
        return { error: "Duplicate email window must be a positive number of days." };
      }

      return {
        value: {
          format: "email",
          emailDuplicateRule: {
            mode,
            days,
          },
          ignoreValues,
        },
      };
    }

    return {
      value: {
        format: "email",
        emailDuplicateRule: {
          mode,
        },
        ignoreValues,
      },
    };
  }

  return {
    value: {
      format: body.format?.trim() || "",
      emailDuplicateRule: undefined,
      ignoreValues,
    },
  };
}

export async function PATCH(req: Request, context: Params) {
  try {
    const { id, verticalId, fieldId } = await context.params;
    const body = (await req.json()) as MappingFieldPayload;
    if (!body.fieldName?.trim() || !body.description?.trim() || !body.type?.trim()) {
      return NextResponse.json({ message: "Missing required fields." }, { status: 400 });
    }

    const normalizedConfig = normalizeFieldConfig(body);
    if ("error" in normalizedConfig) {
      return NextResponse.json({ message: normalizedConfig.error }, { status: 400 });
    }

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    await ensureVerticalMappingReferencesMigrated();
    const mapping = await VerticalMappingModel.findOne({
      sellerRef: id,
      verticalRef: verticalId,
    });

    if (!mapping) {
      return NextResponse.json({ message: "Vertical mapping not found." }, { status: 404 });
    }

    const vertical = mapping.verticalRef ? await VerticalModel.findById(mapping.verticalRef).lean() : null;
    if (!vertical) {
      return NextResponse.json({ message: "Vertical not found." }, { status: 404 });
    }

    if ((vertical?.fields ?? []).some((field) => field._id?.toString() === fieldId)) {
      return NextResponse.json(
        { message: "Inherited vertical fields cannot be updated here." },
        { status: 403 }
      );
    }

    const field = mapping.fields.id(fieldId) as MappingFieldDoc | null;
    if (!field) {
      return NextResponse.json({ message: "Field not found." }, { status: 404 });
    }

    if (field.sourceVerticalFieldId) {
      return NextResponse.json(
        { message: "Inherited vertical fields cannot be updated here." },
        { status: 403 }
      );
    }

    field.fieldName = body.fieldName.trim();
    field.description = body.description.trim();
    field.type = body.type.trim();
    field.required = Boolean(body.required);
    field.format = normalizedConfig.value.format;
    field.emailDuplicateRule = normalizedConfig.value.emailDuplicateRule;
    field.ignoreValues = normalizedConfig.value.ignoreValues;

    await mapping.save();

    return NextResponse.json(toFieldResponse(field));
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

    const mapping = await VerticalMappingModel.findOne({
      sellerRef: id,
      verticalRef: verticalId,
    });

    if (!mapping) {
      return NextResponse.json({ message: "Vertical mapping not found." }, { status: 404 });
    }

    const vertical = mapping.verticalRef ? await VerticalModel.findById(mapping.verticalRef).lean() : null;
    if (!vertical) {
      return NextResponse.json({ message: "Vertical not found." }, { status: 404 });
    }

    if ((vertical?.fields ?? []).some((field) => field._id?.toString() === fieldId)) {
      return NextResponse.json(
        { message: "Inherited vertical fields cannot be deleted here." },
        { status: 403 }
      );
    }

    const field = mapping.fields.id(fieldId);
    if (!field) {
      return NextResponse.json({ message: "Field not found." }, { status: 404 });
    }

    if (field.sourceVerticalFieldId) {
      return NextResponse.json(
        { message: "Inherited vertical fields cannot be deleted here." },
        { status: 403 }
      );
    }

    field.deleteOne();
    await mapping.save();

    return NextResponse.json({ message: "Field deleted." });
  } catch {
    return NextResponse.json({ message: "Failed to delete field configuration." }, { status: 500 });
  }
}
