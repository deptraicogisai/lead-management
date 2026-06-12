import mongoose, { Schema, model, models } from "mongoose";

const mappingTestLeadLogSchema = new Schema(
  {
    sellerRef: { type: Schema.Types.ObjectId, ref: "Seller", required: true, index: true },
    mappingRef: { type: Schema.Types.ObjectId, ref: "VerticalMapping", required: true, index: true },
    submittedAt: { type: Date, required: true, default: Date.now, index: true },
    saveLead: { type: Boolean, required: true, default: false },
    leadSaved: { type: Boolean, required: true, default: false },
    endpointUrl: { type: String, required: true, trim: true },
    requestBody: { type: Schema.Types.Mixed, required: true },
    status: { type: Number, required: true, default: 0 },
    responseBody: { type: Schema.Types.Mixed, required: false, default: null },
    validationChecks: { type: Schema.Types.Mixed, required: true, default: [] },
    validationPassed: { type: Boolean, required: true, default: false },
  },
  { timestamps: true }
);

mappingTestLeadLogSchema.index({ mappingRef: 1, submittedAt: -1 });

export const MappingTestLeadLogModel =
  models.MappingTestLeadLog ?? model("MappingTestLeadLog", mappingTestLeadLogSchema);
