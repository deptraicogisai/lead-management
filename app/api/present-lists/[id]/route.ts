import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { buildVerticalIndexMap } from "@/lib/integration-builder";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import { PresentListModel } from "@/lib/models/present-list";
import { connectToDatabase } from "@/lib/mongodb";
import { toPresentListRecord, toPresentListValueRecord, type PresentListType } from "@/lib/present-list";
import { normalizeSearchParam, parsePageParam } from "@/lib/pagination";

type Params = { params: Promise<{ id: string }> };

function parsePageSize(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 100;
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

export async function GET(req: Request, context: Params) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const page = parsePageParam(searchParams.get("page"), 1);
    const pageSize = parsePageSize(searchParams.get("pageSize"));
    const valueSearch = normalizeSearchParam(searchParams.get("search"));

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid list id." }, { status: 400 });
    }

    const list = await PresentListModel.findById(id).lean();
    if (!list) {
      return NextResponse.json({ message: "Present list not found." }, { status: 404 });
    }

    const lookup = await buildPresentListContext();
    const allValues = (list.values ?? []).map((value) => toPresentListValueRecord(value));
    const filteredValues = valueSearch
      ? allValues.filter((value) => value.value.toLowerCase().includes(valueSearch.toLowerCase()))
      : allValues;
    const totalItems = filteredValues.length;
    const items = filteredValues.slice((page - 1) * pageSize, page * pageSize);

    return NextResponse.json({
      list: toPresentListRecord(list, lookup),
      values: items,
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    });
  } catch {
    return NextResponse.json({ message: "Failed to fetch present list." }, { status: 500 });
  }
}

type PresentListPatchPayload = {
  name?: string;
  applyToField?: string;
  listType?: PresentListType;
  defaultExpirationPeriod?: string;
  allowApiAccess?: boolean;
  valueId?: string;
  value?: string;
  expirationDate?: string | null;
};

function parseExpirationDate(value: string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed;
}

export async function PATCH(req: Request, context: Params) {
  try {
    const { id } = await context.params;
    const body = (await req.json()) as PresentListPatchPayload;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid list id." }, { status: 400 });
    }

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();

    const list = await PresentListModel.findById(id);
    if (!list) {
      return NextResponse.json({ message: "Present list not found." }, { status: 404 });
    }

    if (body.valueId) {
      if (!Types.ObjectId.isValid(body.valueId)) {
        return NextResponse.json({ message: "Invalid value id." }, { status: 400 });
      }

      const valueEntry = list.values.id(body.valueId);
      if (!valueEntry) {
        return NextResponse.json({ message: "Value not found." }, { status: 404 });
      }

      if (body.value !== undefined) {
        const trimmedValue = body.value.trim();
        if (!trimmedValue) {
          return NextResponse.json({ message: "Value is required." }, { status: 400 });
        }

        const duplicate = list.values.some(
          (entry) =>
            entry._id?.toString() !== body.valueId && entry.value.trim().toLowerCase() === trimmedValue.toLowerCase()
        );
        if (duplicate) {
          return NextResponse.json({ message: "This value already exists in the list." }, { status: 400 });
        }

        valueEntry.value = trimmedValue;
      }

      if (body.expirationDate !== undefined) {
        const parsedExpiration = parseExpirationDate(body.expirationDate);
        if (parsedExpiration === undefined) {
          return NextResponse.json({ message: "Invalid expiration date." }, { status: 400 });
        }
        valueEntry.expirationDate = parsedExpiration;
      }

      await list.save();

      const lookup = await buildPresentListContext();
      return NextResponse.json({
        list: toPresentListRecord(list.toObject(), lookup),
        value: toPresentListValueRecord(valueEntry.toObject()),
      });
    }

    const hasMetadataUpdate =
      body.name !== undefined ||
      body.applyToField !== undefined ||
      body.listType !== undefined ||
      body.defaultExpirationPeriod !== undefined ||
      body.allowApiAccess !== undefined;

    if (!hasMetadataUpdate) {
      return NextResponse.json({ message: "No changes provided." }, { status: 400 });
    }

    if (body.name !== undefined) {
      const trimmedName = body.name.trim();
      if (!trimmedName) {
        return NextResponse.json({ message: "List name is required." }, { status: 400 });
      }
      list.name = trimmedName;
    }

    if (body.applyToField !== undefined) {
      const trimmedField = body.applyToField.trim();
      if (!trimmedField) {
        return NextResponse.json({ message: "Apply to field is required." }, { status: 400 });
      }

      const vertical = await VerticalModel.findById(list.verticalRef).lean();
      const fieldExists = (vertical?.fields ?? []).some((field) => field.fieldName === trimmedField);
      if (!fieldExists) {
        return NextResponse.json({ message: "Selected field was not found on this product." }, { status: 400 });
      }

      list.applyToField = trimmedField;
    }

    if (body.listType !== undefined) {
      if (!["PL", "DNPL"].includes(body.listType)) {
        return NextResponse.json({ message: "List type must be PL or DNPL." }, { status: 400 });
      }
      list.listType = body.listType;
    }

    if (body.defaultExpirationPeriod !== undefined) {
      list.defaultExpirationPeriod = body.defaultExpirationPeriod.trim() || "No expiration";
    }

    if (body.allowApiAccess !== undefined) {
      list.allowApiAccess = Boolean(body.allowApiAccess);
    }

    await list.save();

    const lookup = await buildPresentListContext();
    return NextResponse.json({ list: toPresentListRecord(list.toObject(), lookup) });
  } catch {
    return NextResponse.json({ message: "Failed to update present list." }, { status: 500 });
  }
}

export async function POST(req: Request, context: Params) {
  try {
    const { id } = await context.params;
    const body = (await req.json()) as { valuesText?: string };

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid list id." }, { status: 400 });
    }

    const list = await PresentListModel.findById(id);
    if (!list) {
      return NextResponse.json({ message: "Present list not found." }, { status: 404 });
    }

    const rawValues = (body.valuesText ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (rawValues.length === 0) {
      return NextResponse.json({ message: "At least one value is required." }, { status: 400 });
    }

    const existing = new Set((list.values ?? []).map((entry) => entry.value.toLowerCase()));
    let addedCount = 0;

    for (const value of rawValues) {
      const key = value.toLowerCase();
      if (existing.has(key)) continue;
      existing.add(key);
      list.values.push({ value });
      addedCount += 1;
    }

    await list.save();

    const lookup = await buildPresentListContext();

    return NextResponse.json({
      list: toPresentListRecord(list.toObject(), lookup),
      addedCount,
    });
  } catch {
    return NextResponse.json({ message: "Failed to add values." }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: Params) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const valueId = searchParams.get("valueId");

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid list id." }, { status: 400 });
    }

    const list = await PresentListModel.findById(id);
    if (!list) {
      return NextResponse.json({ message: "Present list not found." }, { status: 404 });
    }

    if (valueId) {
      const index = list.values.findIndex((entry) => entry._id?.toString() === valueId);
      if (index === -1) {
        return NextResponse.json({ message: "Value not found." }, { status: 404 });
      }
      list.values.splice(index, 1);
      await list.save();
      return NextResponse.json({ message: "Value deleted." });
    }

    await list.deleteOne();
    return NextResponse.json({ message: "Present list deleted." });
  } catch {
    return NextResponse.json({ message: "Failed to delete present list." }, { status: 500 });
  }
}
