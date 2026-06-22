import { Types } from "mongoose";
import { getEffectiveMappingFields } from "@/lib/mapping-fields";
import type { MappingFieldDoc } from "@/lib/mapping-field-api";
import {
  buildDuplicateExistsQuery,
  buildLeadRejectResponse,
  formatLeadRejectResponseBody,
  formatBuyerPostResponseBody,
  validateMappingFieldConfiguration,
} from "@/lib/mapping-lead-validation";
import {
  buildTestLeadIntakeRuleGroups,
  buildTestLeadValidationChecks,
} from "@/lib/mapping-test-lead-intake";
import { appendMappingTestLeadLog } from "@/lib/mapping-test-lead-log";
import {
  evaluateMappingIntakeRulesByCategory,
  toMappingIntakeSettings,
  type MappingIntakeSettingsRecord,
} from "@/lib/mapping-intake-settings";
import { ensureSellerLeadReferencesMigrated, SellerLeadModel } from "@/lib/models/seller-lead";
import { distributeLeadAfterIntake, listPendingBuyerPostCampaigns } from "@/lib/lead-distribution";
import { toMappingRevShareSettings, type MappingRevShareDoc } from "@/lib/mapping-rev-share-settings";
import { buildInitialBuyerPostQueue } from "@/lib/test-lead-buyer-progress";
import type { PingTreeCampaignType } from "@/lib/ping-tree";
import type { MockBuyerPostOptions } from "@/lib/mock-buyer-post";
import type { BuyerPostAttemptSnapshot } from "@/lib/buyer-post-request";
import { resolvePrimaryBuyerPostAttempt } from "@/lib/buyer-post-request";
import { resolveBuyerResponseSnapshot } from "@/lib/mapping-test-lead-log-shared";

type MappingApiField = {
  _id?: { toString(): string };
  sourceVerticalFieldId?: string | null;
  fieldName: string;
  description: string;
  type: string;
  required: boolean;
  format?: string | null;
  emailDuplicateRule?: {
    mode?: "days" | "forever" | null;
    days?: number | null;
  } | null;
  ignoreValues?: string[] | null;
  options?: Array<{ label?: string | null; value?: string | null }> | null;
};

type VerticalApiField = {
  _id?: { toString(): string } | string;
  fieldName: string;
  description: string;
  type: string;
  required: boolean;
  format?: string | null;
  emailDuplicateRule?: {
    mode?: "days" | "forever" | null;
    days?: number | null;
  } | null;
  ignoreValues?: string[] | null;
  options?: Array<{ label?: string | null; value?: string | null }> | null;
};

type MappingIntakeDoc = Parameters<typeof toMappingIntakeSettings>[0];

export type { MappingIntakeDoc };

export type MappingLeadValidationBreakdown = {
  fields: string[];
  duplicates: string[];
  filters: string[];
  schedule: string[];
};

export type MappingLeadValidationResult = {
  breakdown: MappingLeadValidationBreakdown;
  allReasons: string[];
  passed: boolean;
  intakeSettings: MappingIntakeSettingsRecord;
};

function toIntakeFields(apiFields: ReturnType<typeof getEffectiveMappingFields>): MappingFieldDoc[] {
  return apiFields.map((field) => ({
    _id: field.id ? { toString: () => field.id } : undefined,
    fieldName: field.fieldName,
    description: field.description,
    type: field.type,
    required: field.required,
    format: field.format || null,
    dataTypeFilter: field.dataTypeFilter ?? null,
    options: field.options,
  }));
}

function createDuplicateCheckHandlers(
  mappingId: string,
  payload: Record<string, unknown>,
  intakeFields: MappingFieldDoc[],
  postedAt: Date
) {
  return {
    checkDuplicate: async (
      targetMappingId: string,
      duplicateKey: string,
      periodDays: number | null,
      validationStatus?: "success" | "fail"
    ) => {
      if (!duplicateKey || !Types.ObjectId.isValid(targetMappingId)) return false;

      const identityQuery = buildDuplicateExistsQuery(payload, intakeFields, duplicateKey);
      if (!identityQuery) return false;

      const baseFilter: Record<string, unknown> = {
        mappingRef: new Types.ObjectId(targetMappingId),
        ...identityQuery,
      };

      if (periodDays !== null) {
        const threshold = new Date(postedAt);
        threshold.setDate(threshold.getDate() - periodDays);
        baseFilter.postedAt = { $gte: threshold };
      }

      if (validationStatus) {
        baseFilter.validationStatus = validationStatus;
      }

      return Boolean(await SellerLeadModel.exists(baseFilter));
    },
    countLeads: async (
      targetMappingId: string,
      from: Date,
      to: Date,
      validationStatus?: "success"
    ) => {
      if (!Types.ObjectId.isValid(targetMappingId)) return 0;

      const filter: Record<string, unknown> = {
        mappingRef: new Types.ObjectId(targetMappingId),
        postedAt: { $gte: from, $lt: to },
      };

      if (validationStatus) {
        filter.validationStatus = validationStatus;
      }

      return SellerLeadModel.countDocuments(filter);
    },
  };
}

