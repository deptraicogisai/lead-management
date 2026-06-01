import { Schema, model, models } from "mongoose";

const buyerMappingSchema = new Schema(
  {
    source: { type: String, required: true, trim: true },
    destination: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const buyerSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    company: { type: String, required: true, trim: true },
    verticalRef: { type: Schema.Types.ObjectId, ref: "Vertical", required: false, index: true },
    apiKey: { type: String, required: true, trim: true },
    postLeadUrl: { type: String, required: true, trim: true },
    status: { type: String, enum: ["Active", "Paused"], required: true },
    mappings: { type: [buyerMappingSchema], default: [] },
  },
  { timestamps: true }
);

export const BuyerModel = models.Buyer || model("Buyer", buyerSchema);
