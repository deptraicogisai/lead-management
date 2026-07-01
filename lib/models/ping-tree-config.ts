import mongoose, { Schema, model, models } from "mongoose";
import {
  PING_TREE_POSTING_TYPES,
  PING_TREE_PROCESSING_TYPES,
} from "@/lib/ping-tree-config";

const pingTreeConfigSchema = new Schema(
  {
    displayId: { type: Number, required: false, unique: true, sparse: true, index: true },
    name: { type: String, required: true, trim: true },
    comment: { type: String, required: false, trim: true, default: "" },
    processingType: { type: String, enum: PING_TREE_PROCESSING_TYPES, required: true, index: true },
    postingType: { type: String, enum: PING_TREE_POSTING_TYPES, default: "Direct Post" },
    verticalRef: { type: Schema.Types.ObjectId, ref: "Vertical", required: true, index: true },
    percent: { type: Number, default: 0, min: 0, max: 100 },
    status: { type: String, enum: ["Active", "Disabled", "Deleted"], default: "Active", index: true },
    activeCampaignIds: { type: [String], default: [] },
    inactiveCampaignIds: { type: [String], default: [] },
    campaignPriorities: { type: Schema.Types.Mixed, default: {} },
    campaignTestMocks: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

if (models.PingTreeConfig) {
  delete mongoose.models.PingTreeConfig;
}

export const PingTreeConfigModel = model("PingTreeConfig", pingTreeConfigSchema);

let displayIdMigrationPromise: Promise<void> | null = null;

export async function ensurePingTreeConfigDisplayIdMigrated() {
  if (!displayIdMigrationPromise) {
    displayIdMigrationPromise = (async () => {
      const configs = await PingTreeConfigModel.find({ displayId: { $exists: false } })
        .sort({ createdAt: 1 })
        .lean();

      if (configs.length === 0) return;

      let nextDisplayId =
        (
          await PingTreeConfigModel.findOne({ displayId: { $exists: true } })
            .sort({ displayId: -1 })
            .select({ displayId: 1 })
            .lean()
        )?.displayId ?? 0;

      for (const config of configs) {
        nextDisplayId += 1;
        await PingTreeConfigModel.updateOne({ _id: config._id }, { $set: { displayId: nextDisplayId } });
      }
    })().catch((error) => {
      displayIdMigrationPromise = null;
      throw error;
    });
  }

  await displayIdMigrationPromise;
}

export async function getNextPingTreeConfigDisplayId() {
  await ensurePingTreeConfigDisplayIdMigrated();
  const latest = await PingTreeConfigModel.findOne()
    .sort({ displayId: -1 })
    .select({ displayId: 1 })
    .lean();
  return (latest?.displayId ?? 0) + 1;
}
