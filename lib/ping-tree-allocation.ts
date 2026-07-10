import { Types } from "mongoose";
import { PingTreeAllocationModel } from "@/lib/models/ping-tree-allocation";
import { PingTreeConfigModel } from "@/lib/models/ping-tree-config";
import { connectToDatabase } from "@/lib/mongodb";
import { normalizeCampaignTestMocks } from "@/lib/campaign-test-mock";
import type { PingTreeCampaignType } from "@/lib/ping-tree";
import type { PingTreeProcessingType } from "@/lib/ping-tree-config";
import {
  isPublisherDistributionType,
  type PublisherDistributionType,
} from "@/lib/publisher-distribution";
import { resolvePublisherDistributionForLead } from "@/lib/publisher-distribution-service";

const MAX_ALLOCATION_RETRIES = 8;

/**
 * Set to `true` to use Distribution by Publisher splits instead of Ping Tree Settings.
 * Temporarily disabled for allocation testing — flip this flag to re-enable.
 */
const USE_PUBLISHER_DISTRIBUTION_OVERRIDE = false;

export type WeightedPingTreeCandidate = {
  id: string;
  percent: number;
  displayId: number | null;
};

export type SelectedPingTreeConfig = {
  id: string;
  name: string;
  displayId: number | null;
  processingType: PingTreeProcessingType;
  activeCampaignIds: string[];
  inactiveCampaignIds: string[];
  campaignPriorities: Record<string, number>;
  campaignTestMocks: ReturnType<typeof normalizeCampaignTestMocks>;
};

/** The live distribution flow only runs Redirect/Silent; map those to processing types. */
export function mapPingTreeTypeToProcessingType(
  pingTreeType: PingTreeCampaignType
): PingTreeProcessingType {
  return pingTreeType === "Silent" ? "Silent" : "Main processing";
}

export function buildAllocationBucketKey(
  verticalRefId: string,
  processingType: PingTreeProcessingType,
  scope: "live" | "test" = "live"
) {
  const base = `${verticalRefId}:${processingType}`;
  return scope === "test" ? `test:${base}` : base;
}

/** Counter bucket for publisher-specific distribution overrides. */
export function buildPublisherAllocationBucketKey(
  sellerRefId: string,
  verticalRefId: string,
  mappingRefId: string | null,
  processingType: PingTreeProcessingType,
  scope: "live" | "test" = "live"
) {
  const channelKey = mappingRefId ?? "all";
  const base = `publisher:${sellerRefId}:${verticalRefId}:${channelKey}:${processingType}`;
  return scope === "test" ? `test:${base}` : base;
}

function normalizeCountsMap(raw: unknown, candidateIds: string[]): Record<string, number> {
  const counts: Record<string, number> = {};

  if (raw instanceof Map) {
    for (const [key, value] of raw.entries()) {
      counts[String(key)] = Number(value) || 0;
    }
  } else if (raw && typeof raw === "object") {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      counts[key] = Number(value) || 0;
    }
  }

  for (const id of candidateIds) {
    if (counts[id] === undefined) {
      counts[id] = 0;
    }
  }

  return counts;
}

/**
 * Largest-remainder pick for the next lead slot. `nextTotal` is the bucket total
 * AFTER counting this lead, so the chosen tree is the one furthest below its
 * proportional quota. Deterministic tie-break keeps allocation stable.
 */
