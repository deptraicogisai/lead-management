import { Types } from "mongoose";
import { MappingTestLeadLogModel } from "@/lib/models/mapping-test-lead-log";
import type { TestLeadValidationCheck } from "@/lib/mapping-test-lead-intake";
import type {
  BuyerHttpRequestSnapshot,
  BuyerHttpResponseSnapshot,
  BuyerPostAttemptSnapshot,
} from "@/lib/buyer-post-request";
import { resolvePrimaryBuyerPostAttempt } from "@/lib/buyer-post-request";
import {
  resolvePublisherLogSnapshot,
  type MappingTestLeadLogRecord,
} from "@/lib/mapping-test-lead-log-shared";

export type { MappingTestLeadLogRecord } from "@/lib/mapping-test-lead-log-shared";
export { resolveBuyerLogSnapshot, resolveBuyerResponseSnapshot, resolvePrimaryCampaignValidationChecks, resolvePublisherLogSnapshot, buildSystemBuyerValidationStep, normalizeCampaignValidationChecksForDisplay, isCampaignIntakeValidationPassed } from "@/lib/mapping-test-lead-log-shared";

const MAX_LOGS_PER_MAPPING = 50;

function resolvePostedBuyerSnapshots(
  buyerPostAttempts: BuyerPostAttemptSnapshot[],
  postedBuyerRequest?: BuyerHttpRequestSnapshot | null,
  postedBuyerResponse?: BuyerHttpResponseSnapshot | null
) {
  if (postedBuyerRequest) {
    return {
      postedBuyerRequest,
      postedBuyerResponse: postedBuyerResponse ?? null,
    };
  }

  const primaryAttempt = resolvePrimaryBuyerPostAttempt(buyerPostAttempts);
  if (!primaryAttempt || primaryAttempt.postedToBuyer === false) {
    return {
      postedBuyerRequest: null,
      postedBuyerResponse: primaryAttempt?.response ?? null,
    };
  }

  return {
    postedBuyerRequest: primaryAttempt.request,
    postedBuyerResponse: primaryAttempt.response,
  };
}

function toLogRecord(doc: {
  _id?: { toString(): string };
  submittedAt?: Date | string;
  saveLead?: boolean;
  postToBuyer?: boolean;
  leadSaved?: boolean;
  endpointUrl: string;
  requestBody: Record<string, unknown>;
  buyerPostAttempts?: BuyerPostAttemptSnapshot[];
  postedBuyerRequest?: BuyerHttpRequestSnapshot | null;
  postedBuyerResponse?: BuyerHttpResponseSnapshot | null;
  publisherStatus?: number | null;
  publisherResponse?: Record<string, unknown> | null;
  status: number;
  responseBody?: unknown;
  validationChecks?: TestLeadValidationCheck[];
  validationPassed?: boolean;
  buyerPostHint?: string | null;
  buyerStatus?: number | null;
  buyerResponse?: Record<string, unknown> | null;
}): MappingTestLeadLogRecord {
  const buyerPostAttempts = Array.isArray(doc.buyerPostAttempts) ? doc.buyerPostAttempts : [];
  const postedSnapshots = resolvePostedBuyerSnapshots(
    buyerPostAttempts,
    doc.postedBuyerRequest,
    doc.postedBuyerResponse
  );
  const draftRecord = {
    validationPassed: Boolean(doc.validationPassed),
    publisherStatus: doc.publisherStatus,
    publisherResponse: doc.publisherResponse,
    status: doc.status,
    responseBody: doc.responseBody ?? null,
    saveLead: Boolean(doc.saveLead),
    leadSaved: Boolean(doc.leadSaved),
  };
  const publisherSnapshot = resolvePublisherLogSnapshot(draftRecord);

  return {
    id: doc._id?.toString() ?? "",
    submittedAt: doc.submittedAt ? new Date(doc.submittedAt).toISOString() : new Date().toISOString(),
    saveLead: Boolean(doc.saveLead),
    postToBuyer: Boolean(doc.postToBuyer),
    leadSaved: Boolean(doc.leadSaved),
    endpointUrl: doc.endpointUrl,
    requestBody: doc.requestBody,
    buyerPostAttempts,
    postedBuyerRequest: postedSnapshots.postedBuyerRequest,
    postedBuyerResponse: postedSnapshots.postedBuyerResponse,
    publisherStatus: publisherSnapshot.status,
    publisherResponse: publisherSnapshot.responseBody,
    status: publisherSnapshot.status,
    responseBody: publisherSnapshot.responseBody,
    validationChecks: Array.isArray(doc.validationChecks) ? doc.validationChecks : [],
    validationPassed: Boolean(doc.validationPassed),
    buyerPostHint: typeof doc.buyerPostHint === "string" ? doc.buyerPostHint : null,
    buyerStatus: typeof doc.buyerStatus === "number" ? doc.buyerStatus : null,
    buyerResponse:
      doc.buyerResponse && typeof doc.buyerResponse === "object" && !Array.isArray(doc.buyerResponse)
        ? (doc.buyerResponse as Record<string, unknown>)
        : null,
  };
}

