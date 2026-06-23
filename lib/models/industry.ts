import mongoose, { Schema, model, models } from "mongoose";

const emailDuplicateRuleSchema = new Schema(
  {
    mode: { type: String, enum: ["days", "forever"], required: false, trim: true },
    days: { type: Number, required: false, min: 1 },
  },
  { _id: false }
);

const verticalFieldOptionSchema = new Schema(
  {
    label: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const industryFieldSchema = new Schema(
  {
    fieldName: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
    required: { type: Boolean, required: true, default: false },
    format: { type: String, required: false, trim: true },
    emailDuplicateRule: { type: emailDuplicateRuleSchema, required: false, default: undefined },
    ignoreValues: { type: [String], default: [] },
    displayArrayMapping: { type: Boolean, required: true, default: false },
    dataTypeFilter: { type: String, required: false, trim: true, default: null },
    options: { type: [verticalFieldOptionSchema], default: [] },
  }
);

const verticalSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    status: { type: String, enum: ["Active", "Deleted"], default: "Active", index: true },
    fields: { type: [industryFieldSchema], default: [] },
  },
  { timestamps: true }
);

let migrationPromise: Promise<void> | null = null;

export async function ensureVerticalCollectionMigrated() {
  if (!migrationPromise) {
    migrationPromise = (async () => {
      const db = mongoose.connection.db;
      if (!db) return;

      const collections = await db.listCollections({}, { nameOnly: true }).toArray();
      const hasIndustries = collections.some((collection) => collection.name === "industries");
      const hasVerticals = collections.some((collection) => collection.name === "verticals");

      if (hasIndustries && !hasVerticals) {
        await db.collection("industries").rename("verticals");
      }

      const verticalCollection = db.collection("verticals");
      await verticalCollection.updateMany(
        {},
        { $unset: { industryId: "", verticalId: "", sellerId: "" } }
      );

      await verticalCollection.updateMany(
        { status: { $exists: false } },
        { $set: { status: "Active" } }
      );

      const verticals = await verticalCollection
        .find({ "fields.0": { $exists: true } }, { projection: { _id: 1, fields: 1 } })
        .toArray();

      for (const vertical of verticals) {
        const fields = Array.isArray(vertical.fields) ? vertical.fields : [];
        const needsFieldUpdate = fields.some(
          (field) =>
            !field._id ||
            field.displayArrayMapping === undefined ||
            !Array.isArray(field.options)
        );

        if (!needsFieldUpdate) {
          continue;
        }

        const nextFields = fields.map((field) => ({
          _id: field._id ?? new mongoose.Types.ObjectId(),
          fieldName: field.fieldName,
          description: field.description,
          type: field.type,
          required: Boolean(field.required),
          format: field.format,
          emailDuplicateRule: field.emailDuplicateRule,
          ignoreValues: Array.isArray(field.ignoreValues) ? field.ignoreValues : [],
          displayArrayMapping: Boolean(field.displayArrayMapping),
          dataTypeFilter: field.dataTypeFilter ?? null,
          options: Array.isArray(field.options) ? field.options : [],
        }));

        await verticalCollection.updateOne({ _id: vertical._id }, { $set: { fields: nextFields } });
      }
    })().catch((error) => {
      migrationPromise = null;
      throw error;
    });
  }

  await migrationPromise;
}

if (models.Industry || models.Vertical) {
  delete mongoose.models.Industry;
  delete mongoose.models.Vertical;
}

export const VerticalModel = model("Vertical", verticalSchema, "verticals");
export const IndustryModel = VerticalModel;
