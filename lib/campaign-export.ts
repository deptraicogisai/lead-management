import type { CampaignRecord } from "@/lib/campaign";
import { cloneScheduleRulesForCopy } from "@/lib/campaign-schedule-copy";

export const CAMPAIGN_EXPORT_TYPE = "campaign" as const;
export const CAMPAIGN_EXPORT_VERSION = 1;

export type CampaignExportPayload = {
  type: typeof CAMPAIGN_EXPORT_TYPE;
  version: typeof CAMPAIGN_EXPORT_VERSION;
  productId: number;
  buyerId: string;
  integrationId?: string;
  name: string;
  campaignType: "Redirect" | "Silent";
  delayScheduling?: string;
  timezone: string;
  minPrice: number;
  duplicates: CampaignRecord["duplicates"];
  generalFilters: CampaignRecord["generalFilters"];
  plDnplListIds: string[];
  copyPlDnplToOtherCampaigns: boolean;
  scheduleRules: ReturnType<typeof cloneScheduleRulesForCopy>;
  integrationSettings: CampaignRecord["integrationSettings"];
};

export function resolveCampaignExportProductId(
  record: Pick<CampaignRecord, "verticalId">,
  verticalIdsOldestFirst: string[]
) {
  const index = verticalIdsOldestFirst.indexOf(record.verticalId);
  return index >= 0 ? index + 1 : 1;
}

export function buildCampaignExportPayload(
  record: CampaignRecord,
  productId: number
): CampaignExportPayload {
  return {
    type: CAMPAIGN_EXPORT_TYPE,
    version: CAMPAIGN_EXPORT_VERSION,
    productId,
    buyerId: record.buyerId,
    ...(record.integrationId ? { integrationId: record.integrationId } : {}),
    name: record.name,
    campaignType: record.campaignType,
    delayScheduling: record.campaignType === "Silent" ? record.delayScheduling : "Off",
    timezone: record.timezone,
    minPrice: record.minPrice,
    duplicates: record.duplicates,
    generalFilters: record.generalFilters,
    plDnplListIds: record.plDnplListIds,
    copyPlDnplToOtherCampaigns: record.copyPlDnplToOtherCampaigns,
    scheduleRules: cloneScheduleRulesForCopy(record.scheduleRules),
    integrationSettings: record.integrationSettings,
  };
}

export function buildCampaignExportFileName(name: string) {
  const sanitized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${sanitized || "campaign"}.json`;
}

export { downloadJsonFile } from "@/lib/integration-builder-export";
