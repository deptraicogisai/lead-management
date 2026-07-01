import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { SellerModel } from "@/lib/models/seller";
import { TrafficSourceModel } from "@/lib/models/traffic-source";

type Params = { params: Promise<{ id: string; trafficSourceId: string }> };

type UpdateTrafficSourcePayload = {
  status?: "Active" | "Disabled" | "Deleted";
};

const VALID_STATUSES = ["Active", "Disabled", "Deleted"];

export async function PATCH(req: Request, context: Params) {
  try {
    const { id, trafficSourceId } = await context.params;
    const body = (await req.json()) as UpdateTrafficSourcePayload;

    if (!body.status || !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ message: "A valid status is required." }, { status: 400 });
    }

    await connectToDatabase();

    const seller = await SellerModel.findById(id, { _id: 1 }).lean();
    if (!seller) {
      return NextResponse.json({ message: "Seller not found." }, { status: 404 });
    }

    const source = await TrafficSourceModel.findOneAndUpdate(
      { _id: trafficSourceId, sellerRef: seller._id },
      { $set: { status: body.status } },
      { new: true }
    );

    if (!source) {
      return NextResponse.json({ message: "Traffic source not found." }, { status: 404 });
    }

    return NextResponse.json({ message: "Traffic source updated." });
  } catch {
    return NextResponse.json({ message: "Failed to update traffic source." }, { status: 500 });
  }
}
