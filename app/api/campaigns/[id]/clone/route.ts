import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { buildCampaignLookupContext } from "@/lib/campaign-context";
import { buildClonedCampaignCreateData, type CloneableCampaign } from "@/lib/campaign-clone";
import { toCampaignRecord } from "@/lib/campaign";
import { CampaignModel, getNextCampaignDisplayId } from "@/lib/models/campaign";
import { connectToDatabase } from "@/lib/mongodb";

type Params = { params: Promise<{ id: string }> };

type CloneCampaignPayload = {
  name?: string;
  minPrice?: number | string;
};

export async function POST(req: Request, context: Params) {
  try {
    const { id } = await context.params;
    const body = (await req.json()) as CloneCampaignPayload;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid campaign id." }, { status: 400 });
    }

    const baseName = body.name?.trim() ?? "";
    if (!baseName) {
      return NextResponse.json({ message: "Name is required." }, { status: 400 });
    }

    const minPrice = Number(body.minPrice ?? 0);
    if (!Number.isFinite(minPrice) || minPrice < 0) {
      return NextResponse.json({ message: "A valid min price is required." }, { status: 400 });
    }

    await connectToDatabase();

    const source = await CampaignModel.findById(id).lean();
    if (!source) {
      return NextResponse.json({ message: "Campaign not found." }, { status: 404 });
    }

    const displayId = await getNextCampaignDisplayId();
    const createData = buildClonedCampaignCreateData(source as CloneableCampaign, baseName, minPrice);

    const cloned = await CampaignModel.create({
      displayId,
      ...createData,
    });

    const lookup = await buildCampaignLookupContext();

    return NextResponse.json(toCampaignRecord(cloned.toObject(), lookup), { status: 201 });
  } catch (error) {
    console.error("Failed to clone campaign:", error);
    const message = error instanceof Error ? error.message : "Failed to clone campaign.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
