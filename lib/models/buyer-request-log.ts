import mongoose, { Schema, model, models } from "mongoose";

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
    verticalRef: { type: Schema.Types.ObjectId, ref: "Vertical", required: false, index: true },
    buyerRef: { type: Schema.Types.ObjectId, ref: "Buyer", required: false, index: true },
    buyerCompany: { type: String, required: false, trim: true, default: "" },
    targetName: { type: String, required: false, trim: true, default: "" },
    postLeadUrl: { type: String, required: true, trim: true },
    requestPayload: { type: Schema.Types.Mixed, required: true },
    responseBody: { type: String, required: false, trim: true, default: "" },
    errorMessage: { type: String, required: false, trim: true, default: "" },
    deliveryStatus: { type: String, enum: ["success", "fail"], required: true, index: true },
    httpStatus: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

export const BuyerRequestLogModel =
  (models.BuyerRequestLog
    ? (delete mongoose.models.BuyerRequestLog, model("BuyerRequestLog", buyerRequestLogSchema))
    : model("BuyerRequestLog", buyerRequestLogSchema));
