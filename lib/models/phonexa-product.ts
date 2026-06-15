import { Schema, model, models } from "mongoose";

const phonexaProductFieldSchema = new Schema(
  {
    fieldName: { type: String, required: true, trim: true },
    required: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    format: { type: String, required: false, trim: true, default: null },
    example: { type: String, required: false, trim: true, default: null },
    options: { type: Schema.Types.Mixed, required: false, default: null },
  },
  { _id: false }
);

const phonexaProductSchema = new Schema(
  {
    productId: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    postingUrl: { type: String, required: false, trim: true, default: null },
    requestLinks: { type: Schema.Types.Mixed, required: false, default: null },
    fields: { type: [phonexaProductFieldSchema], default: [] },
    pingData: { type: [phonexaProductFieldSchema], default: [] },
    pingpostData: { type: [phonexaProductFieldSchema], default: [] },
    requestSamples: { type: Schema.Types.Mixed, required: false, default: null },
    responseSamples: { type: Schema.Types.Mixed, required: false, default: null },
    syncedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

export const PhonexaProductModel =
  models.PhonexaProduct || model("PhonexaProduct", phonexaProductSchema, "phonexa_products");
