import mongoose, { Schema, model, models } from "mongoose";
import { PING_TREE_PROCESSING_TYPES } from "@/lib/ping-tree-config";

const pingTreeAllocationSchema = new Schema(
  {
    bucketKey: { type: String, required: true, unique: true, index: true },
    verticalRef: { type: Schema.Types.ObjectId, ref: "Vertical", required: true, index: true },
    processingType: { type: String, enum: PING_TREE_PROCESSING_TYPES, required: true, index: true },
    counts: { type: Schema.Types.Mixed, default: {} },
    total: { type: Number, default: 0, min: 0 },
    version: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

if (models.PingTreeAllocation) {
  delete mongoose.models.PingTreeAllocation;
}

export const PingTreeAllocationModel = model(
  "PingTreeAllocation",
  pingTreeAllocationSchema,
  "pingtreeallocations"
);
