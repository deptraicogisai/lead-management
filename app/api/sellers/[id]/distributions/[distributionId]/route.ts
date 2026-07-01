import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated } from "@/lib/models/industry";
import { ensurePingTreeConfigDisplayIdMigrated } from "@/lib/models/ping-tree-config";
import { PublisherDistributionModel } from "@/lib/models/publisher-distribution";
import {
  buildDistributionRecords,
  validateDistributionPayload,
  type DistributionPayload,
} from "@/lib/publisher-distribution-service";

type Params = { params: Promise<{ id: string; distributionId: string }> };

export async function PATCH(req: Request, context: Params) {
  try {
    const { id, distributionId } = await context.params;
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(distributionId)) {
      return NextResponse.json({ message: "Distribution not found." }, { status: 404 });
    }

    const body = (await req.json()) as DistributionPayload;

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    await ensurePingTreeConfigDisplayIdMigrated();

    const sellerRef = new Types.ObjectId(id);
    const existing = await PublisherDistributionModel.findOne({ _id: distributionId, sellerRef });
    if (!existing) {
      return NextResponse.json({ message: "Distribution not found." }, { status: 404 });
    }

    const validation = await validateDistributionPayload(id, body);
    if (!validation.ok) {
      return NextResponse.json({ message: validation.message }, { status: validation.status });
    }

    const { verticalRef, mappingRef, processingType, allocations } = validation.data;

    const duplicate = await PublisherDistributionModel.findOne({
      _id: { $ne: existing._id },
      sellerRef,
      verticalRef,
      mappingRef,
      processingType,
    }).lean();
    if (duplicate) {
      return NextResponse.json(
        {
          message:
            "Another distribution already exists for this product, channel and type.",
        },
        { status: 409 }
      );
    }

    existing.set({ verticalRef, mappingRef, processingType, allocations });
    await existing.save();

    const [record] = await buildDistributionRecords([existing.toObject()]);
    return NextResponse.json(record);
  } catch {
    return NextResponse.json({ message: "Failed to update distribution setting." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: Params) {
  try {
    const { id, distributionId } = await context.params;
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(distributionId)) {
      return NextResponse.json({ message: "Distribution not found." }, { status: 404 });
    }

    await connectToDatabase();

    const result = await PublisherDistributionModel.deleteOne({
      _id: distributionId,
      sellerRef: new Types.ObjectId(id),
    });
    if (result.deletedCount === 0) {
      return NextResponse.json({ message: "Distribution not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ message: "Failed to delete distribution setting." }, { status: 500 });
  }
}
