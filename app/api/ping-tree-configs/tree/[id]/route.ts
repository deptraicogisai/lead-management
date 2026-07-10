import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { buildCampaignLookupContext } from "@/lib/campaign-context";
import { toCampaignRecord } from "@/lib/campaign";
import { CampaignModel } from "@/lib/models/campaign";
import { PingTreeConfigModel } from "@/lib/models/ping-tree-config";
import { connectToDatabase } from "@/lib/mongodb";
import { excludeDeletedStatusFilter } from "@/lib/soft-delete";
import { sortInactiveCampaignsByBuyerMinPrice, type PingTreeCampaignCard, type PingTreeRecord } from "@/lib/ping-tree";
import { normalizeCampaignTestMocks, sanitizeCampaignTestMock } from "@/lib/campaign-test-mock";

type Params = { params: Promise<{ id: string }> };

type ConfigTreeUpdatePayload = {
  activeCampaignIds?: string[];
  inactiveCampaignIds?: string[];
  campaignPriorities?: Record<string, number>;
  campaignTestMocks?: Record<string, unknown | null>;
};

/** Each Ping Tree config keeps its own independent drag-drop arrangement. */
function configCampaignType(processingType: unknown): "Redirect" | "Silent" {
  return processingType === "Silent" ? "Silent" : "Redirect";
}

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

function toSyntheticTreeRecord(config: {
  _id?: { toString(): string };
  displayId?: number | null;
  name?: string;
  processingType?: unknown;
  activeCampaignIds?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}): PingTreeRecord {
  return {
    id: config._id?.toString() ?? "",
    displayId: config.displayId ?? 0,
    name: config.name ?? "",
    campaignType: configCampaignType(config.processingType),
    strategy: "Priority",
    activeCampaignIds: config.activeCampaignIds ?? [],
    createdAt: config.createdAt ? new Date(config.createdAt as string).toISOString() : "",
    updatedAt: config.updatedAt ? new Date(config.updatedAt as string).toISOString() : "",
  };
}

export async function GET(_: Request, context: Params) {
  try {
    const { id } = await context.params;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid ping tree id." }, { status: 400 });
    }

    await connectToDatabase();

    const config = await PingTreeConfigModel.findById(id).lean();
    if (!config) {
      return NextResponse.json({ message: "Ping tree not found." }, { status: 404 });
    }

    const lookup = await buildCampaignLookupContext();
    const campaigns = await CampaignModel.find({
      campaignType: configCampaignType(config.processingType),
      ...excludeDeletedStatusFilter(),
    })
      .sort({ displayId: -1 })
      .lean();
    const records = campaigns.map((campaign) => toCampaignRecord(campaign, lookup));

    const activeIds = new Set(config.activeCampaignIds ?? []);
    const prioritiesRaw = config.campaignPriorities ?? {};
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

    const campaignTestMocks = normalizeCampaignTestMocks(
      config.campaignTestMocks as Record<string, unknown> | Map<string, unknown>
    );

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

    const pingTreeList = (config.activeCampaignIds ?? [])
      .map((campaignId) => {
        const record = records.find((item) => item.id === campaignId);
        if (!record) return null;
        return toCard(record, Number(priorities[campaignId] ?? 0));
      })
      .filter((item): item is PingTreeCampaignCard => item !== null);

    const inactiveOrder = buildInactiveIdOrder(config.inactiveCampaignIds, activeIds, records);
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
      tree: toSyntheticTreeRecord(config),
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
    const body = (await req.json()) as ConfigTreeUpdatePayload;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid ping tree id." }, { status: 400 });
    }

    await connectToDatabase();

    const config = await PingTreeConfigModel.findById(id);
    if (!config) {
      return NextResponse.json({ message: "Ping tree not found." }, { status: 404 });
    }

    if (body.activeCampaignIds) {
      config.set("activeCampaignIds", body.activeCampaignIds);
    }

    if (body.inactiveCampaignIds) {
      config.set("inactiveCampaignIds", body.inactiveCampaignIds);
    }

    if (body.campaignPriorities) {
      config.set("campaignPriorities", body.campaignPriorities);
      config.markModified("campaignPriorities");
    }

    if (body.campaignTestMocks) {
      const existingRaw = config.get("campaignTestMocks");
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

      config.set("campaignTestMocks", existing);
      config.markModified("campaignTestMocks");
    }

    await config.save();

    return NextResponse.json(toSyntheticTreeRecord(config.toObject()));
  } catch {
    return NextResponse.json({ message: "Failed to update ping tree." }, { status: 500 });
  }
}
