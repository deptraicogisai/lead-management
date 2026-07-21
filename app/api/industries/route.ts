import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import { normalizeSearchParam, parsePageParam, parsePageSizeParam } from "@/lib/pagination";
import { resolveNewestFirstDisplayId, sortNewestFirst } from "@/lib/list-sort";
import { buildMongoStatusFilter, mergeMongoFilters } from "@/lib/soft-delete";

type VerticalPayload = {
  name?: string;
  description?: string;
  status?: "Active" | "Deleted";
};

function toVerticalResponse(
  doc: {
    _id?: { toString(): string };
    name: string;
    description: string;
    status?: string | null;
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
  },
  options?: { displayId?: number }
) {
  return {
    id: doc._id?.toString() ?? "",
    displayId: options?.displayId,
    name: doc.name,
    description: doc.description,
    status: doc.status === "Deleted" ? "Deleted" : "Active",
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
    const statusFilter = normalizeSearchParam(searchParams.get("status"));
    const filter = mergeMongoFilters(
      buildMongoStatusFilter(statusFilter || "All"),
      search
        ? {
            $or: [
              { name: { $regex: search, $options: "i" } },
              { description: { $regex: search, $options: "i" } },
            ],
          }
        : {}
    );

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    if (!hasListParams) {
      const verticals = await VerticalModel.find().sort(sortNewestFirst).lean();
      const totalItems = verticals.length;
      return NextResponse.json(
        verticals.map((vertical, index) =>
          toVerticalResponse(vertical, { displayId: resolveNewestFirstDisplayId(totalItems, 0, index) })
        )
      );
    }

    const totalItems = await VerticalModel.countDocuments(filter);
    const skip = (page - 1) * pageSize;
    const verticals = await VerticalModel.find(filter)
      .sort(sortNewestFirst)
      .skip(skip)
      .limit(pageSize)
      .lean();

    return NextResponse.json({
      items: verticals.map((vertical, index) =>
        toVerticalResponse(vertical, { displayId: resolveNewestFirstDisplayId(totalItems, skip, index) })
      ),
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

    const totalItems = await VerticalModel.countDocuments(buildMongoStatusFilter("All"));
    return NextResponse.json(
      toVerticalResponse(vertical, { displayId: resolveNewestFirstDisplayId(totalItems, 0, 0) }),
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ message: "Failed to create vertical." }, { status: 500 });
  }
}
