import { Schema, model, models } from "mongoose";

const phonexaSyncStateSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    initialSyncAttempted: { type: Boolean, required: true, default: false },
    lastAttemptedAt: { type: Date, required: false, default: null },
  },
  { timestamps: true }
);

export const PhonexaSyncStateModel =
  models.PhonexaSyncState || model("PhonexaSyncState", phonexaSyncStateSchema, "phonexa_sync_states");

const DOCUMENTS_SYNC_STATE_KEY = "documents";

export async function isDocumentsInitialSyncNeeded() {
  const state = await PhonexaSyncStateModel.findOne({ key: DOCUMENTS_SYNC_STATE_KEY }).lean();
  return !state?.initialSyncAttempted;
}

export async function markDocumentsInitialSyncAttempted() {
  await PhonexaSyncStateModel.findOneAndUpdate(
    { key: DOCUMENTS_SYNC_STATE_KEY },
    {
      initialSyncAttempted: true,
      lastAttemptedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}
