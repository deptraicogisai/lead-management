import mongoose, { Schema, model, models } from "mongoose";

const requestMappingHeaderSchema = new Schema(
  {
    key: { type: String, required: true, trim: true },
    value: { type: String, required: false, trim: true, default: "" },
  },
  { _id: false }
);

const requestMappingDataRowSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true, default: "String" },
    value: { type: String, required: false, trim: true, default: "" },
  },
  { _id: false }
);

const requestMappingSchema = new Schema(
  {
    requestUrl: { type: String, required: false, trim: true, default: "{{ config.url }}" },
    methodType: { type: String, required: false, trim: true, default: "POST" },
    dataType: { type: String, required: false, trim: true, default: "JSON" },
    payloadType: { type: String, required: false, trim: true, default: "Object" },
    isPrePingEnabled: { type: Boolean, required: false, default: false },
    headers: { type: [requestMappingHeaderSchema], default: [] },
    dataRows: { type: [requestMappingDataRowSchema], default: [] },
  },
  { _id: false }
);

const arrayMappingRowSchema = new Schema(
  {
    label: { type: String, required: true, trim: true },
    mapping: { type: String, required: false, trim: true, default: "" },
  },
  { _id: false }
);

const arrayMappingEntrySchema = new Schema(
  {
    fieldName: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    mappings: { type: [arrayMappingRowSchema], default: [] },
  },
  { _id: false }
);

const responseMappingFieldSchema = new Schema(
  {
    key: { type: String, required: true, trim: true },
    value: { type: String, required: false, trim: true, default: "" },
  },
  { _id: false }
);

const responseMappingSchema = new Schema(
  {
    dataType: { type: String, required: false, trim: true, default: "JSON" },
    fields: { type: [responseMappingFieldSchema], default: [] },
  },
  { _id: false }
);

const configFieldSchema = new Schema(
  {
    variableName: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true, default: "string" },
    required: { type: Boolean, required: true, default: false },
  },
  { _id: false }
);

const integrationBuilderSchema = new Schema(
  {
    displayId: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: ["Active", "Draft", "Paused"], required: true, default: "Active" },
    postingType: { type: String, enum: ["Direct Post", "Ping Post"], required: true, default: "Direct Post" },
    verticalRef: { type: Schema.Types.ObjectId, ref: "Vertical", required: true, index: true },
    arrayMappings: { type: [arrayMappingEntrySchema], default: [] },
    requestMapping: { type: requestMappingSchema, required: false, default: undefined },
    responseMapping: { type: responseMappingSchema, required: false, default: undefined },
    configFields: { type: [configFieldSchema], default: [] },
  },
  { timestamps: true }
);

if (models.IntegrationBuilder) {
  delete mongoose.models.IntegrationBuilder;
}

export const IntegrationBuilderModel = model("IntegrationBuilder", integrationBuilderSchema, "integration_builders");
