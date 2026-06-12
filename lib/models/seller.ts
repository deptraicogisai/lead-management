import mongoose, { Schema, model, models } from "mongoose";

const apiFieldSchema = new Schema(
  {
    fieldName: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
    required: { type: Boolean, required: true, default: false },
    format: { type: String, required: false, trim: true },
  }
);

const sellerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    region: { type: String, required: false, trim: true, default: "" },
    status: { type: String, enum: ["Active", "Inactive"], required: true },
    apiFields: { type: [apiFieldSchema], default: [] },
  },
  { timestamps: true }
);

let sellerMigrationPromise: Promise<void> | null = null;

export async function ensureSellerCollectionMigrated() {
  if (!sellerMigrationPromise) {
    sellerMigrationPromise = (async () => {
      const db = mongoose.connection.db;
      if (!db) return;

      await db.collection("sellers").updateMany({}, { $unset: { sellerId: "" } });

      const sellers = await db
        .collection("sellers")
        .find({ "apiFields.0": { $exists: true } }, { projection: { _id: 1, apiFields: 1 } })
        .toArray();

      for (const seller of sellers) {
        const apiFields = Array.isArray(seller.apiFields)
          ? seller.apiFields.map((field) => ({
              _id: new mongoose.Types.ObjectId(),
              fieldName: field.fieldName,
              description: field.description,
              type: field.type,
              required: field.required,
              format: field.format,
            }))
          : [];

        await db.collection("sellers").updateOne(
          { _id: seller._id },
          { $set: { apiFields } }
        );
      }
    })().catch((error) => {
      sellerMigrationPromise = null;
      throw error;
    });
  }

  await sellerMigrationPromise;
}

export const SellerModel = models.Seller || model("Seller", sellerSchema);
