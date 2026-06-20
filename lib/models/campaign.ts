import mongoose, { Schema, model, models } from "mongoose";

const campaignGeneralFilterSchema = new Schema(
  {
    fieldId: { type: String, required: true, trim: true },
    fieldName: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    dataTypeFilter: { type: String, enum: ["Text", "Range", "Checkbox", "Multi Select"], required: true },
    multiSelectMode: { type: String, enum: ["included", "excluded"], required: false },
    enabled: { type: Boolean, default: false },
    minValue: { type: String, trim: true },
    maxValue: { type: String, trim: true },
    selectedValues: { type: [String], default: [] },
    textValue: { type: String, trim: true },
  },
  { _id: false }
);

const campaignScheduleRuleSchema = new Schema(
  {
    active: { type: Boolean, default: true },
    action: { type: String, enum: ["Post", "Do not post"], required: true, default: "Post" },
    scheduleMethod: { type: String, enum: ["Days"], default: "Days" },
    days: { type: [String], default: [] },
    startHour: { type: String, default: "00", trim: true },
    startMinute: { type: String, default: "00", trim: true },
    endHour: { type: String, default: "23", trim: true },
    endMinute: { type: String, default: "59", trim: true },
    dailySoldLeadsLimit: { type: Number, default: null },
    dailyPostLeadsLimit: { type: Number, default: null },
  },
  { timestamps: false }
);

const campaignDuplicatesSchema = new Schema(
  {
    duplicateMethod: { type: String, enum: ["Email", "SSN + Email"], default: "Email" },
    duplicateSold: { type: String, default: "OFF", trim: true },
    duplicatePosted: { type: String, default: "OFF", trim: true },
  },
  { _id: false }
);

const campaignSchema = new Schema(
  {
    displayId: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: ["Active", "Paused", "Disabled"], default: "Active", index: true },
    verticalRef: { type: Schema.Types.ObjectId, ref: "Vertical", required: true, index: true },
    buyerRef: { type: Schema.Types.ObjectId, ref: "Buyer", required: true, index: true },
    integrationRef: { type: Schema.Types.ObjectId, ref: "IntegrationBuilder", required: false },
    integrationSettings: {
      postUrl: { type: String, trim: true, default: "" },
      postTimeout: { type: Number, default: 90 },
      configValues: { type: Schema.Types.Mixed, default: {} },
    },
    campaignType: { type: String, enum: ["Redirect", "Silent"], required: true },
    timezone: { type: String, required: true, trim: true, default: "New York (EST/EDT)" },
    minPrice: { type: Number, required: true, default: 0 },
    duplicates: { type: campaignDuplicatesSchema, default: () => ({}) },
    generalFilters: { type: [campaignGeneralFilterSchema], default: [] },
    plDnplListIds: { type: [String], default: [] },
    copyPlDnplToOtherCampaigns: { type: Boolean, default: false },
    scheduleRules: { type: [campaignScheduleRuleSchema], default: [] },
  },
  { timestamps: true }
);

if (models.Campaign) {
  delete mongoose.models.Campaign;
}

export const CampaignModel = model("Campaign", campaignSchema, "campaigns");

export async function getNextCampaignDisplayId() {
  const latest = await CampaignModel.findOne().sort({ displayId: -1 }).select({ displayId: 1 }).lean();
  return (latest?.displayId ?? 0) + 1;
}
