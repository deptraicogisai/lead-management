import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { buildVerticalIndexMap } from "@/lib/integration-builder";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import { connectToDatabase } from "@/lib/mongodb";
import { getNextPresentListDisplayId, PresentListModel } from "@/lib/models/present-list";
import { toPresentListRecord, type PresentListType } from "@/lib/present-list";
import { normalizeSearchParam, parsePageParam } from "@/lib/pagination";

type PresentListPayload = {
  name?: string;
  verticalId?: string;
  applyToField?: string;
  listType?: PresentListType;
  defaultExpirationPeriod?: string;
};

function parsePageSize(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 15;
  return Math.min(parsed, 1000);
}

async function buildPresentListContext() {
  await connectToDatabase();
  await ensureVerticalCollectionMigrated();

  const verticals = await VerticalModel.find().sort({ createdAt: 1 }).select({ _id: 1, name: 1 }).lean();
  const verticalIds = verticals.map((vertical) => vertical._id.toString());

  return {
    verticalNameById: new Map(verticals.map((vertical) => [vertical._id.toString(), vertical.name])),
    verticalIndexById: buildVerticalIndexMap(verticalIds),
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parsePageParam(searchParams.get("page"), 1);
    const pageSize = parsePageSize(searchParams.get("pageSize"));
    const productId = normalizeSearchParam(searchParams.get("productId"));
    const listType = normalizeSearchParam(searchParams.get("listType"));
    const nameFilter = normalizeSearchParam(searchParams.get("name"));

    const filter: Record<string, unknown> = {};

    if (productId && Types.ObjectId.isValid(productId)) {
      filter.verticalRef = productId;
    }

    if (listType && listType !== "All") {
      filter.listType = listType;
    }

    if (nameFilter) {
      filter.name = { $regex: nameFilter, $options: "i" };
    }

    const context = await buildPresentListContext();
    const [totalItems, lists] = await Promise.all([
      PresentListModel.countDocuments(filter),
      PresentListModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    return NextResponse.json({
      items: lists.map((list) => toPresentListRecord(list, context)),
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    });
  } catch {
    return NextResponse.json({ message: "Failed to fetch present lists." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PresentListPayload;

    if (!body.name?.trim()) {
      return NextResponse.json({ message: "List name is required." }, { status: 400 });
    }

    if (!body.verticalId?.trim() || !Types.ObjectId.isValid(body.verticalId.trim())) {
      return NextResponse.json({ message: "A valid product is required." }, { status: 400 });
    }

    if (!body.applyToField?.trim()) {
      return NextResponse.json({ message: "Apply to field is required." }, { status: 400 });
    }

    if (!body.listType || !["PL", "DNPL"].includes(body.listType)) {
      return NextResponse.json({ message: "List type is required." }, { status: 400 });
    }

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();

    const vertical = await VerticalModel.findById(body.verticalId.trim()).lean();
    if (!vertical) {
      return NextResponse.json({ message: "Selected product was not found." }, { status: 404 });
    }

    const fieldExists = (vertical.fields ?? []).some((field) => field.fieldName === body.applyToField?.trim());
    if (!fieldExists) {
      return NextResponse.json({ message: "Selected field was not found on this product." }, { status: 400 });
    }

    const displayId = await getNextPresentListDisplayId();
    const list = await PresentListModel.create({
      displayId,
      name: body.name.trim(),
      verticalRef: body.verticalId.trim(),
      applyToField: body.applyToField.trim(),
      listType: body.listType,
      defaultExpirationPeriod: body.defaultExpirationPeriod?.trim() || "No expiration",
      values: [],
    });

    const context = await buildPresentListContext();

    return NextResponse.json(toPresentListRecord(list.toObject(), context), { status: 201 });
  } catch {
    return NextResponse.json({ message: "Failed to create present list." }, { status: 500 });
  }
}
