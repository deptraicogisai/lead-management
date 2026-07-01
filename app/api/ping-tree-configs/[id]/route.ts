import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import { PingTreeConfigModel } from "@/lib/models/ping-tree-config";
import {
  isPingTreePostingType,
  toPingTreeConfigRecord,
} from "@/lib/ping-tree-config";
import { buildPingTreeProductMap } from "@/lib/ping-tree-config-products";
import { softDeleteUpdate } from "@/lib/soft-delete";

type Params = { params: Promise<{ id: string }> };

type UpdatePingTreeConfigPayload = {
  name?: string;
  comment?: string;
  postingType?: string;
  verticalId?: string;
  status?: "Active" | "Disabled" | "Deleted";
};

const VALID_STATUSES = ["Active", "Disabled", "Deleted"];

export async function PATCH(req: Request, context: Params) {
  try {
    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Ping tree not found." }, { status: 404 });
    }

    const body = (await req.json()) as UpdatePingTreeConfigPayload;

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();

    const config = await PingTreeConfigModel.findById(id);
    if (!config) {
      return NextResponse.json({ message: "Ping tree not found." }, { status: 404 });
    }

    if (typeof body.name === "string") {
      if (!body.name.trim()) {
        return NextResponse.json({ message: "Name is required." }, { status: 400 });
      }
      config.name = body.name.trim();
    }

    if (typeof body.comment === "string") {
      config.comment = body.comment.trim();
    }

    if (isPingTreePostingType(body.postingType)) {
      config.postingType = body.postingType;
    }

    if (typeof body.verticalId === "string" && body.verticalId.trim()) {
      if (!Types.ObjectId.isValid(body.verticalId.trim())) {
        return NextResponse.json({ message: "A valid product is required." }, { status: 400 });
      }
      const vertical = await VerticalModel.findById(body.verticalId.trim(), { _id: 1 }).lean();
      if (!vertical) {
        return NextResponse.json({ message: "Product not found." }, { status: 404 });
      }
      config.verticalRef = vertical._id;
    }

    if (typeof body.status === "string") {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json({ message: "A valid status is required." }, { status: 400 });
      }
      config.status = body.status;
    }

    await config.save();

    const productMap = await buildPingTreeProductMap();
    const verticalId = config.verticalRef?.toString() ?? "";
    const product = productMap.get(verticalId) ?? {
      verticalId,
      verticalName: "Unknown",
      productLabel: "Unknown",
    };

    return NextResponse.json(toPingTreeConfigRecord(config.toObject(), product));
  } catch {
    return NextResponse.json({ message: "Failed to update ping tree." }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: Params) {
  try {
    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Ping tree not found." }, { status: 404 });
    }

    await connectToDatabase();

    const config = await PingTreeConfigModel.findByIdAndUpdate(id, { $set: softDeleteUpdate() });
    if (!config) {
      return NextResponse.json({ message: "Ping tree not found." }, { status: 404 });
    }

    return NextResponse.json({ message: "Ping tree deleted." });
  } catch {
    return NextResponse.json({ message: "Failed to delete ping tree." }, { status: 500 });
  }
}