export async function validateMappingLeadIntake(params: {
  mappingId: string;
  mappingDoc: MappingIntakeDoc;
  verticalFields?: VerticalApiField[];
  mappingFields?: MappingApiField[];
  payload: Record<string, unknown>;
  postedAt?: Date;
}): Promise<MappingLeadValidationResult> {
  await ensureSellerLeadReferencesMigrated();

  const postedAt = params.postedAt ?? new Date();
  const apiFields = getEffectiveMappingFields(params.verticalFields ?? [], params.mappingFields ?? []);
  const intakeFields = toIntakeFields(apiFields);
  const intakeSettings = toMappingIntakeSettings(params.mappingDoc, intakeFields);
  const { checkDuplicate, countLeads } = createDuplicateCheckHandlers(
    params.mappingId,
    params.payload,
    intakeFields,
    postedAt
  );

  const fieldReasons = await validateMappingFieldConfiguration(params.payload, apiFields);
  const intakeReasons = await evaluateMappingIntakeRulesByCategory({
    mappingId: params.mappingId,
    payload: params.payload,
    settings: intakeSettings,
    fields: intakeFields,
    postedAt,
    checkDuplicate,
    countLeads,
  });

  const breakdown: MappingLeadValidationBreakdown = {
    fields: fieldReasons,
    duplicates: intakeReasons.duplicateReasons,
    filters: intakeReasons.filterReasons,
    schedule: intakeReasons.scheduleReasons,
  };

  const allReasons = [
    ...breakdown.fields,
    ...breakdown.duplicates,
    ...breakdown.filters,
    ...breakdown.schedule,
  ];

  return {
    breakdown,
    allReasons,
    passed: allReasons.length === 0,
    intakeSettings,
  };
}

