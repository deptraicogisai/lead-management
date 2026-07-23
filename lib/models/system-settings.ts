import mongoose, { Schema, model, models } from "mongoose";

const SYSTEM_SETTINGS_KEY = "global";

const systemSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: SYSTEM_SETTINGS_KEY },
    /** When true, buyer posts use campaign mock responses instead of the live buyer API. */
    testMode: { type: Boolean, required: true, default: false },
  },
  { timestamps: true }
);

if (models.SystemSettings) {
  delete mongoose.models.SystemSettings;
}

export const SystemSettingsModel = model("SystemSettings", systemSettingsSchema, "system_settings");

export const SYSTEM_SETTINGS_DOCUMENT_KEY = SYSTEM_SETTINGS_KEY;
