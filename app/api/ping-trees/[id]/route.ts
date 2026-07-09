import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { buildCampaignLookupContext } from "@/lib/campaign-context";
import { toCampaignRecord } from "@/lib/campaign";
import { CampaignModel } from "@/lib/models/campaign";
import { PingTreeModel } from "@/lib/models/ping-tree";
import { connectToDatabase } from "@/lib/mongodb";
import { excludeDeletedStatusFilter } from "@/lib/soft-delete";
import { sortInactiveCampaignsByBuyerMinPrice, toPingTreeRecord, type PingTreeCampaignCard } from "@/lib/ping-tree";
import { normalizeCampaignTestMocks, sanitizeCampaignTestMock } from "@/lib/campaign-test-mock";

type Params = { params: Promise<{ id: string }> };

type PingTreeUpdatePayload = {
  strategy?: "Priority";
  activeCampaignIds?: string[];
  inactiveCampaignIds?: string[];
  campaignPriorities?: Record<string, number>;
  campaignTestMocks?: Record<string, unknown | null>;
};

function buildInactiveIdOrder(
  storedIds: string[] | undefined,
  activeIds: Set<string>,
  allRecords: { id: string }[]
) {
  const order: string[] = [];

  for (const campaignId of storedIds ?? []) {
    if (!activeIds.has(campaignId) && !order.includes(campaignId)) {
      order.push(campaignId);
    }
  }

  for (const record of allRecords) {
    if (!activeIds.has(record.id) && !order.includes(record.id)) {
      order.push(record.id);
    }
  }

  return order;
}

export async function GET(_: Request, context: Params) {
  try {
    const { id } = await context.params;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid ping tree id." }, { status: 400 });
    }

    await connectToDatabase();

    const tree = await PingTreeModel.findById(id).lean();
    if (!tree) {
      return NextResponse.json({ message: "Ping tree not found." }, { status: 404 });
    }

    const lookup = await buildCampaignLookupContext();
    const treeCampaignType = tree.campaignType === "Silent" ? "Silent" : "Redirect";
    const campaigns = await CampaignModel.find({
      campaignType: treeCampaignType,
      ...excludeDeletedStatusFilter(),
    })
      .sort({ displayId: -1 })
      .lean();
    const records = campaigns.map((campaign) => toCampaignRecord(campaign, lookup));

    const activeIds = new Set(tree.activeCampaignIds ?? []);
    const prioritiesRaw = tree.campaignPriorities ?? {};
    const priorities: Record<string, number> = {};

    if (prioritiesRaw instanceof Map) {
      for (const [key, value] of prioritiesRaw.entries()) {
        priorities[key] = Number(value);
      }
    } else {
      for (const [key, value] of Object.entries(prioritiesRaw as Record<string, number>)) {
        priorities[key] = Number(value);
      }
    }

    const campaignTestMocks = normalizeCampaignTestMocks(tree.campaignTestMocks as Record<string, unknown> | Map<string, unknown>);

    const toCard = (record: ReturnType<typeof toCampaignRecord>, priority = 0): PingTreeCampaignCard => ({
      id: record.id,
      displayId: record.displayId,
      name: record.name,
      status: record.status,
      buyerLabel: record.buyerLabel,
      minPrice: record.minPrice,
      productLabel: record.productLabel,
      priority,
      testMock: campaignTestMocks[record.id] ?? null,
    });

    const pingTreeList = (tree.activeCampaignIds ?? [])
      .map((campaignId) => {
        const record = records.find((item) => item.id === campaignId);
        if (!record) return null;
        return toCard(record, Number(priorities[campaignId] ?? 0));
      })
      .filter((item): item is PingTreeCampaignCard => item !== null);

    const inactiveOrder = buildInactiveIdOrder(tree.inactiveCampaignIds, activeIds, records);
    const notInPingTree = sortInactiveCampaignsByBuyerMinPrice(
      inactiveOrder
        .map((campaignId) => {
          const record = records.find((item) => item.id === campaignId);
          if (!record) return null;
          return toCard(record, Number(priorities[campaignId] ?? 0));
        })
        .filter((item): item is PingTreeCampaignCard => item !== null)
    );

    return NextResponse.json({
      tree: toPingTreeRecord(tree),
      pingTreeList,
      notInPingTree,
    });
  } catch {
    return NextResponse.json({ message: "Failed to fetch ping tree." }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: Params) {
  try {
    const { id } = await context.params;
    const body = (await req.json()) as PingTreeUpdatePayload;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid ping tree id." }, { status: 400 });
    }

    await connectToDatabase();

    const tree = await PingTreeModel.findById(id);
    if (!tree) {
      return NextResponse.json({ message: "Ping tree not found." }, { status: 404 });
    }

    if (body.strategy) {
      tree.strategy = body.strategy;
    }

    if (body.activeCampaignIds) {
      tree.activeCampaignIds = body.activeCampaignIds;
    }

    if (body.inactiveCampaignIds) {
      tree.inactiveCampaignIds = body.inactiveCampaignIds;
    }

    if (body.campaignPriorities) {
      tree.set("campaignPriorities", body.campaignPriorities);
      tree.markModified("campaignPriorities");
    }

    if (body.campaignTestMocks) {
      const existingRaw = tree.campaignTestMocks;
      const existing =
        existingRaw instanceof Map
          ? Object.fromEntries(existingRaw.entries())
          : { ...((existingRaw as Record<string, unknown> | undefined) ?? {}) };

      for (const [campaignId, mock] of Object.entries(body.campaignTestMocks)) {
        if (mock === null) {
          delete existing[campaignId];
          continue;
        }

        existing[campaignId] = sanitizeCampaignTestMock(mock);
      }

      tree.set("campaignTestMocks", existing);
      tree.markModified("campaignTestMocks");
    }

    await tree.save();

    return NextResponse.json(toPingTreeRecord(tree.toObject()));
  } catch {
    return NextResponse.json({ message: "Failed to update ping tree." }, { status: 500 });
  }
}
