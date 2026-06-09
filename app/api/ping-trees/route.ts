import { NextResponse } from "next/server";
import { buildCampaignLookupContext } from "@/lib/campaign-context";
import { toCampaignRecord } from "@/lib/campaign";
import { CampaignModel } from "@/lib/models/campaign";
import { getNextPingTreeDisplayId, PingTreeModel } from "@/lib/models/ping-tree";
import { connectToDatabase } from "@/lib/mongodb";
import { toPingTreeRecord, type PingTreeCampaignCard } from "@/lib/ping-tree";

export async function GET() {
  try {
    await connectToDatabase();

    let trees = await PingTreeModel.find().sort({ createdAt: 1 }).lean();

    if (trees.length === 0) {
      await PingTreeModel.create({
        displayId: await getNextPingTreeDisplayId(),
        name: "Main Tree",
        strategy: "Priority",
        activeCampaignIds: [],
        inactiveCampaignIds: [],
        campaignPriorities: {},
      });
      trees = await PingTreeModel.find().sort({ createdAt: 1 }).lean();
    }

    return NextResponse.json(trees.map((tree) => toPingTreeRecord(tree)));
  } catch {
    return NextResponse.json({ message: "Failed to fetch ping trees." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { name?: string };

    if (!body.name?.trim()) {
      return NextResponse.json({ message: "Name is required." }, { status: 400 });
    }

    await connectToDatabase();

    const tree = await PingTreeModel.create({
      displayId: await getNextPingTreeDisplayId(),
      name: body.name.trim(),
      strategy: "Priority",
      activeCampaignIds: [],
      inactiveCampaignIds: [],
      campaignPriorities: {},
    });

    return NextResponse.json(toPingTreeRecord(tree.toObject()), { status: 201 });
  } catch {
    return NextResponse.json({ message: "Failed to create ping tree." }, { status: 500 });
  }
}
