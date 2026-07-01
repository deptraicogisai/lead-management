import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated } from "@/lib/models/industry";
import { ensurePingTreeConfigDisplayIdMigrated } from "@/lib/models/ping-tree-config";
import { PublisherDistributionModel } from "@/lib/models/publisher-distribution";
import { SellerModel } from "@/lib/models/seller";
import { sortNewestFirst } from "@/lib/list-sort";
import {
  buildDistributionRecords,
  validateDistributionPayload,
  type DistributionPayload,
} from "@/lib/publisher-distribution-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: Params) {
  try {
    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Seller not found." }, { status: 404 });
    }

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    await ensurePingTreeConfigDisplayIdMigrated();

    const seller = await SellerModel.findById(id, { _id: 1 }).lean();
    if (!seller) {
      return NextResponse.json({ message: "Seller not found." }, { status: 404 });
    }

    const docs = await PublisherDistributionModel.find({ sellerRef: seller._id })
      .sort(sortNewestFirst)
      .lean();

    const records = await buildDistributionRecords(docs);
    return NextResponse.json(records);
  } catch {
    return NextResponse.json({ message: "Failed to fetch distribution settings." }, { status: 500 });
  }
}

export async function POST(req: Request, context: Params) {
  try {
    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Seller not found." }, { status: 404 });
    }

    const body = (await req.json()) as DistributionPayload;

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    await ensurePingTreeConfigDisplayIdMigrated();

    const seller = await SellerModel.findById(id, { _id: 1 }).lean();
    if (!seller) {
      return NextResponse.json({ message: "Seller not found." }, { status: 404 });
    }

    const validation = await validateDistributionPayload(id, body);
    if (!validation.ok) {
      return NextResponse.json({ message: validation.message }, { status: validation.status });
    }

    const { verticalRef, mappingRef, processingType, allocations } = validation.data;

    const existing = await PublisherDistributionModel.findOne({
      sellerRef: seller._id,
      verticalRef,
      mappingRef,
      processingType,
    }).lean();
    if (existing) {
      return NextResponse.json(
        {
          message:
            "A distribution already exists for this product, channel and type. Edit it instead of creating a new one.",
        },
        { status: 409 }
      );
    }

    const created = await PublisherDistributionModel.create({
      sellerRef: seller._id,
      verticalRef,
      mappingRef,
      processingType,
      allocations,
    });

    const [record] = await buildDistributionRecords([created.toObject()]);
    return NextResponse.json(record, { status: 201 });
  } catch {
    return NextResponse.json({ message: "Failed to create distribution setting." }, { status: 500 });
  }
}
