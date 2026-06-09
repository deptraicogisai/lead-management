import mongoose, { Schema, model, models } from "mongoose";

const buyerMappingSchema = new Schema(
  {
    source: { type: String, required: true, trim: true },
    destination: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const buyerSchema = new Schema(
  {
    displayId: { type: Number, required: false, unique: true, sparse: true, index: true },
    name: { type: String, required: false, trim: true },
    buyerLabel: { type: String, default: "-", trim: true },
    buyerType: { type: String, default: "-", trim: true },
    personalManagerId: { type: String, default: "", trim: true },
    personalManagerName: { type: String, default: "", trim: true },
    prepaid: { type: Boolean, default: false },
    lastTrafficAt: { type: Date, required: false },
    questionnaireStatus: { type: String, enum: ["Pending", "Completed"], default: "Pending" },
    quality: { type: String, default: "M", trim: true },
    firstName: { type: String, default: "", trim: true },
    lastName: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    company: { type: String, default: "", trim: true },
    verticalRef: { type: Schema.Types.ObjectId, ref: "Vertical", required: false, index: true },
    apiKey: { type: String, default: "", trim: true },
    postLeadUrl: { type: String, default: "", trim: true },
    status: { type: String, enum: ["Active", "Inactive", "Disabled", "Paused"], required: true, default: "Active" },
    integrationRefs: [{ type: Schema.Types.ObjectId, ref: "IntegrationBuilder", default: [] }],
    mappings: { type: [buyerMappingSchema], default: [] },
  },
  { timestamps: true }
);

if (models.Buyer) {
  delete mongoose.models.Buyer;
}

export const BuyerModel = model("Buyer", buyerSchema);

let buyerMigrationPromise: Promise<void> | null = null;

export async function ensureBuyerFieldsMigrated() {
  if (!buyerMigrationPromise) {
    buyerMigrationPromise = (async () => {
      const buyers = await BuyerModel.find().sort({ createdAt: 1 }).lean();
      let nextDisplayId =
        (
          await BuyerModel.findOne({ displayId: { $exists: true } })
            .sort({ displayId: -1 })
            .select({ displayId: 1 })
            .lean()
        )?.displayId ?? 0;

      for (const buyer of buyers) {
        const updates: Record<string, unknown> = {};

        if (!buyer.displayId) {
          nextDisplayId += 1;
          updates.displayId = nextDisplayId;
        }

        if (!buyer.name?.trim()) {
          const resolvedName =
            buyer.company?.trim() ||
            `${buyer.firstName ?? ""} ${buyer.lastName ?? ""}`.trim() ||
            "Unnamed Buyer";
          updates.name = resolvedName;
          if (!buyer.company?.trim()) {
            updates.company = resolvedName;
          }
        }

        if (buyer.status === "Disabled" || buyer.status === "Paused") {
          updates.status = "Inactive";
        }

        if (Object.keys(updates).length > 0) {
          await BuyerModel.updateOne({ _id: buyer._id }, { $set: updates });
        }
      }
    })().catch((error) => {
      buyerMigrationPromise = null;
      throw error;
    });
  }

  await buyerMigrationPromise;
}
