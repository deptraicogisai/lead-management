import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";

type Params = { params: Promise<{ id: string }> };

type VerticalFieldPayload = {
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

function toFieldResponse(doc: {
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
}) {
  return {
    id: doc._id?.toString() ?? "",
    fieldName: doc.fieldName,
    description: doc.description,
    type: doc.type,
    required: doc.required,
    format: doc.format,
    emailDuplicateRule: doc.emailDuplicateRule?.mode
      ? {
          mode: doc.emailDuplicateRule.mode,
          ...(doc.emailDuplicateRule.mode === "days" && typeof doc.emailDuplicateRule.days === "number"
            ? { days: doc.emailDuplicateRule.days }
            : {}),
        }
      : undefined,
    ignoreValues: Array.isArray(doc.ignoreValues) ? doc.ignoreValues : [],
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

export async function GET(_: Request, context: Params) {
  try {
    const { id } = await context.params;
    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    const vertical = await VerticalModel.findById(id).lean();

    if (!vertical) {
      return NextResponse.json({ message: "Vertical not found." }, { status: 404 });
    }

    return NextResponse.json((vertical.fields ?? []).map((field) => toFieldResponse(field)));
  } catch {
    return NextResponse.json({ message: "Failed to fetch vertical fields." }, { status: 500 });
  }
}

export async function POST(req: Request, context: Params) {
  try {
    const { id } = await context.params;
    const body = (await req.json()) as VerticalFieldPayload;

    if (!body.fieldName?.trim() || !body.description?.trim() || !body.type?.trim()) {
      return NextResponse.json({ message: "Missing required fields." }, { status: 400 });
    }

    const normalizedConfig = normalizeFieldConfig(body);
    if ("error" in normalizedConfig) {
      return NextResponse.json({ message: normalizedConfig.error }, { status: 400 });
    }

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    const vertical = await VerticalModel.findById(id);
    if (!vertical) {
      return NextResponse.json({ message: "Vertical not found." }, { status: 404 });
    }

    const field = {
      fieldName: body.fieldName.trim(),
      description: body.description.trim(),
      type: body.type.trim(),
      required: Boolean(body.required),
      format: normalizedConfig.value.format,
      emailDuplicateRule: normalizedConfig.value.emailDuplicateRule,
      ignoreValues: normalizedConfig.value.ignoreValues,
    };

    vertical.fields.push(field);
    await vertical.save();

    return NextResponse.json(toFieldResponse(field), { status: 201 });
  } catch {
    return NextResponse.json({ message: "Failed to create vertical field." }, { status: 500 });
  }
}