export async function listMappingTestLeadLogs(mappingId: string, limit = MAX_LOGS_PER_MAPPING) {
  if (!Types.ObjectId.isValid(mappingId)) {
    return [];
  }

  const docs = await MappingTestLeadLogModel.find({ mappingRef: new Types.ObjectId(mappingId) })
    .sort({ submittedAt: -1 })
    .limit(limit)
    .lean();

  return docs.map((doc) => toLogRecord(doc as Parameters<typeof toLogRecord>[0]));
}

export async function clearMappingTestLeadLogs(mappingId: string) {
  if (!Types.ObjectId.isValid(mappingId)) {
    return { deletedCount: 0 };
  }

  const result = await MappingTestLeadLogModel.deleteMany({ mappingRef: new Types.ObjectId(mappingId) });
  return { deletedCount: result.deletedCount ?? 0 };
}

export async function appendMappingTestLeadLog(params: {
  sellerId: string;
  mappingId: string;
  submittedAt: Date;
  saveLead: boolean;
  postToBuyer: boolean;
  leadSaved: boolean;
  endpointUrl: string;
  requestBody: Record<string, unknown>;
  buyerPostAttempts?: BuyerPostAttemptSnapshot[];
  postedBuyerRequest?: BuyerHttpRequestSnapshot | null;
  postedBuyerResponse?: BuyerHttpResponseSnapshot | null;
  publisherStatus: number;
  publisherResponse: Record<string, unknown>;
  validationChecks: TestLeadValidationCheck[];
  validationPassed: boolean;
  buyerPostHint?: string | null;
  buyerStatus?: number | null;
  buyerResponse?: Record<string, unknown> | null;
}) {
  if (!Types.ObjectId.isValid(params.sellerId) || !Types.ObjectId.isValid(params.mappingId)) {
    throw new Error("Invalid seller or mapping id.");
  }

  const buyerPostAttempts = params.buyerPostAttempts ?? [];
  const postedSnapshots = resolvePostedBuyerSnapshots(
    buyerPostAttempts,
    params.postedBuyerRequest,
    params.postedBuyerResponse
  );

  const created = await MappingTestLeadLogModel.create({
    sellerRef: new Types.ObjectId(params.sellerId),
    mappingRef: new Types.ObjectId(params.mappingId),
    submittedAt: params.submittedAt,
    saveLead: params.saveLead,
    postToBuyer: params.postToBuyer,
    leadSaved: params.leadSaved,
    endpointUrl: params.endpointUrl,
    requestBody: params.requestBody,
    buyerPostAttempts,
    postedBuyerRequest: postedSnapshots.postedBuyerRequest,
    postedBuyerResponse: postedSnapshots.postedBuyerResponse,
    publisherStatus: params.publisherStatus,
    publisherResponse: params.publisherResponse,
    status: params.publisherStatus,
    responseBody: params.publisherResponse,
    validationChecks: params.validationChecks,
    validationPassed: params.validationPassed,
    buyerPostHint: params.buyerPostHint?.trim() || "",
    buyerStatus: typeof params.buyerStatus === "number" ? params.buyerStatus : null,
    buyerResponse: params.buyerResponse ?? null,
  });

  const excessCount = await MappingTestLeadLogModel.countDocuments({
    mappingRef: new Types.ObjectId(params.mappingId),
  });

  if (excessCount > MAX_LOGS_PER_MAPPING) {
    const staleLogs = await MappingTestLeadLogModel.find({ mappingRef: new Types.ObjectId(params.mappingId) })
      .sort({ submittedAt: -1 })
      .skip(MAX_LOGS_PER_MAPPING)
      .select("_id")
      .lean();

    const staleIds = staleLogs.map((doc) => doc._id).filter(Boolean);
    if (staleIds.length > 0) {
      await MappingTestLeadLogModel.deleteMany({ _id: { $in: staleIds } });
    }
  }

  return toLogRecord(created.toObject());
}