export async function runMappingTestLeadSubmit(params: {
  sellerId: string;
  mappingId: string;
  mappingDoc: MappingIntakeDoc;
  verticalFields?: VerticalApiField[];
  mappingFields?: MappingApiField[];
  sellerRef: Types.ObjectId;
  verticalRef?: Types.ObjectId;
  mappingRef: Types.ObjectId;
  payload: Record<string, unknown>;
  saveLead: boolean;
  postToBuyer?: boolean;
  mockBuyerPostOptions?: MockBuyerPostOptions;
  buyerPostProgress?: {
    onPending?: (attempts: BuyerPostAttemptSnapshot[]) => void | Promise<void>;
    onProcessing?: (info: {
      campaignId: string;
      pingTreeType: PingTreeCampaignType;
      campaignOrder: number;
    }) => void | Promise<void>;
    onAttempt?: (attempt: BuyerPostAttemptSnapshot) => void | Promise<void>;
  };
  endpointUrl: string;
  origin: string;
  userAgent?: string;
}) {
  const postedAt = new Date();
  const validationResult = await validateMappingLeadIntake({
    mappingId: params.mappingId,
    mappingDoc: params.mappingDoc,
    verticalFields: params.verticalFields,
    mappingFields: params.mappingFields,
    payload: params.payload,
    postedAt,
  });

  const intakeRules = buildTestLeadIntakeRuleGroups(validationResult.intakeSettings);
  const checks = buildTestLeadValidationChecks(validationResult.breakdown, intakeRules);

  let leadSaved = false;
  let createdLeadId = "";
  let buyerPostAttempts: BuyerPostAttemptSnapshot[] = [];
  let primaryBuyerAttempt = resolvePrimaryBuyerPostAttempt(buyerPostAttempts);
  let buyerPostHint: string | null = null;
  let buyerResponse: Record<string, unknown> | null = null;

  const publisherStatus = validationResult.passed ? 200 : 400;
  let publisherResponse: Record<string, unknown>;

  if (validationResult.passed) {
    publisherResponse = {
      status: 1,
      status_text: "Accepted",
      message: params.saveLead
        ? "Lead passed publisher validation."
        : "Lead passed publisher validation. Test lead data was not saved.",
    };
  } else {
    publisherResponse = buildLeadRejectResponse(validationResult.allReasons) as Record<string, unknown>;
  }

  if (params.saveLead) {
    const createdLead = await SellerLeadModel.create({
      sellerRef: params.sellerRef,
      verticalRef: params.verticalRef,
      mappingRef: params.mappingRef,
      payload: params.payload,
      validationStatus: validationResult.passed ? "success" : "fail",
      validationErrors: validationResult.allReasons,
      postedAt,
      userAgent: params.userAgent ?? "Test Lead UI",
    });
    leadSaved = true;
    createdLeadId = createdLead._id?.toString() ?? "";

    if (validationResult.passed && params.postToBuyer && createdLeadId && params.verticalRef) {
      if (params.buyerPostProgress?.onPending) {
        const pendingCampaigns = await listPendingBuyerPostCampaigns(params.verticalRef.toString(), true);
        await params.buyerPostProgress.onPending(
          buildInitialBuyerPostQueue(pendingCampaigns, postedAt.toISOString())
        );
      }

      const distribution = await distributeLeadAfterIntake({
        sellerLeadId: createdLeadId,
        sellerRefId: params.sellerRef.toString(),
        verticalRefId: params.verticalRef.toString(),
        payload: params.payload,
        postedAt,
        origin: params.origin,
        postToBuyer: true,
        mockBuyerPost: true,
        mockBuyerPostOptions: params.mockBuyerPostOptions,
        revShareSettings: toMappingRevShareSettings((params.mappingDoc as { revShare?: MappingRevShareDoc }).revShare),
        progress: {
          onBuyerPostProcessing: params.buyerPostProgress?.onProcessing,
          onBuyerPostAttempt: params.buyerPostProgress?.onAttempt,
        },
      });

      buyerPostAttempts = distribution.buyerPostAttempts;
      primaryBuyerAttempt = resolvePrimaryBuyerPostAttempt(buyerPostAttempts);
      buyerPostHint = distribution.buyerPostHint ?? null;

      const buyerResponseSnapshot = resolveBuyerResponseSnapshot({
        postToBuyer: true,
        validationPassed: true,
        buyerPostAttempts,
        buyerResponse: null,
        buyerStatus: null,
      });
      buyerResponse = buyerResponseSnapshot.postedToBuyer
        ? (buyerResponseSnapshot.responseBody as Record<string, unknown>)
        : formatLeadRejectResponseBody(buyerResponseSnapshot.responseBody);
    }

    if (validationResult.passed) {
      publisherResponse = {
        status: 1,
        status_text: "Accepted",
        message: params.postToBuyer
          ? "Lead passed publisher validation. Buyer posting runs as a separate step."
          : "Test lead saved successfully.",
        lead_id: createdLeadId,
      };
    }
  } else if (validationResult.passed && params.postToBuyer && !params.saveLead) {
    publisherResponse = {
      ...publisherResponse,
      message: "Lead passed publisher validation. Enable Save lead to post to buyer.",
    };
  }

  const log = await appendMappingTestLeadLog({
    sellerId: params.sellerId,
    mappingId: params.mappingId,
    submittedAt: postedAt,
    saveLead: params.saveLead,
    postToBuyer: Boolean(params.postToBuyer),
    leadSaved,
    endpointUrl: params.endpointUrl,
    requestBody: params.payload,
    buyerPostAttempts,
    postedBuyerRequest: primaryBuyerAttempt?.request ?? null,
    postedBuyerResponse: primaryBuyerAttempt?.response ?? null,
    publisherStatus,
    publisherResponse,
    validationChecks: checks,
    validationPassed: validationResult.passed,
    buyerPostHint,
    buyerResponse,
  });

  return {
    passed: validationResult.passed,
    checks,
    reasons: validationResult.allReasons,
    status: publisherStatus,
    responseBody: publisherResponse,
    leadSaved,
    log,
  };
}
