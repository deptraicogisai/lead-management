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

const contactChannelSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["Telegram", "Linkedin", "Teams", "Signal", "Facebook", "Whatsapp", "Other"],
      required: true,
      default: "Other",
    },
    value: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const sellerContactSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: false, trim: true, default: "" },
    phone: { type: String, required: false, trim: true, default: "" },
    website: { type: String, required: false, trim: true, default: "" },
    channels: { type: [contactChannelSchema], default: [] },
  },
  { timestamps: true }
);

const sellerPaymentSchema = new Schema(
  {
    method: { type: String, required: false, trim: true, default: "" },
    paypalEmail: { type: String, required: false, trim: true, default: "" },
    payoneerEmail: { type: String, required: false, trim: true, default: "" },
    accountHolderName: { type: String, required: false, trim: true, default: "" },
    beneficiaryName: { type: String, required: false, trim: true, default: "" },
    bankName: { type: String, required: false, trim: true, default: "" },
    swiftBic: { type: String, required: false, trim: true, default: "" },
    accountNumberIban: { type: String, required: false, trim: true, default: "" },
    bankAddress: { type: String, required: false, trim: true, default: "" },
    achAccountType: { type: String, required: false, trim: true, default: "" },
    achRoutingNumber: { type: String, required: false, trim: true, default: "" },
    achAccountNumber: { type: String, required: false, trim: true, default: "" },
    cryptoNetwork: { type: String, required: false, trim: true, default: "" },
    cryptoWalletAddress: { type: String, required: false, trim: true, default: "" },
  },
  { timestamps: true }
);

const sellerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    region: { type: String, required: false, trim: true, default: "" },
    publisherTag: { type: String, required: false, trim: true, default: "" },
    status: { type: String, enum: ["Active", "Inactive", "Deleted"], required: true },
    apiFields: { type: [apiFieldSchema], default: [] },
    contacts: { type: [sellerContactSchema], default: [] },
    payments: { type: [sellerPaymentSchema], default: [] },
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

      const legacyPaymentSellers = await db
        .collection("sellers")
        .find(
          {
            payment: { $exists: true },
            $or: [{ payments: { $exists: false } }, { payments: { $size: 0 } }],
          },
          { projection: { _id: 1, payment: 1 } }
        )
        .toArray();

      for (const seller of legacyPaymentSellers) {
        const legacyPayment = seller.payment as Record<string, unknown> | null | undefined;
        const method = typeof legacyPayment?.method === "string" ? legacyPayment.method.trim() : "";
        if (!method) {
          await db.collection("sellers").updateOne({ _id: seller._id }, { $unset: { payment: "" } });
          continue;
        }

        await db.collection("sellers").updateOne(
          { _id: seller._id },
          {
            $set: {
              payments: [
                {
                  _id: new mongoose.Types.ObjectId(),
                  ...legacyPayment,
                },
              ],
            },
            $unset: { payment: "" },
          }
        );
      }
    })().catch((error) => {
      sellerMigrationPromise = null;
      throw error;
    });
  }

  await sellerMigrationPromise;
}

if (models.Seller) {
  delete mongoose.models.Seller;
}

export const SellerModel = model("Seller", sellerSchema);
