import mongoose, { Schema, model, models } from "mongoose";

const sellerLeadSchema = new Schema(
  {
    sellerRef: { type: Schema.Types.ObjectId, ref: "Seller", required: false, index: true },
    verticalRef: { type: Schema.Types.ObjectId, ref: "Vertical", required: false, index: true },
    mappingRef: { type: Schema.Types.ObjectId, ref: "VerticalMapping", required: false, index: true },
    payload: { type: Schema.Types.Mixed, required: true },
    validationStatus: { type: String, enum: ["success", "fail"], required: true },
    validationErrors: { type: [String], default: [] },
    publisherStatus: {
      type: String,
      enum: ["Sold", "Reject", "Post Error", "Test"],
      required: false,
      index: true,
    },
    isTestLead: { type: Boolean, default: false },
    /** JSON body returned to the publisher for this intake request. */
    publisherResponse: { type: Schema.Types.Mixed, required: false, default: null },
    // Buyer offer URL returned from a Redirect campaign accept.
    redirectUrl: { type: String, required: false, trim: true, default: "" },
    redirectConfirmedAt: { type: Date, required: false, index: true },
    redirectClientIp: { type: String, required: false, trim: true, default: "" },
    redirectReferrer: { type: String, required: false, trim: true, default: "" },
    redirectClickUserAgent: { type: String, required: false, trim: true, default: "" },
    soldPrice: { type: Number, required: false, default: null },
    pingTreeAllocations: {
      type: [
        new Schema(
          {
            pingTreeType: { type: String, required: true },
            processingType: { type: String, required: false, trim: true, default: "" },
            configId: { type: String, required: true },
            configName: { type: String, required: false, default: "" },
            displayId: { type: Number, required: false, default: null },
            silentPostingMode: { type: String, required: false, trim: true, default: "" },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    postedAt: { type: Date, required: true, index: true },
    userAgent: { type: String, required: false, trim: true },
  },
  { timestamps: true }
);

let referenceMigrationPromise: Promise<void> | null = null;

export async function ensureSellerLeadReferencesMigrated() {
  if (!referenceMigrationPromise) {
    referenceMigrationPromise = (async () => {
      const db = mongoose.connection.db;
      if (!db) return;

      const leads = await db
        .collection("leads")
        .find(
          { sellerRef: { $exists: false }, sellerId: { $exists: true } },
          { projection: { _id: 1, sellerId: 1 } }
        )
        .toArray();

      for (const lead of leads) {
        if (typeof lead.sellerId !== "string" || !lead.sellerId.trim()) continue;

        const seller = await db.collection("sellers").findOne(
          { sellerId: lead.sellerId.trim() },
          { projection: { _id: 1 } }
        );

        if (seller?._id) {
          await db.collection("leads").updateOne(
            { _id: lead._id },
            { $set: { sellerRef: seller._id } }
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

if (models.SellerLead) {
  delete mongoose.models.SellerLead;
}

export const SellerLeadModel = models.SellerLead || model("SellerLead", sellerLeadSchema, "leads");
