import { Types } from "mongoose";
import type { BuyerHttpRequestSnapshot, BuyerHttpResponseSnapshot } from "@/lib/buyer-post-request";
import { CampaignTestLeadLogModel } from "@/lib/models/campaign-test-lead-log";

export type CampaignTestLeadLogRecord = {
  id: string;
  displayId: number;
  submittedAt: string;
  leadData: Record<string, unknown>;
  buyerRequest: BuyerHttpRequestSnapshot | null;
  buyerResponse: BuyerHttpResponseSnapshot | null;
  buyerStatus: string;
  statusCode: string;
  message: string;
  price: number | null;
  processingTimeSeconds: number;
  errorReason: string;
};

const MAX_LOGS_PER_CAMPAIGN = 50;

function toLogRecord(doc: {
  _id?: { toString(): string };
  displayId?: number;
  submittedAt?: Date | string;
  leadData?: Record<string, unknown>;
  buyerRequest?: BuyerHttpRequestSnapshot | null;
  buyerResponse?: BuyerHttpResponseSnapshot | null;
  buyerStatus?: string;
  statusCode?: string;
  message?: string;
  price?: number | null;
  processingTimeSeconds?: number;
  errorReason?: string;
}): CampaignTestLeadLogRecord {
  return {
    id: doc._id?.toString() ?? "",
    displayId: typeof doc.displayId === "number" ? doc.displayId : 0,
    submittedAt: doc.submittedAt ? new Date(doc.submittedAt).toISOString() : new Date().toISOString(),
    leadData: doc.leadData && typeof doc.leadData === "object" && !Array.isArray(doc.leadData) ? doc.leadData : {},
    buyerRequest: doc.buyerRequest ?? null,
    buyerResponse: doc.buyerResponse ?? null,
    buyerStatus: doc.buyerStatus?.trim() || "Error",
    statusCode: doc.statusCode?.trim() ?? "",
    message: doc.message?.trim() ?? "",
    price: typeof doc.price === "number" ? doc.price : null,
    processingTimeSeconds: typeof doc.processingTimeSeconds === "number" ? doc.processingTimeSeconds : 0,
    errorReason: doc.errorReason?.trim() ?? "",
  };
}

export async function listCampaignTestLeadLogs(campaignId: string, limit = MAX_LOGS_PER_CAMPAIGN) {
  if (!Types.ObjectId.isValid(campaignId)) {
    return [];
  }

  const docs = await CampaignTestLeadLogModel.find({ campaignRef: new Types.ObjectId(campaignId) })
    .sort({ submittedAt: -1 })
    .limit(limit)
    .lean();

  return docs.map((doc, index) => {
    const record = toLogRecord(doc);
    if (!record.displayId) {
      record.displayId = docs.length - index;
    }
    return record;
  });
}

export async function clearCampaignTestLeadLogs(campaignId: string) {
  if (!Types.ObjectId.isValid(campaignId)) {
    return { deletedCount: 0 };
  }

  return CampaignTestLeadLogModel.deleteMany({ campaignRef: new Types.ObjectId(campaignId) });
}

export async function appendCampaignTestLeadLog(params: {
  campaignId: string;
  leadData: Record<string, unknown>;
  buyerRequest: BuyerHttpRequestSnapshot | null;
  buyerResponse: BuyerHttpResponseSnapshot | null;
  buyerStatus: string;
  statusCode: string;
  message: string;
  price: number | null;
  processingTimeSeconds: number;
  errorReason: string;
}) {
  const campaignObjectId = new Types.ObjectId(params.campaignId);
  const latest = await CampaignTestLeadLogModel.findOne({ campaignRef: campaignObjectId })
    .sort({ displayId: -1 })
    .select({ displayId: 1 })
    .lean();
  const displayId = (typeof latest?.displayId === "number" ? latest.displayId : 0) + 1;

  const created = await CampaignTestLeadLogModel.create({
    campaignRef: campaignObjectId,
    displayId,
    submittedAt: new Date(),
    leadData: params.leadData,
    buyerRequest: params.buyerRequest,
    buyerResponse: params.buyerResponse,
    buyerStatus: params.buyerStatus,
    statusCode: params.statusCode,
    message: params.message,
    price: params.price,
    processingTimeSeconds: params.processingTimeSeconds,
    errorReason: params.errorReason,
  });

  const excessCount = await CampaignTestLeadLogModel.countDocuments({
    campaignRef: new Types.ObjectId(params.campaignId),
  });

  if (excessCount > MAX_LOGS_PER_CAMPAIGN) {
    const staleLogs = await CampaignTestLeadLogModel.find({ campaignRef: new Types.ObjectId(params.campaignId) })
      .sort({ submittedAt: 1 })
      .limit(excessCount - MAX_LOGS_PER_CAMPAIGN)
      .select({ _id: 1 })
      .lean();
    const staleIds = staleLogs.map((log) => log._id).filter(Boolean);

    if (staleIds.length > 0) {
      await CampaignTestLeadLogModel.deleteMany({ _id: { $in: staleIds } });
    }
  }

  return toLogRecord(created.toObject());
}
