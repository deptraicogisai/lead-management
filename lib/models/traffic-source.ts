import mongoose, { Schema, model, models } from "mongoose";

const trafficSourceSchema = new Schema(
  {
    displayId: { type: Number, required: false, unique: true, sparse: true, index: true },
    sellerRef: { type: Schema.Types.ObjectId, ref: "Seller", required: true, index: true },
    verticalRef: { type: Schema.Types.ObjectId, ref: "Vertical", required: false, index: true },
    mappingRef: { type: Schema.Types.ObjectId, ref: "VerticalMapping", required: false, index: true },
    sourceName: { type: String, required: true, trim: true },
    status: { type: String, enum: ["Active", "Disabled", "Deleted"], default: "Active", index: true },
  },
  { timestamps: true }
);

trafficSourceSchema.index({ sellerRef: 1, sourceName: 1 }, { unique: true });

if (models.TrafficSource) {
  delete mongoose.models.TrafficSource;
}

export const TrafficSourceModel = model("TrafficSource", trafficSourceSchema);

let displayIdMigrationPromise: Promise<void> | null = null;

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
  const latest = await TrafficSourceModel.findOne()
    .sort({ displayId: -1 })
    .select({ displayId: 1 })
    .lean();
  return (latest?.displayId ?? 0) + 1;
}
