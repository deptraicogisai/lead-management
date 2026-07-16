import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated } from "@/lib/models/industry";
import {
  ensurePingTreeConfigDisplayIdMigrated,
  getNextPingTreeConfigDisplayId,
  PingTreeConfigModel,
} from "@/lib/models/ping-tree-config";
import { DEFAULT_SILENT_POSTING_MODE, toPingTreeConfigRecord } from "@/lib/ping-tree-config";
import { buildPingTreeProductMap } from "@/lib/ping-tree-config-products";

type Params = { params: Promise<{ id: string }> };

export async function POST(_: Request, context: Params) {
  try {
    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Ping tree not found." }, { status: 404 });
    }

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    await ensurePingTreeConfigDisplayIdMigrated();

    const source = await PingTreeConfigModel.findById(id).lean();
    if (!source) {
      return NextResponse.json({ message: "Ping tree not found." }, { status: 404 });
    }

    const created = await PingTreeConfigModel.create({
      displayId: await getNextPingTreeConfigDisplayId(),
      name: `${source.name} (Copy)`,
      comment: source.comment ?? "",
      processingType: source.processingType,
      postingType: source.postingType ?? "Direct Post",
      silentPostingMode: source.silentPostingMode ?? DEFAULT_SILENT_POSTING_MODE,
      verticalRef: source.verticalRef,
      percent: 0,
      status: "Active",
    });

    const productMap = await buildPingTreeProductMap();
    const verticalId = created.verticalRef?.toString() ?? "";
    const product = productMap.get(verticalId) ?? {
      verticalId,
      verticalName: "Unknown",
      productLabel: "Unknown",
    };

    return NextResponse.json(toPingTreeConfigRecord(created.toObject(), product), { status: 201 });
  } catch {
    return NextResponse.json({ message: "Failed to duplicate ping tree." }, { status: 500 });
  }
}
