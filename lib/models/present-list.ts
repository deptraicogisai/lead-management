import mongoose, { Schema, model, models } from "mongoose";

const presentListValueSchema = new Schema(
  {
    value: { type: String, required: true, trim: true },
    expirationDate: { type: Date, required: false, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const presentListSchema = new Schema(
  {
    displayId: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    verticalRef: { type: Schema.Types.ObjectId, ref: "Vertical", required: true, index: true },
    applyToField: { type: String, required: true, trim: true },
    listType: { type: String, enum: ["PL", "DNPL"], required: true, index: true },
    defaultExpirationPeriod: { type: String, default: "No expiration", trim: true },
    allowApiAccess: { type: Boolean, default: false },
    autoUpdateFrequency: { type: String, default: "N/A", trim: true },
    values: { type: [presentListValueSchema], default: [] },
    lastDownloadAt: { type: Date, required: false, default: null },
  },
  { timestamps: true }
);

if (models.PresentList) {
  delete mongoose.models.PresentList;
}

export const PresentListModel = model("PresentList", presentListSchema, "present_lists");

export async function getNextPresentListDisplayId() {
  const latest = await PresentListModel.findOne().sort({ displayId: -1 }).select({ displayId: 1 }).lean();
  return (latest?.displayId ?? 0) + 1;
}
