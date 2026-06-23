import mongoose, { Schema, model, models } from "mongoose";

export type BuyerRequestLogDoc = {
  _id?: { toString(): string };
  requestType?: "seller-intake" | "buyer-delivery";
  sellerRef?: { toString(): string } | string | null;
  sellerLeadRef?: { toString(): string } | string | null;
  verticalRef?: { toString(): string } | string | null;
  campaignRef?: { toString(): string } | string | null;
  campaignName?: string | null;
  campaignType?: "Redirect" | "Silent" | string | null;
  buyerRef?: { toString(): string } | string | null;
  buyerCompany?: string | null;
  targetName?: string | null;
  postLeadUrl: string;
  requestPayload: unknown;
  responseBody?: string | null;
  responseHeaders?: Record<string, string> | null;
  errorMessage?: string | null;
  deliveryStatus: "success" | "fail";
  httpStatus: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

const buyerRequestLogSchema = new Schema(
  {
    requestType: {
      type: String,
      enum: ["seller-intake", "buyer-delivery"],
      required: true,
      default: "buyer-delivery",
      index: true,
    },
    sellerRef: { type: Schema.Types.ObjectId, ref: "Seller", required: false, index: true },
    sellerLeadRef: { type: Schema.Types.ObjectId, ref: "SellerLead", required: false, index: true },
    verticalRef: { type: Schema.Types.ObjectId, ref: "Vertical", required: false, index: true },
    campaignRef: { type: Schema.Types.ObjectId, ref: "Campaign", required: false, index: true },
    campaignName: { type: String, required: false, trim: true, default: "" },
    campaignType: { type: String, enum: ["Redirect", "Silent"], required: false, trim: true },
    buyerRef: { type: Schema.Types.ObjectId, ref: "Buyer", required: false, index: true },
    buyerCompany: { type: String, required: false, trim: true, default: "" },
    targetName: { type: String, required: false, trim: true, default: "" },
    postLeadUrl: { type: String, required: true, trim: true },
    requestPayload: { type: Schema.Types.Mixed, required: true },
    responseBody: { type: String, required: false, trim: true, default: "" },
    responseHeaders: { type: Schema.Types.Mixed, default: {} },
    errorMessage: { type: String, required: false, trim: true, default: "" },
    deliveryStatus: { type: String, enum: ["success", "fail"], required: true, index: true },
    httpStatus: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

buyerRequestLogSchema.index(
  { requestType: 1, sellerLeadRef: 1, campaignRef: 1 },
  {
    unique: true,
    partialFilterExpression: {
      requestType: "buyer-delivery",
      sellerLeadRef: { $type: "objectId" },
      campaignRef: { $type: "objectId" },
    },
  }
);

export const BuyerRequestLogModel =  (models.BuyerRequestLog
    ? (delete mongoose.models.BuyerRequestLog, model("BuyerRequestLog", buyerRequestLogSchema))
    : model("BuyerRequestLog", buyerRequestLogSchema));
