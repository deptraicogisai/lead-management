import mongoose, { Schema, model, models } from "mongoose";

export const BUYER_LEAD_STATUSES = [
  "Accept",
  "Reject",
  "Timeout",
  "Price Conflict",
  "Error",
  "Price Reject",
  "Skipped",
] as const;

export type BuyerLeadStatus = (typeof BUYER_LEAD_STATUSES)[number];

const leadDeliverySchema = new Schema(
  {
    sellerLeadRef: { type: Schema.Types.ObjectId, ref: "SellerLead", required: true, index: true },
    sellerRef: { type: Schema.Types.ObjectId, ref: "Seller", required: false, index: true },
    verticalRef: { type: Schema.Types.ObjectId, ref: "Vertical", required: false, index: true },
    campaignRef: { type: Schema.Types.ObjectId, ref: "Campaign", required: true, index: true },
    buyerRef: { type: Schema.Types.ObjectId, ref: "Buyer", required: true, index: true },
    integrationRef: { type: Schema.Types.ObjectId, ref: "IntegrationBuilder", required: false },
    pingTreeType: { type: String, enum: ["Redirect", "Silent"], required: true, index: true },
    campaignOrder: { type: Number, required: true, default: 0 },
    buyerStatus: { type: String, enum: BUYER_LEAD_STATUSES, required: true, index: true },
    validationErrors: { type: [String], default: [] },
    price: { type: Number, required: false, default: null },
    redirectUrl: { type: String, required: false, trim: true, default: "" },
    rejectSign: { type: String, required: false, trim: true, default: "" },
    rejectReason: { type: String, required: false, trim: true, default: "" },
    errorReason: { type: String, required: false, trim: true, default: "" },
    postLeadUrl: { type: String, required: false, trim: true, default: "" },
    requestPayload: { type: Schema.Types.Mixed, required: false, default: null },
    responseBody: { type: String, required: false, trim: true, default: "" },
    deliveryTrace: { type: Schema.Types.Mixed, required: false, default: [] },
    httpStatus: { type: Number, required: false, default: 0 },
    duplicateFingerprint: { type: String, required: false, trim: true, index: true },
    postedAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

leadDeliverySchema.index({ sellerLeadRef: 1, campaignOrder: 1 });

if (models.LeadDelivery) {
  delete mongoose.models.LeadDelivery;
}

export const LeadDeliveryModel = model("LeadDelivery", leadDeliverySchema, "lead_deliveries");