export function pickPingTreeConfigId(
  trees: WeightedPingTreeCandidate[],
  counts: Record<string, number>,
  nextTotal: number
): string | null {
  if (trees.length === 0) return null;
  if (trees.length === 1) return trees[0].id;

  const positiveWeightSum = trees.reduce((sum, tree) => sum + Math.max(tree.percent, 0), 0);
  const equalWeight = positiveWeightSum <= 0;
  const weightSum = equalWeight ? trees.length : positiveWeightSum;

  const deficitOf = (tree: WeightedPingTreeCandidate) => {
    const weight = equalWeight ? 1 : Math.max(tree.percent, 0);
    const target = (weight / weightSum) * nextTotal;
    return target - (counts[tree.id] ?? 0);
  };

  let winner = trees[0];
  let winnerDeficit = deficitOf(winner);

  for (let index = 1; index < trees.length; index += 1) {
    const tree = trees[index];
    const deficit = deficitOf(tree);

    let isBetter = false;
    if (deficit > winnerDeficit + 1e-9) {
      isBetter = true;
    } else if (deficit >= winnerDeficit - 1e-9) {
      if (!equalWeight && tree.percent !== winner.percent) {
        isBetter = tree.percent > winner.percent;
      } else {
        const treeDisplayId = tree.displayId ?? Number.MAX_SAFE_INTEGER;
        const winnerDisplayId = winner.displayId ?? Number.MAX_SAFE_INTEGER;
        isBetter =
          treeDisplayId !== winnerDisplayId
            ? treeDisplayId < winnerDisplayId
            : tree.id.localeCompare(winner.id) < 0;
      }
    }

    if (isBetter) {
      winner = tree;
      winnerDeficit = deficit;
    }
  }

  return winner.id;
}

function toSelectedPingTreeConfig(doc: {
  _id?: { toString(): string };
  displayId?: number | null;
  name?: string;
  processingType?: string;
  activeCampaignIds?: string[];
  inactiveCampaignIds?: string[];
  campaignPriorities?: Record<string, number> | Map<string, number>;
  campaignTestMocks?: Record<string, unknown> | Map<string, unknown>;
}): SelectedPingTreeConfig {
  const priorities: Record<string, number> = {};
  const prioritiesRaw = doc.campaignPriorities ?? {};

  if (prioritiesRaw instanceof Map) {
    for (const [key, value] of prioritiesRaw.entries()) {
      priorities[key] = Number(value);
    }
  } else {
    for (const [key, value] of Object.entries(prioritiesRaw)) {
      priorities[key] = Number(value);
    }
  }

  const processingType: PingTreeProcessingType =
    doc.processingType === "Silent"
      ? "Silent"
      : doc.processingType === "Exit Page"
        ? "Exit Page"
        : doc.processingType === "Exit Offer List"
          ? "Exit Offer List"
          : "Main processing";

  return {
    id: doc._id?.toString() ?? "",
    name: doc.name?.trim() || "Ping Tree",
    displayId: doc.displayId ?? null,
    processingType,
    activeCampaignIds: doc.activeCampaignIds ?? [],
    inactiveCampaignIds: doc.inactiveCampaignIds ?? [],
    campaignPriorities: priorities,
    campaignTestMocks: normalizeCampaignTestMocks(doc.campaignTestMocks),
  };
}

async function loadActiveBucketConfigs(
  verticalRefId: string,
  processingType: PingTreeProcessingType
) {
  if (!Types.ObjectId.isValid(verticalRefId)) {
    return [];
  }

  return PingTreeConfigModel.find({
    verticalRef: new Types.ObjectId(verticalRefId),
    processingType,
    status: "Active",
  })
    .sort({ displayId: 1, createdAt: 1 })
    .lean();
}

async function reserveAllocationSlot(params: {
  bucketKey: string;
  verticalRefId: string;
  processingType: PingTreeProcessingType;
  trees: WeightedPingTreeCandidate[];
}) {
  await PingTreeAllocationModel.updateOne(
    { bucketKey: params.bucketKey },
    {
      $setOnInsert: {
        bucketKey: params.bucketKey,
        verticalRef: new Types.ObjectId(params.verticalRefId),
        processingType: params.processingType,
        counts: {},
        total: 0,
        version: 0,
      },
    },
    { upsert: true }
  );

  for (let attempt = 0; attempt < MAX_ALLOCATION_RETRIES; attempt += 1) {
    const doc = await PingTreeAllocationModel.findOne({ bucketKey: params.bucketKey }).lean();
    if (!doc) continue;

    const counts = normalizeCountsMap(
      doc.counts,
      params.trees.map((tree) => tree.id)
    );
    const winnerId = pickPingTreeConfigId(params.trees, counts, (doc.total ?? 0) + 1);
    if (!winnerId) return null;

    const nextCounts = { ...counts, [winnerId]: (counts[winnerId] ?? 0) + 1 };
    const result = await PingTreeAllocationModel.updateOne(
      { bucketKey: params.bucketKey, version: doc.version },
      {
        $set: { counts: nextCounts },
        $inc: { total: 1, version: 1 },
      }
    );

    if (result.modifiedCount === 1) {
      return winnerId;
    }
  }

  throw new Error("Failed to reserve ping tree allocation slot after retries.");
}

