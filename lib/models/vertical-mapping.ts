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

const mappingFieldSchema = new Schema({
  sourceVerticalFieldId: { type: String, required: false, trim: true },
  fieldName: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  type: { type: String, required: true, trim: true },
  required: { type: Boolean, required: true, default: false },
  format: { type: String, required: false, trim: true },
  emailDuplicateRule: { type: emailDuplicateRuleSchema, required: false, default: undefined },
  ignoreValues: { type: [String], default: [] },
});

const verticalMappingSchema = new Schema(
  {
    verticalRef: { type: Schema.Types.ObjectId, ref: "Vertical", required: false, index: true },
    sellerRef: { type: Schema.Types.ObjectId, ref: "Seller", required: false, index: true },
    fields: { type: [mappingFieldSchema], default: [] },
    apiRequest: { type: apiRequestSchema, required: false },
  },
  { timestamps: true }
);

verticalMappingSchema.index(
  { verticalRef: 1, sellerRef: 1 },
  {
    unique: true,
    partialFilterExpression: {
      verticalRef: { $exists: true },
      sellerRef: { $exists: true },
    },
  }
);

let referenceMigrationPromise: Promise<void> | null = null;

export async function ensureVerticalMappingReferencesMigrated() {
  if (!referenceMigrationPromise) {
    referenceMigrationPromise = (async () => {
      const db = mongoose.connection.db;
      if (!db) return;

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

        if (mapping.sellerRef && mapping.apiRequest && typeof mapping.apiRequest.url === "string") {
          const expectedUrl = `/api/${mapping.sellerRef.toString()}/lead`;
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
    })().catch((error) => {
      referenceMigrationPromise = null;
      throw error;
    });
  }

  await referenceMigrationPromise;
}

if (models.VerticalMapping) {
  delete mongoose.models.VerticalMapping;
}

export const VerticalMappingModel = model("VerticalMapping", verticalMappingSchema);
