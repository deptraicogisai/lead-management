import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import { resolveJsonUploadFieldImport } from "@/lib/vertical-field";
import { findVerticalById, findVerticalByIdLean, isValidVerticalId } from "@/lib/vertical-db";
import { toVerticalFieldResponse } from "@/lib/vertical-field-api";
import { importVerticalFields as persistImportedVerticalFields } from "@/lib/vertical-field-import";

type Params = { params: Promise<{ id: string }> };

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

async function importVerticalFieldsFromParsed(
  id: string,
  fields: Parameters<typeof persistImportedVerticalFields>[1]
) {
  if (!isValidVerticalId(id)) {
    return NextResponse.json({ message: "Invalid vertical id." }, { status: 400 });
  }

  return persistImportedVerticalFields(id, fields);
}

export async function GET(_: Request, context: Params) {
  try {
    const { id } = await context.params;

    if (!isValidVerticalId(id)) {
      return NextResponse.json({ message: "Invalid vertical id." }, { status: 400 });
    }

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    const vertical = await findVerticalByIdLean(id);

    if (!vertical) {
      return NextResponse.json({ message: "Vertical not found." }, { status: 404 });
    }

    return NextResponse.json((vertical.fields ?? []).map((field) => toVerticalFieldResponse(field)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch vertical fields.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(req: Request, context: Params) {
  try {
    const { id } = await context.params;
    const body = (await req.json()) as unknown;

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();

    const resolved = resolveJsonUploadFieldImport(body);

    if ("fields" in resolved) {
      return importVerticalFieldsFromParsed(id, resolved.fields);
    }

    if ("error" in resolved) {
      return NextResponse.json({ message: resolved.error }, { status: 400 });
    }

    const fieldBody = body as VerticalFieldPayload;

    if (!fieldBody.fieldName?.trim() || !fieldBody.description?.trim() || !fieldBody.type?.trim()) {
      return NextResponse.json(
        {
          message:
            "Missing required fields. Upload a lead sample JSON object to create fields from its keys, or a field definition with fieldName, description, and type.",
        },
        { status: 400 }
      );
    }

    const normalizedConfig = normalizeFieldConfig(fieldBody);
    if ("error" in normalizedConfig) {
      return NextResponse.json({ message: normalizedConfig.error }, { status: 400 });
    }

    const vertical = await findVerticalById(id);
    if (!vertical) {
      return NextResponse.json({ message: "Vertical not found." }, { status: 404 });
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
      options: Array.isArray(fieldBody.options)
        ? fieldBody.options.map((option) => ({
            label: option.label?.trim() ?? "",
            value: option.value?.trim() ?? "",
          }))
        : [],
    };

    vertical.fields.push(field);
    await vertical.save();

    return NextResponse.json(toVerticalFieldResponse(field), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save vertical fields.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
