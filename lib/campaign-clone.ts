import { Types } from "mongoose";
import {
  defaultCampaignDuplicates,
  normalizeGeneralFiltersForStorage,
  type CampaignDuplicatesSettings,
  type CampaignGeneralFilter,
  type CampaignType,
} from "@/lib/campaign";
import { cloneScheduleRulesForCopy } from "@/lib/campaign-schedule-copy";
import { buildClonedCampaignName } from "@/lib/campaign-clone-name";
import { normalizeCampaignIntegrationConfigValues } from "@/lib/campaign-integration-config";

export type CloneableCampaign = {
  verticalRef?: Types.ObjectId | { toString(): string } | string | null;
  buyerRef?: Types.ObjectId | { toString(): string } | string | null;
  integrationRef?: Types.ObjectId | { toString(): string } | string | null;
  campaignType: CampaignType;
  timezone: string;
  duplicates?: CampaignDuplicatesSettings;
  generalFilters?: CampaignGeneralFilter[] | null;
  plDnplListIds?: string[];
  copyPlDnplToOtherCampaigns?: boolean;
  scheduleRules?: Array<{
    active?: boolean;
    action: "Post" | "Do not post";
    scheduleMethod?: "Days";
    days?: string[];
    startHour?: string;
    startMinute?: string;
    endHour?: string;
    endMinute?: string;
    dailySoldLeadsLimit?: number | null;
    dailyPostLeadsLimit?: number | null;
  }>;
  integrationSettings?: {
    configValues?: Record<string, string> | null;
  } | null;
};

function resolveObjectId(
  value: CloneableCampaign["verticalRef"],
  errorMessage: string
): Types.ObjectId {
  if (value instanceof Types.ObjectId) {
    return value;
  }

  if (value && typeof value === "object" && "toString" in value) {
    return new Types.ObjectId(value.toString());
  }

  if (typeof value === "string" && Types.ObjectId.isValid(value)) {
    return new Types.ObjectId(value);
  }

  throw new Error(errorMessage);
}

export { buildClonedCampaignName } from "@/lib/campaign-clone-name";

export function buildClonedCampaignCreateData(
  source: CloneableCampaign,
  baseName: string,
  minPrice: number
) {
  const scheduleRules = (source.scheduleRules ?? []).map((rule) => ({
    active: Boolean(rule.active),
    action: rule.action,
    scheduleMethod: rule.scheduleMethod ?? "Days",
    days: rule.days ?? [],
    startHour: rule.startHour ?? "00",
    startMinute: rule.startMinute ?? "00",
    endHour: rule.endHour ?? "23",
    endMinute: rule.endMinute ?? "59",
    dailySoldLeadsLimit: rule.dailySoldLeadsLimit ?? null,
    dailyPostLeadsLimit: rule.dailyPostLeadsLimit ?? null,
  }));

  return {
    name: buildClonedCampaignName(baseName, minPrice),
    status: "Active" as const,
    verticalRef: resolveObjectId(source.verticalRef, "Source campaign is missing a valid product."),
    buyerRef: resolveObjectId(source.buyerRef, "Source campaign is missing a valid buyer."),
    integrationRef: source.integrationRef
      ? resolveObjectId(source.integrationRef, "Source campaign has an invalid integration.")
      : undefined,
    campaignType: source.campaignType,
    timezone: source.timezone,
    minPrice: Number.isFinite(minPrice) ? Math.round(minPrice * 100) / 100 : 0,
    duplicates: source.duplicates ?? defaultCampaignDuplicates(),
    generalFilters: Array.isArray(source.generalFilters)
      ? normalizeGeneralFiltersForStorage(source.generalFilters)
      : [],
    plDnplListIds: source.plDnplListIds ?? [],
    copyPlDnplToOtherCampaigns: Boolean(source.copyPlDnplToOtherCampaigns),
    scheduleRules: cloneScheduleRulesForCopy(
      scheduleRules.map((rule, index) => ({
        id: `clone-${index}`,
        ...rule,
        scheduleMethod: "Days" as const,
      }))
    ),
    integrationSettings: {
      configValues: normalizeCampaignIntegrationConfigValues(source.integrationSettings),
    },
  };
}
