import mongoose, { Schema, model, models } from "mongoose";

const campaignTestLeadLogSchema = new Schema(
  {
    campaignRef: { type: Schema.Types.ObjectId, ref: "Campaign", required: true, index: true },
    displayId: { type: Number, required: true, index: true },
    submittedAt: { type: Date, required: true, default: Date.now, index: true },
    leadData: { type: Schema.Types.Mixed, required: true },
    buyerRequest: { type: Schema.Types.Mixed, required: false, default: null },
    buyerResponse: { type: Schema.Types.Mixed, required: false, default: null },
    buyerStatus: { type: String, required: true, trim: true, default: "Error" },
    statusCode: { type: String, required: false, trim: true, default: "" },
    message: { type: String, required: false, trim: true, default: "" },
    price: { type: Number, required: false, default: null },
    processingTimeSeconds: { type: Number, required: true, default: 0 },
    errorReason: { type: String, required: false, trim: true, default: "" },
  },
  { timestamps: true }
);

campaignTestLeadLogSchema.index({ campaignRef: 1, submittedAt: -1 });
campaignTestLeadLogSchema.index({ campaignRef: 1, displayId: -1 });

export const CampaignTestLeadLogModel =
  models.CampaignTestLeadLog ?? model("CampaignTestLeadLog", campaignTestLeadLogSchema);
