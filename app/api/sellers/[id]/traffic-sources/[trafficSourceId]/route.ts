import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { SellerModel } from "@/lib/models/seller";
import {
  normalizeTrafficSourceStatus,
  TrafficSourceModel,
  type TrafficSourceStatus,
} from "@/lib/models/traffic-source";

type Params = { params: Promise<{ id: string; trafficSourceId: string }> };

type UpdateTrafficSourcePayload = {
  status?: TrafficSourceStatus | "Disabled";
};

const VALID_STATUSES = ["Active", "Paused", "Deleted"] as const;

export async function PATCH(req: Request, context: Params) {
  try {
    const { id, trafficSourceId } = await context.params;
    const body = (await req.json()) as UpdateTrafficSourcePayload;

    if (!body.status) {
      return NextResponse.json({ message: "A valid status is required." }, { status: 400 });
    }

    const nextStatus = normalizeTrafficSourceStatus(body.status);
    if (!(VALID_STATUSES as readonly string[]).includes(nextStatus)) {
      return NextResponse.json({ message: "A valid status is required." }, { status: 400 });
    }

    await connectToDatabase();

    const seller = await SellerModel.findById(id, { _id: 1 }).lean();
    if (!seller) {
      return NextResponse.json({ message: "Seller not found." }, { status: 404 });
    }

    const source = await TrafficSourceModel.findOneAndUpdate(
      { _id: trafficSourceId, sellerRef: seller._id },
      { $set: { status: nextStatus } },
      { new: true }
    );

    if (!source) {
      return NextResponse.json({ message: "Traffic source not found." }, { status: 404 });
    }

    return NextResponse.json({
      message: "Traffic source updated.",
      status: normalizeTrafficSourceStatus(source.status),
    });
  } catch {
    return NextResponse.json({ message: "Failed to update traffic source." }, { status: 500 });
  }
}
