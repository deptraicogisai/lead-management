import mongoose, { Schema, model, models } from "mongoose";

const apiRequestSchema = new Schema(
  {
    apiKey: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    method: { type: String, required: true, trim: true, default: "POST" },
  },
  { _id: false }
);

const emailDuplicateRuleSchema = new Schema(
  {
    mode: { type: String, enum: ["days", "forever"], required: false, trim: true },
    days: { type: Number, required: false, min: 1 },
  },
  { _id: false }
);

const mappingFieldOptionSchema = new Schema(
  {
    label: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const mappingGeneralFilterSchema = new Schema(
  {
    fieldId: { type: String, required: true, trim: true },
    fieldName: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    dataTypeFilter: { type: String, enum: ["Text", "Range", "Checkbox", "Multi Select"], required: true },
    multiSelectMode: { type: String, enum: ["included", "excluded"], required: false },
    enabled: { type: Boolean, default: false },
    minValue: { type: String, trim: true },
    maxValue: { type: String, trim: true },
    selectedValues: { type: [String], default: [] },
    textValue: { type: String, trim: true },
  },
  { _id: false }
);

const mappingScheduleRuleSchema = new Schema(
  {
    active: { type: Boolean, default: true },
    action: { type: String, enum: ["Post", "Do not post"], required: true, default: "Post" },
    scheduleMethod: { type: String, enum: ["Days"], default: "Days" },
    days: { type: [String], default: [] },
    startHour: { type: String, default: "00", trim: true },
    startMinute: { type: String, default: "00", trim: true },
    endHour: { type: String, default: "23", trim: true },
    endMinute: { type: String, default: "59", trim: true },
    dailySoldLeadsLimit: { type: Number, default: null },
    dailyPostLeadsLimit: { type: Number, default: null },
  },
  { _id: true }
);

const mappingDuplicatesSchema = new Schema(
  {
    duplicateMethod: { type: String, enum: ["Email", "SSN + Email"], default: "Email" },
    duplicateSold: { type: String, default: "OFF", trim: true },
    duplicatePosted: { type: String, default: "OFF", trim: true },
  },
  { _id: false }
);

const mappingRevShareSchema = new Schema(
  {
    model: {
      type: String,
      enum: ["system-default", "static-percent", "fixed-price"],
      default: "system-default",
    },
    percent: { type: Number, default: null },
    fixedPrice: { type: Number, default: null },
    rejectIfPingPriceLowerThanFixedPrice: { type: Boolean, default: true },
    copyToOtherPublishers: { type: Boolean, default: false },
    copyPublisherIds: { type: [String], default: [] },
  },
  { _id: false }
);

const mappingFieldSchema = new Schema({
  sourceVerticalFieldId: { type: String, required: false, trim: true },
  fieldName: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  type: { type: String, required: true, trim: true },
  required: { type: Boolean, required: true, default: false },
  format: { type: String, required: false, trim: true },
  emailDuplicateRule: { type: emailDuplicateRuleSchema, required: false, default: undefined },
  ignoreValues: { type: [String], default: [] },
  displayArrayMapping: { type: Boolean, required: true, default: false },
  dataTypeFilter: { type: String, required: false, trim: true, default: null },
  options: { type: [mappingFieldOptionSchema], default: [] },
});

const verticalMappingSchema = new Schema(
  {
    displayId: { type: Number, required: false, unique: true, sparse: true, index: true },
    verticalRef: { type: Schema.Types.ObjectId, ref: "Vertical", required: false, index: true },
    sellerRef: { type: Schema.Types.ObjectId, ref: "Seller", required: false, index: true },
    apiName: { type: String, trim: true, default: "" },
    apiType: { type: String, enum: ["Redirect", "Silent"], default: "Redirect" },
    status: { type: String, enum: ["Active", "Inactive", "Deleted"], default: "Active" },
    fields: { type: [mappingFieldSchema], default: [] },
    apiRequest: { type: apiRequestSchema, required: false },
    timezone: { type: String, trim: true, default: "New York (EST/EDT)" },
    duplicates: { type: mappingDuplicatesSchema, default: () => ({}) },
    revShare: { type: mappingRevShareSchema, default: () => ({}) },
    generalFilters: { type: [mappingGeneralFilterSchema], default: [] },
    scheduleRules: { type: [mappingScheduleRuleSchema], default: [] },
  },
  { timestamps: true }
);

verticalMappingSchema.index({ verticalRef: 1, sellerRef: 1 });
verticalMappingSchema.index(
  { "apiRequest.apiKey": 1 },
  {
    unique: true,
    partialFilterExpression: {
      "apiRequest.apiKey": { $type: "string" },
    },
  }
);

let referenceMigrationPromise: Promise<void> | null = null;

async function dropLegacySellerVerticalUniqueIndexes(db: NonNullable<typeof mongoose.connection.db>) {
  const indexes = await db.collection("verticalmappings").indexes();

  for (const index of indexes) {
    const keys = index.key as Record<string, number>;
    const isSellerVerticalIndex = keys.verticalRef === 1 && keys.sellerRef === 1;

    if (index.unique && isSellerVerticalIndex && index.name) {
      try {
        await db.collection("verticalmappings").dropIndex(index.name);
      } catch {
        // Index may already be removed.
      }
    }
  }
}

export async function ensureVerticalMappingReferencesMigrated() {
  const db = mongoose.connection.db;
  if (!db) {
    return;
  }

  await dropLegacySellerVerticalUniqueIndexes(db);

  if (!referenceMigrationPromise) {
    referenceMigrationPromise = (async () => {
      const mappings = await db
        .collection("verticalmappings")
        .find(
          {},
          {
            projection: {
              _id: 1,
              mappingId: 1,
              sellerId: 1,
              verticalId: 1,
              sellerRef: 1,
              verticalRef: 1,
              apiRequest: 1,
            },
          }
        )
        .toArray();

      for (const mapping of mappings) {
        const update: Record<string, unknown> = {};

        if (mapping.apiRequest && typeof mapping.apiRequest.url === "string") {
          const expectedUrl = "/api/lead";
          if (mapping.apiRequest.url !== expectedUrl) {
            update.apiRequest = {
              ...mapping.apiRequest,
              url: expectedUrl,
            };
          }
        }

        if (Object.keys(update).length > 0 || "mappingId" in mapping || "sellerId" in mapping || "verticalId" in mapping) {
          await db.collection("verticalmappings").updateOne(
            { _id: mapping._id },
            { $set: update, $unset: { mappingId: "", sellerId: "", verticalId: "" } }
          );
        }
      }

      const mappingsMissingApiKey = await VerticalMappingModel.find({
        sellerRef: { $exists: true, $ne: null },
        $or: [
          { apiRequest: { $exists: false } },
          { "apiRequest.apiKey": { $exists: false } },
          { "apiRequest.apiKey": "" },
        ],
      });

      for (const mapping of mappingsMissingApiKey) {
        const { ensureMappingApiRequest } = await import("@/lib/mapping-api-request");
        await ensureMappingApiRequest(mapping);
      }

      await VerticalMappingModel.syncIndexes();
    })().catch((error) => {
      referenceMigrationPromise = null;
      throw error;
    });
  }

  await referenceMigrationPromise;
}

let displayIdMigrationPromise: Promise<void> | null = null;

export async function ensureVerticalMappingDisplayIdMigrated() {
  if (!displayIdMigrationPromise) {
    displayIdMigrationPromise = (async () => {
      const mappings = await VerticalMappingModel.find().sort({ createdAt: 1 }).lean();
      let nextDisplayId =
        (
          await VerticalMappingModel.findOne({ displayId: { $exists: true } })
            .sort({ displayId: -1 })
            .select({ displayId: 1 })
            .lean()
        )?.displayId ?? 0;

      for (const mapping of mappings) {
        if (!mapping.displayId) {
          nextDisplayId += 1;
          await VerticalMappingModel.updateOne({ _id: mapping._id }, { $set: { displayId: nextDisplayId } });
        }
      }
    })().catch((error) => {
      displayIdMigrationPromise = null;
      throw error;
    });
  }

  await displayIdMigrationPromise;
}

export async function getNextVerticalMappingDisplayId() {
  await ensureVerticalMappingDisplayIdMigrated();
  const latest = await VerticalMappingModel.findOne()
    .sort({ displayId: -1 })
    .select({ displayId: 1 })
    .lean();
  return (latest?.displayId ?? 0) + 1;
}

if (models.VerticalMapping) {
  delete mongoose.models.VerticalMapping;
}

export const VerticalMappingModel = model("VerticalMapping", verticalMappingSchema);
