import mongoose, { Schema, model, models } from "mongoose";

const trafficSourceSchema = new Schema(
  {
    displayId: { type: Number, required: false, unique: true, sparse: true, index: true },
    sellerRef: { type: Schema.Types.ObjectId, ref: "Seller", required: true, index: true },
    verticalRef: { type: Schema.Types.ObjectId, ref: "Vertical", required: false, index: true },
    mappingRef: { type: Schema.Types.ObjectId, ref: "VerticalMapping", required: false, index: true },
    sourceName: { type: String, required: true, trim: true },
    status: { type: String, enum: ["Active", "Paused", "Disabled", "Deleted"], default: "Active", index: true },
  },
  { timestamps: true }
);

trafficSourceSchema.index({ sellerRef: 1, sourceName: 1 }, { unique: true });

if (models.TrafficSource) {
  delete mongoose.models.TrafficSource;
}

export const TrafficSourceModel = model("TrafficSource", trafficSourceSchema);

export const TRAFFIC_SOURCE_STATUSES = ["Active", "Paused", "Deleted"] as const;
export type TrafficSourceStatus = (typeof TRAFFIC_SOURCE_STATUSES)[number];

/** Legacy "Disabled" maps to Paused. */
export function normalizeTrafficSourceStatus(status?: string | null): TrafficSourceStatus {
  if (status === "Deleted") return "Deleted";
  if (status === "Paused" || status === "Disabled") return "Paused";
  return "Active";
}

export function isTrafficSourceAllowed(status?: string | null) {
  return normalizeTrafficSourceStatus(status) === "Active";
}

let displayIdMigrationPromise: Promise<void> | null = null;
let statusMigrationPromise: Promise<void> | null = null;

export async function ensureTrafficSourceStatusMigrated() {
  if (!statusMigrationPromise) {
    statusMigrationPromise = (async () => {
      await TrafficSourceModel.updateMany({ status: "Disabled" }, { $set: { status: "Paused" } });
    })().catch((error) => {
      statusMigrationPromise = null;
      throw error;
    });
  }

  await statusMigrationPromise;
}

export async function ensureTrafficSourceDisplayIdMigrated() {
  if (!displayIdMigrationPromise) {
    displayIdMigrationPromise = (async () => {
      const sources = await TrafficSourceModel.find({ displayId: { $exists: false } })
        .sort({ createdAt: 1 })
        .lean();

      if (sources.length === 0) return;

      let nextDisplayId =
        (
          await TrafficSourceModel.findOne({ displayId: { $exists: true } })
            .sort({ displayId: -1 })
            .select({ displayId: 1 })
            .lean()
        )?.displayId ?? 0;

      for (const source of sources) {
        nextDisplayId += 1;
        await TrafficSourceModel.updateOne({ _id: source._id }, { $set: { displayId: nextDisplayId } });
      }
    })().catch((error) => {
      displayIdMigrationPromise = null;
      throw error;
    });
  }

  await displayIdMigrationPromise;
}

export async function getNextTrafficSourceDisplayId() {
  await ensureTrafficSourceDisplayIdMigrated();
  await ensureTrafficSourceStatusMigrated();
  const latest = await TrafficSourceModel.findOne()
    .sort({ displayId: -1 })
    .select({ displayId: 1 })
    .lean();
  return (latest?.displayId ?? 0) + 1;
}
