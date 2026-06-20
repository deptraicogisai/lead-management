import { Types } from "mongoose";
import {
  defaultCampaignDuplicates,
  resolveCampaignTimezone,
  type CampaignDuplicatesSettings,
  type CampaignGeneralFilter,
  type CampaignScheduleRule,
} from "@/lib/campaign";
import {
  evaluateMappingIntakeRulesByCategory,
  type MappingIntakeSettingsRecord,
} from "@/lib/mapping-intake-settings";
import type { MappingFieldDoc } from "@/lib/mapping-field-api";
import { LeadDeliveryModel } from "@/lib/models/lead-delivery";
import { evaluatePlDnplForCampaign, describePlDnplRuleLines } from "@/lib/pl-dnpl-evaluation";
import type { BuyerPostValidationCheck } from "@/lib/buyer-post-trace";
import {
  buildCampaignIntakeRuleGroups,
  finalizeCampaignValidationCheckMessages,
} from "@/lib/campaign-test-lead-intake";

type CampaignValidationDoc = {
  _id?: { toString(): string };
  timezone?: string | null;
  duplicates?: Partial<CampaignDuplicatesSettings> | null;
  generalFilters?: Array<
    Omit<CampaignGeneralFilter, "minValue" | "maxValue" | "textValue" | "selectedValues" | "multiSelectMode"> & {
      multiSelectMode?: CampaignGeneralFilter["multiSelectMode"] | null;
      minValue?: string | null;
      maxValue?: string | null;
      textValue?: string | null;
      selectedValues?: Array<string | null> | null;
    }
  > | null;
  scheduleRules?: Array<
    Omit<CampaignScheduleRule, "id" | "dailySoldLeadsLimit" | "dailyPostLeadsLimit"> & {
      _id?: { toString(): string };
      dailySoldLeadsLimit?: number | null;
      dailyPostLeadsLimit?: number | null;
    }
  > | null;
  plDnplListIds?: string[] | null;
};

type BuyerPublisherDoc = {
  allowedPublisherRefs?: Array<{ toString(): string } | string> | null;
  blockedPublisherRefs?: Array<{ toString(): string } | string> | null;
  plDnplListIds?: string[] | null;
};

function toCampaignIntakeSettings(
  campaign: CampaignValidationDoc,
  campaignFields: MappingFieldDoc[]
): MappingIntakeSettingsRecord {
  const existingFilters = Array.isArray(campaign.generalFilters)
    ? campaign.generalFilters.map((filter) => ({
        fieldId: filter.fieldId,
        fieldName: filter.fieldName,
        description: filter.description,
        dataTypeFilter: filter.dataTypeFilter,
        multiSelectMode: filter.multiSelectMode ?? undefined,
        enabled: Boolean(filter.enabled),
        minValue: filter.minValue ?? undefined,
        maxValue: filter.maxValue ?? undefined,
        textValue: filter.textValue ?? undefined,
        selectedValues: Array.isArray(filter.selectedValues)
          ? filter.selectedValues.filter((value): value is string => typeof value === "string")
          : [],
      }))
    : [];

  return {
    timezone: resolveCampaignTimezone(campaign.timezone),
    duplicates: {
      ...defaultCampaignDuplicates(),
      ...(campaign.duplicates ?? {}),
    },
    generalFilters: existingFilters,
    scheduleRules: Array.isArray(campaign.scheduleRules)
      ? campaign.scheduleRules.map((rule) => ({
          id: rule._id?.toString() ?? "",
          active: Boolean(rule.active),
          action: rule.action ?? "Post",
          scheduleMethod: rule.scheduleMethod ?? "Days",
          days: Array.isArray(rule.days) ? rule.days : [],
          startHour: rule.startHour ?? "00",
          startMinute: rule.startMinute ?? "00",
          endHour: rule.endHour ?? "23",
          endMinute: rule.endMinute ?? "59",
          dailySoldLeadsLimit: rule.dailySoldLeadsLimit ?? null,
          dailyPostLeadsLimit: rule.dailyPostLeadsLimit ?? null,
        }))
      : [],
  };
}

function resolvePublisherRefIds(values?: Array<{ toString(): string } | string> | null) {
  return (values ?? [])
    .map((value) => (typeof value === "string" ? value : value.toString()))
    .filter(Boolean);
}

export function isPublisherAllowedForBuyer(buyer: BuyerPublisherDoc, sellerRefId: string) {
  const sellerId = sellerRefId.trim();
  if (!sellerId) return false;

  const blocked = resolvePublisherRefIds(buyer.blockedPublisherRefs);
  if (blocked.includes(sellerId)) {
    return false;
  }

  const allowed = resolvePublisherRefIds(buyer.allowedPublisherRefs);
  if (allowed.length > 0 && !allowed.includes(sellerId)) {
    return false;
  }

  return true;
}

function buildDuplicateFingerprint(payload: Record<string, unknown>, method: CampaignDuplicatesSettings["duplicateMethod"]) {
  const email = String(payload.email ?? payload.Email ?? "").trim().toLowerCase();
  const ssn = String(payload.ssn ?? payload.SSN ?? "").trim().toLowerCase();

  if (method === "SSN + Email") {
    return `${ssn}|${email}`;
  }
  return email;
}

async function checkCampaignDuplicate(params: {
  campaignId: string;
  payload: Record<string, unknown>;
  duplicates: CampaignDuplicatesSettings;
  mode: "sold" | "posted";
}) {
  const setting = params.mode === "sold" ? params.duplicates.duplicateSold : params.duplicates.duplicatePosted;
  if (!setting || setting.trim().toUpperCase() === "OFF") {
    return false;
  }

  const fingerprint = buildDuplicateFingerprint(params.payload, params.duplicates.duplicateMethod);
  if (!fingerprint || fingerprint === "|") {
    return false;
  }

  const campaignObjectId = new Types.ObjectId(params.campaignId);
  const statusFilter = params.mode === "sold" ? { buyerStatus: "Accept" } : {};

  const existing = await LeadDeliveryModel.findOne({
    campaignRef: campaignObjectId,
    duplicateFingerprint: fingerprint,
    ...statusFilter,
  })
    .select({ _id: 1 })
    .lean();

  return Boolean(existing);
}

