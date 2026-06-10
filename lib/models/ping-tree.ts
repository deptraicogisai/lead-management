import mongoose, { Schema, model, models } from "mongoose";
import type { CampaignType } from "@/lib/campaign";

const PING_TREE_CAMPAIGN_TYPES: CampaignType[] = ["Redirect", "Silent"];

const pingTreeSchema = new Schema(
  {
    displayId: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    campaignType: { type: String, enum: PING_TREE_CAMPAIGN_TYPES, required: true },
    strategy: { type: String, enum: ["Priority"], default: "Priority" },
    activeCampaignIds: { type: [String], default: [] },
    inactiveCampaignIds: { type: [String], default: [] },
    campaignPriorities: { type: Map, of: Number, default: {} },
  },
  { timestamps: true }
);

pingTreeSchema.index({ campaignType: 1 }, { unique: true });

if (models.PingTree) {
  delete mongoose.models.PingTree;
}

export const PingTreeModel = model("PingTree", pingTreeSchema, "ping_trees");

export async function getNextPingTreeDisplayId() {
  const latest = await PingTreeModel.findOne().sort({ displayId: -1 }).select({ displayId: 1 }).lean();
  return (latest?.displayId ?? 0) + 1;
}

export async function ensureDefaultPingTrees() {
  const trees = await PingTreeModel.find().sort({ createdAt: 1 }).lean();
  const legacyTrees = trees.filter((tree) => !tree.campaignType);

  if (legacyTrees.length > 0) {
    await PingTreeModel.updateOne({ _id: legacyTrees[0]._id }, { $set: { campaignType: "Redirect" } });

    if (legacyTrees.length > 1) {
      await PingTreeModel.updateOne({ _id: legacyTrees[1]._id }, { $set: { campaignType: "Silent" } });
    }

    for (let index = 2; index < legacyTrees.length; index += 1) {
      const legacy = legacyTrees[index];
      const isEmpty =
        (legacy.activeCampaignIds ?? []).length === 0 && (legacy.inactiveCampaignIds ?? []).length === 0;

      if (isEmpty) {
        await PingTreeModel.deleteOne({ _id: legacy._id });
      } else {
        await PingTreeModel.updateOne(
          { _id: legacy._id },
          { $set: { campaignType: "Redirect", name: `${legacy.name} (Legacy)` } }
        );
      }
    }
  }

  const refreshed = await PingTreeModel.find().lean();
  const existingTypes = new Set(
    refreshed
      .map((tree) => tree.campaignType)
      .filter((value): value is CampaignType => value === "Redirect" || value === "Silent")
  );

  for (const campaignType of PING_TREE_CAMPAIGN_TYPES) {
    if (existingTypes.has(campaignType)) {
      continue;
    }

    await PingTreeModel.create({
      displayId: await getNextPingTreeDisplayId(),
      name: campaignType === "Redirect" ? "Redirect Ping Tree" : "Silent Ping Tree",
      campaignType,
      strategy: "Priority",
      activeCampaignIds: [],
      inactiveCampaignIds: [],
      campaignPriorities: {},
    });
  }
}

export async function getPingTreeCampaignIdSet() {
  const trees = await PingTreeModel.find().select({ activeCampaignIds: 1 }).lean();
  const ids = new Set<string>();

  for (const tree of trees) {
    for (const campaignId of tree.activeCampaignIds ?? []) {
      ids.add(campaignId);
    }
  }

  return ids;
}
