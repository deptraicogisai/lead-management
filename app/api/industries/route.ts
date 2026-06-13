import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import { normalizeSearchParam, parsePageParam, parsePageSizeParam } from "@/lib/pagination";
import { sortNewestFirst } from "@/lib/list-sort";

type VerticalPayload = {
  name?: string;
  description?: string;
};

function toVerticalResponse(doc: {
  _id?: { toString(): string };
  name: string;
  description: string;
  fields?: Array<{
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
  }>;
}) {
  return {
    id: doc._id?.toString() ?? "",
    name: doc.name,
    description: doc.description,
    fields: (doc.fields ?? []).map((field) => ({
      id: field._id?.toString() ?? "",
      fieldName: field.fieldName,
      description: field.description,
      type: field.type,
      required: field.required,
      format: field.format,
      emailDuplicateRule: field.emailDuplicateRule?.mode
        ? {
            mode: field.emailDuplicateRule.mode,
            ...(field.emailDuplicateRule.mode === "days" && typeof field.emailDuplicateRule.days === "number"
              ? { days: field.emailDuplicateRule.days }
              : {}),
          }
        : undefined,
      ignoreValues: Array.isArray(field.ignoreValues) ? field.ignoreValues : [],
    })),
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const hasListParams = searchParams.has("page") || searchParams.has("pageSize") || searchParams.has("search");
    const page = parsePageParam(searchParams.get("page"), 1);
    const pageSize = parsePageSizeParam(searchParams.get("pageSize"), 10);
    const search = normalizeSearchParam(searchParams.get("search"));
    const filter = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    if (!hasListParams) {
      const verticals = await VerticalModel.find().sort(sortNewestFirst).lean();
      return NextResponse.json(verticals.map((vertical) => toVerticalResponse(vertical)));
    }

    const totalItems = await VerticalModel.countDocuments(filter);
    const verticals = await VerticalModel.find(filter)
      .sort(sortNewestFirst)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean();

    return NextResponse.json({
      items: verticals.map((vertical) => toVerticalResponse(vertical)),
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    });
  } catch {
    return NextResponse.json({ message: "Failed to fetch verticals." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as VerticalPayload;
    if (!body.name?.trim() || !body.description?.trim()) {
      return NextResponse.json({ message: "Missing required fields." }, { status: 400 });
    }

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    const vertical = await VerticalModel.create({
      name: body.name.trim(),
      description: body.description.trim(),
    });

    return NextResponse.json(toVerticalResponse(vertical), { status: 201 });
  } catch {
    return NextResponse.json({ message: "Failed to create vertical." }, { status: 500 });
  }
}
