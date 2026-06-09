import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated } from "@/lib/models/industry";
import { findVerticalById, isValidVerticalId } from "@/lib/vertical-db";
import { toVerticalFieldResponse } from "@/lib/vertical-field-api";

type Params = { params: Promise<{ id: string; fieldId: string }> };

type VerticalFieldPayload = {
  fieldName?: string;
  description?: string;
  type?: string;
  required?: boolean;
  format?: string;
  displayArrayMapping?: boolean;
  dataTypeFilter?: string | null;
  options?: Array<{
    label?: string;
    value?: string;
  }>;
  emailDuplicateRule?: {
    mode?: "days" | "forever";
    days?: number;
  };
  ignoreValues?: string[];
};

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

function normalizeFieldConfig(body: VerticalFieldPayload) {
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
      format: body.format?.trim() || undefined,
      emailDuplicateRule: undefined,
      ignoreValues,
    },
  };
}

export async function PATCH(req: Request, context: Params) {
  try {
    const { id, fieldId } = await context.params;
    const body = (await req.json()) as VerticalFieldPayload;

    if (!body.fieldName?.trim() || !body.description?.trim() || !body.type?.trim()) {
      return NextResponse.json({ message: "Missing required fields." }, { status: 400 });
    }

    const normalizedConfig = normalizeFieldConfig(body);
    if ("error" in normalizedConfig) {
      return NextResponse.json({ message: normalizedConfig.error }, { status: 400 });
    }

    if (!isValidVerticalId(id)) {
      return NextResponse.json({ message: "Invalid vertical id." }, { status: 400 });
    }

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    const vertical = await findVerticalById(id);
    if (!vertical) {
      return NextResponse.json({ message: "Vertical not found." }, { status: 404 });
    }

    const fields = Array.isArray(vertical.fields) ? vertical.fields : [];
    const fieldIndex = fields.findIndex((item) => item._id?.toString() === fieldId);
    if (fieldIndex === -1) {
      return NextResponse.json({ message: "Field not found." }, { status: 404 });
    }

    fields[fieldIndex].fieldName = body.fieldName.trim();
    fields[fieldIndex].description = body.description.trim();
    fields[fieldIndex].type = body.type.trim();
    fields[fieldIndex].required = Boolean(body.required);
    fields[fieldIndex].format = normalizedConfig.value.format;
    fields[fieldIndex].emailDuplicateRule = normalizedConfig.value.emailDuplicateRule;
    fields[fieldIndex].ignoreValues = normalizedConfig.value.ignoreValues;
    fields[fieldIndex].displayArrayMapping = Boolean(body.displayArrayMapping);
    fields[fieldIndex].dataTypeFilter = body.dataTypeFilter?.trim() || null;
    fields[fieldIndex].options = (
      Array.isArray(body.options)
        ? body.options.map((option) => ({
            label: option.label?.trim() ?? "",
            value: option.value?.trim() ?? "",
          }))
        : []
    ) as typeof fields[number]["options"];

    await vertical.save();

    return NextResponse.json(toVerticalFieldResponse(fields[fieldIndex]));
  } catch {
    return NextResponse.json({ message: "Failed to update vertical field." }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: Params) {
  try {
    const { id, fieldId } = await context.params;

    if (!isValidVerticalId(id)) {
      return NextResponse.json({ message: "Invalid vertical id." }, { status: 400 });
    }

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();

    const vertical = await findVerticalById(id);
    if (!vertical) {
      return NextResponse.json({ message: "Vertical not found." }, { status: 404 });
    }

    const field = vertical.fields.find((item) => item._id?.toString() === fieldId);
    if (!field) {
      return NextResponse.json({ message: "Field not found." }, { status: 404 });
    }

    field.deleteOne();
    await vertical.save();

    return NextResponse.json({ message: "Field deleted." });
  } catch {
    return NextResponse.json({ message: "Failed to delete vertical field." }, { status: 500 });
  }
}