/**
 * Choose which PingTreeConfig handles this lead.
 * When a publisher distribution exists for (seller, channel, product, type), its
 * percentages override the global Ping Tree Settings split. Otherwise the global
 * bucket (vertical + processing type) is used.
 *
 * `allocationScope: "test"` still advances counters (so 40/60 splits work during
 * Test Lead / mock posts) but uses a separate bucket that does not skew live totals.
 */
export async function selectPingTreeConfig(params: {
  verticalRefId: string;
  processingType: PingTreeProcessingType;
  count: boolean;
  sellerRefId?: string;
  mappingRefId?: string | null;
  allocationScope?: "live" | "test";
}): Promise<SelectedPingTreeConfig | null> {
  await connectToDatabase();

  const allocationScope = params.allocationScope ?? "live";
  const configs = await loadActiveBucketConfigs(params.verticalRefId, params.processingType);
  if (configs.length === 0) {
    return null;
  }

  let trees: WeightedPingTreeCandidate[];
  let bucketKey: string;

  const canUsePublisherDistribution = isPublisherDistributionType(params.processingType);
  const publisherDistribution =
    USE_PUBLISHER_DISTRIBUTION_OVERRIDE &&
    params.sellerRefId &&
    canUsePublisherDistribution
      ? await resolvePublisherDistributionForLead({
          sellerRefId: params.sellerRefId,
          verticalRefId: params.verticalRefId,
          mappingRefId: params.mappingRefId ?? null,
          processingType: params.processingType as PublisherDistributionType,
        })
      : null;

  if (USE_PUBLISHER_DISTRIBUTION_OVERRIDE && publisherDistribution) {
    const weightedConfigs = configs.filter((config) => {
      const id = config._id?.toString() ?? "";
      return publisherDistribution.weights.has(id);
    });

    if (weightedConfigs.length > 0) {
      trees = weightedConfigs.map((config) => ({
        id: config._id?.toString() ?? "",
        percent: publisherDistribution.weights.get(config._id?.toString() ?? "") ?? 0,
        displayId: config.displayId ?? null,
      }));
      bucketKey = buildPublisherAllocationBucketKey(
        params.sellerRefId!,
        params.verticalRefId,
        publisherDistribution.mappingRef,
        params.processingType,
        allocationScope
      );
    } else {
      trees = configs.map((config) => ({
        id: config._id?.toString() ?? "",
        percent: typeof config.percent === "number" ? config.percent : 0,
        displayId: config.displayId ?? null,
      }));
      bucketKey = buildAllocationBucketKey(params.verticalRefId, params.processingType, allocationScope);
    }
  } else {
    trees = configs.map((config) => ({
      id: config._id?.toString() ?? "",
      percent: typeof config.percent === "number" ? config.percent : 0,
      displayId: config.displayId ?? null,
    }));
    bucketKey = buildAllocationBucketKey(params.verticalRefId, params.processingType, allocationScope);
  }

  let winnerId: string | null;

  if (params.count) {
    winnerId = await reserveAllocationSlot({
      bucketKey,
      verticalRefId: params.verticalRefId,
      processingType: params.processingType,
      trees,
    });
  } else {
    // Peek-only: used for previews. Prefer count:true for real posts so splits advance.
    const doc = await PingTreeAllocationModel.findOne({ bucketKey }).lean();
    const counts = normalizeCountsMap(
      doc?.counts,
      trees.map((tree) => tree.id)
    );
    winnerId = pickPingTreeConfigId(trees, counts, (doc?.total ?? 0) + 1);
  }

  const winner = configs.find((config) => config._id?.toString() === winnerId);
  return winner ? toSelectedPingTreeConfig(winner) : null;
}
