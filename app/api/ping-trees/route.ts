import { NextResponse } from "next/server";
import { ensureDefaultPingTrees, getNextPingTreeDisplayId, PingTreeModel } from "@/lib/models/ping-tree";
import { connectToDatabase } from "@/lib/mongodb";
import { toPingTreeRecord, type PingTreeCampaignType } from "@/lib/ping-tree";
import { sortNewestDisplayIdFirst } from "@/lib/list-sort";

function parseCampaignType(value: string | null): PingTreeCampaignType | null {
  if (value === "Redirect" || value === "Silent") {
    return value;
  }

  return null;
}

export async function GET(req: Request) {
  try {
    await connectToDatabase();
    await ensureDefaultPingTrees();

    const { searchParams } = new URL(req.url);
    const campaignType = parseCampaignType(searchParams.get("campaignType"));

    const trees = await PingTreeModel.find(campaignType ? { campaignType } : {}).sort(sortNewestDisplayIdFirst).lean();

    return NextResponse.json(trees.map((tree) => toPingTreeRecord(tree)));
  } catch {
    return NextResponse.json({ message: "Failed to fetch ping trees." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { name?: string; campaignType?: PingTreeCampaignType };

    if (!body.name?.trim()) {
      return NextResponse.json({ message: "Name is required." }, { status: 400 });
    }

    const campaignType = body.campaignType === "Silent" ? "Silent" : "Redirect";

    await connectToDatabase();
    await ensureDefaultPingTrees();

    const existing = await PingTreeModel.findOne({ campaignType }).select({ _id: 1 }).lean();
    if (existing) {
      return NextResponse.json({ message: `A ${campaignType} ping tree already exists.` }, { status: 409 });
    }

    const tree = await PingTreeModel.create({
      displayId: await getNextPingTreeDisplayId(),
      name: body.name.trim(),
      campaignType,
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
