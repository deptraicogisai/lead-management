import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import {
  ensurePingTreeConfigDisplayIdMigrated,
  getNextPingTreeConfigDisplayId,
  PingTreeConfigModel,
} from "@/lib/models/ping-tree-config";
import {
  isPingTreePostingType,
  isPingTreeProcessingType,
  toPingTreeConfigRecord,
} from "@/lib/ping-tree-config";
import { buildPingTreeProductMap } from "@/lib/ping-tree-config-products";
import { sortNewestFirst } from "@/lib/list-sort";
import { excludeDeletedStatusFilter, mergeMongoFilters } from "@/lib/soft-delete";

type CreatePingTreeConfigPayload = {
  name?: string;
  comment?: string;
  processingType?: string;
  postingType?: string;
  verticalId?: string;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const processingType = searchParams.get("processingType");
    const verticalId = searchParams.get("verticalId")?.trim() ?? "";
    const includeDeleted = searchParams.get("includeDeleted") === "true";

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    await ensurePingTreeConfigDisplayIdMigrated();

    const filters: Array<Record<string, unknown>> = [];
    if (isPingTreeProcessingType(processingType)) {
      filters.push({ processingType });
    }
    if (verticalId && Types.ObjectId.isValid(verticalId)) {
      filters.push({ verticalRef: new Types.ObjectId(verticalId) });
    }
    if (!includeDeleted) {
      filters.push(excludeDeletedStatusFilter());
    }

    const configs = await PingTreeConfigModel.find(mergeMongoFilters(...filters))
      .sort(sortNewestFirst)
      .lean();

    const productMap = await buildPingTreeProductMap();

    return NextResponse.json(
      configs.map((config) => {
        const verticalId = config.verticalRef?.toString() ?? "";
        const product = productMap.get(verticalId) ?? {
          verticalId,
          verticalName: "Unknown",
          productLabel: "Unknown",
        };
        return toPingTreeConfigRecord(config, product);
      })
    );
  } catch {
    return NextResponse.json({ message: "Failed to fetch ping trees." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreatePingTreeConfigPayload;

    if (!body.name?.trim()) {
      return NextResponse.json({ message: "Name is required." }, { status: 400 });
    }
    if (!isPingTreeProcessingType(body.processingType)) {
      return NextResponse.json({ message: "A valid processing type is required." }, { status: 400 });
    }
    if (!body.verticalId?.trim() || !Types.ObjectId.isValid(body.verticalId.trim())) {
      return NextResponse.json({ message: "A valid product is required." }, { status: 400 });
    }

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    await ensurePingTreeConfigDisplayIdMigrated();

    const vertical = await VerticalModel.findById(body.verticalId.trim(), { _id: 1 }).lean();
    if (!vertical) {
      return NextResponse.json({ message: "Product not found." }, { status: 404 });
    }

    const created = await PingTreeConfigModel.create({
      displayId: await getNextPingTreeConfigDisplayId(),
      name: body.name.trim(),
      comment: body.comment?.trim() || "",
      processingType: body.processingType,
      postingType: isPingTreePostingType(body.postingType) ? body.postingType : "Direct Post",
      verticalRef: vertical._id,
      percent: 0,
      status: "Active",
    });

    const productMap = await buildPingTreeProductMap();
    const product = productMap.get(vertical._id.toString()) ?? {
      verticalId: vertical._id.toString(),
      verticalName: "Unknown",
      productLabel: "Unknown",
    };

    return NextResponse.json(toPingTreeConfigRecord(created.toObject(), product), { status: 201 });
  } catch {
    return NextResponse.json({ message: "Failed to create ping tree." }, { status: 500 });
  }
}
