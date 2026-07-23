import {
  SYSTEM_SETTINGS_DOCUMENT_KEY,
  SystemSettingsModel,
} from "@/lib/models/system-settings";
import { connectToDatabase } from "@/lib/mongodb";

export type SystemSettingsRecord = {
  testMode: boolean;
  updatedAt: string | null;
};

const DEFAULT_SETTINGS: SystemSettingsRecord = {
  testMode: false,
  updatedAt: null,
};

function toRecord(doc: {
  testMode?: boolean | null;
  updatedAt?: Date | string | null;
} | null): SystemSettingsRecord {
  if (!doc) return { ...DEFAULT_SETTINGS };

  return {
    testMode: Boolean(doc.testMode),
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  };
}

export async function getSystemSettings(): Promise<SystemSettingsRecord> {
  await connectToDatabase();
  const doc = await SystemSettingsModel.findOne({ key: SYSTEM_SETTINGS_DOCUMENT_KEY }).lean();
  return toRecord(doc);
}

export async function isSystemTestModeEnabled(): Promise<boolean> {
  const settings = await getSystemSettings();
  return settings.testMode;
}

export async function updateSystemSettings(patch: {
  testMode?: boolean;
}): Promise<SystemSettingsRecord> {
  await connectToDatabase();

  const update: Record<string, unknown> = {};
  if (typeof patch.testMode === "boolean") {
    update.testMode = patch.testMode;
  }

  if (Object.keys(update).length === 0) {
    return getSystemSettings();
  }

  const doc = await SystemSettingsModel.findOneAndUpdate(
    { key: SYSTEM_SETTINGS_DOCUMENT_KEY },
    {
      $set: update,
      $setOnInsert: { key: SYSTEM_SETTINGS_DOCUMENT_KEY },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return toRecord(doc);
}
