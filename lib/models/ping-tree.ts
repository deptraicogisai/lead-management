import mongoose, { Schema, model, models } from "mongoose";

const pingTreeSchema = new Schema(
  {
    displayId: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    strategy: { type: String, enum: ["Priority"], default: "Priority" },
    activeCampaignIds: { type: [String], default: [] },
    inactiveCampaignIds: { type: [String], default: [] },
    campaignPriorities: { type: Map, of: Number, default: {} },
  },
  { timestamps: true }
);

if (models.PingTree) {
  delete mongoose.models.PingTree;
}

export const PingTreeModel = model("PingTree", pingTreeSchema, "ping_trees");

export async function getNextPingTreeDisplayId() {
  const latest = await PingTreeModel.findOne().sort({ displayId: -1 }).select({ displayId: 1 }).lean();
  return (latest?.displayId ?? 0) + 1;
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
