import { Types } from "mongoose";
import { MappingTestLeadLogModel } from "@/lib/models/mapping-test-lead-log";
import type { TestLeadValidationCheck } from "@/lib/mapping-test-lead-intake";

export type MappingTestLeadLogRecord = {
  id: string;
  submittedAt: string;
  saveLead: boolean;
  leadSaved: boolean;
  endpointUrl: string;
  requestBody: Record<string, unknown>;
  status: number;
  responseBody: unknown;
  validationChecks: TestLeadValidationCheck[];
  validationPassed: boolean;
};

const MAX_LOGS_PER_MAPPING = 50;

function toLogRecord(doc: {
  _id?: { toString(): string };
  submittedAt?: Date | string;
  saveLead?: boolean;
  leadSaved?: boolean;
  endpointUrl: string;
  requestBody: Record<string, unknown>;
  status: number;
  responseBody?: unknown;
  validationChecks?: TestLeadValidationCheck[];
  validationPassed?: boolean;
}): MappingTestLeadLogRecord {
  return {
    id: doc._id?.toString() ?? "",
    submittedAt: doc.submittedAt ? new Date(doc.submittedAt).toISOString() : new Date().toISOString(),
    saveLead: Boolean(doc.saveLead),
    leadSaved: Boolean(doc.leadSaved),
    endpointUrl: doc.endpointUrl,
    requestBody: doc.requestBody,
    status: doc.status,
    responseBody: doc.responseBody ?? null,
    validationChecks: Array.isArray(doc.validationChecks) ? doc.validationChecks : [],
    validationPassed: Boolean(doc.validationPassed),
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

export async function appendMappingTestLeadLog(params: {
  sellerId: string;
  mappingId: string;
  submittedAt: Date;
  saveLead: boolean;
  leadSaved: boolean;
  endpointUrl: string;
  requestBody: Record<string, unknown>;
  status: number;
  responseBody: unknown;
  validationChecks: TestLeadValidationCheck[];
  validationPassed: boolean;
}) {
  if (!Types.ObjectId.isValid(params.sellerId) || !Types.ObjectId.isValid(params.mappingId)) {
    throw new Error("Invalid seller or mapping id.");
  }

  const created = await MappingTestLeadLogModel.create({
    sellerRef: new Types.ObjectId(params.sellerId),
    mappingRef: new Types.ObjectId(params.mappingId),
    submittedAt: params.submittedAt,
    saveLead: params.saveLead,
    leadSaved: params.leadSaved,
    endpointUrl: params.endpointUrl,
    requestBody: params.requestBody,
    status: params.status,
    responseBody: params.responseBody,
    validationChecks: params.validationChecks,
    validationPassed: params.validationPassed,
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
