import mongoose, { Schema, model, models } from "mongoose";
import { PUBLISHER_DISTRIBUTION_TYPES } from "@/lib/publisher-distribution";

const distributionAllocationSchema = new Schema(
  {
    configId: { type: String, required: true },
    percent: { type: Number, default: 0, min: 0, max: 100 },
  },
  { _id: false }
);

const publisherDistributionSchema = new Schema(
  {
    sellerRef: { type: Schema.Types.ObjectId, ref: "Seller", required: true, index: true },
    verticalRef: { type: Schema.Types.ObjectId, ref: "Vertical", required: true, index: true },
    // Null means the distribution applies to all publisher channels of the product.
    mappingRef: { type: Schema.Types.ObjectId, ref: "VerticalMapping", default: null, index: true },
    processingType: { type: String, enum: PUBLISHER_DISTRIBUTION_TYPES, required: true, index: true },
    allocations: { type: [distributionAllocationSchema], default: [] },
  },
  { timestamps: true }
);

publisherDistributionSchema.index({ sellerRef: 1, verticalRef: 1, mappingRef: 1, processingType: 1 });

if (models.PublisherDistribution) {
  delete mongoose.models.PublisherDistribution;
}

export const PublisherDistributionModel = model(
  "PublisherDistribution",
  publisherDistributionSchema,
  "publisherdistributions"
);
