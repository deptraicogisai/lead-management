import mongoose, { Schema, model, models } from "mongoose";
import {
  FIRST_PING_TREE_OFFICIAL_PERCENT,
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

let officialPercentMigrationPromise: Promise<void> | null = null;

/** Persist 100% as the official stored percent for single-tree product buckets. */
export async function ensureOfficialPingTreePercentForBucket(
  verticalRef: mongoose.Types.ObjectId,
  processingType: string
) {
  const trees = await PingTreeConfigModel.find({
    verticalRef,
    processingType,
    status: { $ne: "Deleted" },
  })
    .select({ _id: 1, percent: 1 })
    .lean();

  if (trees.length !== 1) {
    return;
  }

  const onlyTree = trees[0];
  if (onlyTree.percent === FIRST_PING_TREE_OFFICIAL_PERCENT) {
    return;
  }

  await PingTreeConfigModel.updateOne(
    { _id: onlyTree._id },
    { $set: { percent: FIRST_PING_TREE_OFFICIAL_PERCENT } }
  );
}

export async function ensurePingTreeOfficialPercentsMigrated() {
  if (!officialPercentMigrationPromise) {
    officialPercentMigrationPromise = (async () => {
      const configs = await PingTreeConfigModel.find({ status: { $ne: "Deleted" } })
        .select({ _id: 1, verticalRef: 1, processingType: 1, percent: 1 })
        .lean();

      const buckets = new Map<string, typeof configs>();
      for (const config of configs) {
        const key = `${config.verticalRef?.toString() ?? ""}:${config.processingType}`;
        if (!buckets.has(key)) {
          buckets.set(key, []);
        }
        buckets.get(key)!.push(config);
      }

      await Promise.all(
        Array.from(buckets.values()).map(async (bucket) => {
          if (bucket.length !== 1) {
            return;
          }

          const onlyTree = bucket[0];
          if (onlyTree.percent === FIRST_PING_TREE_OFFICIAL_PERCENT) {
            return;
          }

          await PingTreeConfigModel.updateOne(
            { _id: onlyTree._id },
            { $set: { percent: FIRST_PING_TREE_OFFICIAL_PERCENT } }
          );
        })
      );
    })().catch((error) => {
      officialPercentMigrationPromise = null;
      throw error;
    });
  }

  await officialPercentMigrationPromise;
}