export async function validateCampaignLeadIntake(params: {
  campaign: CampaignValidationDoc;
  campaignFields: MappingFieldDoc[];
  buyer: BuyerPublisherDoc;
  sellerRefId: string;
  payload: Record<string, unknown>;
  postedAt: Date;
}) {
  const reasons: string[] = [];
  const campaignId = params.campaign._id?.toString() ?? "";
  const intakeSettings = toCampaignIntakeSettings(params.campaign, params.campaignFields);
  const plDnplRuleLinesPromise = describePlDnplRuleLines({
    buyerPlDnplListIds: params.buyer.plDnplListIds ?? [],
    campaignPlDnplListIds: params.campaign.plDnplListIds ?? [],
  });

  const publisherAllowed = isPublisherAllowedForBuyer(params.buyer, params.sellerRefId);
  const publisherMessages = publisherAllowed
    ? []
    : ["Publisher is not allowed to post to this buyer."];
  if (!publisherAllowed) {
    reasons.push(...publisherMessages);
  }
  const publisherCheck: BuyerPostValidationCheck = {
    category: "Publisher",
    passed: publisherAllowed,
    messages:
      publisherMessages.length > 0 ? publisherMessages : ["Publisher is allowed for this buyer."],
  };

  const plDnplResult = await evaluatePlDnplForCampaign({
    buyerPlDnplListIds: params.buyer.plDnplListIds ?? [],
    campaignPlDnplListIds: params.campaign.plDnplListIds ?? [],
    payload: params.payload,
  });
  reasons.push(...plDnplResult.reasons);

  const duplicateSold = await checkCampaignDuplicate({
    campaignId,
    payload: params.payload,
    duplicates: intakeSettings.duplicates,
    mode: "sold",
  });
  const duplicateSoldMessages = duplicateSold ? ["Duplicate sold lead detected for this campaign."] : [];
  if (duplicateSold) {
    reasons.push(...duplicateSoldMessages);
  }

  const duplicatePosted = await checkCampaignDuplicate({
    campaignId,
    payload: params.payload,
    duplicates: intakeSettings.duplicates,
    mode: "posted",
  });
  const duplicatePostedMessages = duplicatePosted
    ? ["Duplicate posted lead detected for this campaign."]
    : [];
  if (duplicatePosted) {
    reasons.push(...duplicatePostedMessages);
  }

  const intakeReasons = await evaluateMappingIntakeRulesByCategory({
    mappingId: campaignId,
    payload: params.payload,
    settings: intakeSettings,
    fields: params.campaignFields,
    postedAt: params.postedAt,
    checkDuplicate: async () => false,
    countLeads: async (_mappingId, from, to, validationStatus) => {
      const campaignObjectId = new Types.ObjectId(campaignId);
      const filter: Record<string, unknown> = {
        campaignRef: campaignObjectId,
        postedAt: { $gte: from, $lte: to },
      };

      if (validationStatus === "success") {
        filter.buyerStatus = "Accept";
      }

      return LeadDeliveryModel.countDocuments(filter);
    },
  });

  reasons.push(...intakeReasons.filterReasons, ...intakeReasons.scheduleReasons);

  const plDnplRuleLines = await plDnplRuleLinesPromise;
  const intakeRuleGroups = buildCampaignIntakeRuleGroups(intakeSettings, plDnplRuleLines);
  const duplicatesPassed = !duplicateSold && !duplicatePosted;
  const duplicateFailureMessages = [...duplicateSoldMessages, ...duplicatePostedMessages];
  const filtersPassed = intakeReasons.filterReasons.length === 0;
  const schedulePassed = intakeReasons.scheduleReasons.length === 0;
  const plDnplPassed = !plDnplResult.blocked;

  const campaignValidationChecks: BuyerPostValidationCheck[] = [
    {
      category: "Duplicates",
      passed: duplicatesPassed,
      messages: finalizeCampaignValidationCheckMessages(
        "Duplicates",
        duplicatesPassed,
        duplicateFailureMessages,
        intakeRuleGroups
      ),
    },
    {
      category: "Filters",
      passed: filtersPassed,
      messages: finalizeCampaignValidationCheckMessages(
        "Filters",
        filtersPassed,
        intakeReasons.filterReasons,
        intakeRuleGroups
      ),
    },
    {
      category: "Schedule",
      passed: schedulePassed,
      messages: finalizeCampaignValidationCheckMessages(
        "Schedule",
        schedulePassed,
        intakeReasons.scheduleReasons,
        intakeRuleGroups
      ),
    },
    {
      category: "PL/DNPL",
      passed: plDnplPassed,
      messages: finalizeCampaignValidationCheckMessages(
        "PL/DNPL",
        plDnplPassed,
        plDnplResult.reasons,
        intakeRuleGroups
      ),
    },
    publisherCheck,
  ];

  return {
    passed: reasons.length === 0,
    reasons,
    intakeSettings,
    intakeRuleGroups,
    validationChecks: campaignValidationChecks,
  };
}

export function attachDuplicateFingerprint(payload: Record<string, unknown>, duplicates: CampaignDuplicatesSettings) {
  return {
    ...payload,
    __duplicateFingerprint: buildDuplicateFingerprint(payload, duplicates.duplicateMethod),
  };
}
