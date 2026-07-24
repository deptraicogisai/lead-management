import {
  defaultCampaignDuplicates,
  normalizeCampaignDelayScheduling,
  normalizeGeneralFiltersForStorage,
  resolveCampaignTimezone,
  type CampaignGeneralFilter,
  type CampaignType,
} from "@/lib/campaign";
import { CAMPAIGN_EXPORT_TYPE, CAMPAIGN_EXPORT_VERSION, type CampaignExportPayload } from "@/lib/campaign-export";
import { resolveImportVerticalId } from "@/lib/integration-builder-import";

export function parseCampaignImportSchema(
  raw: unknown
): { ok: true; schema: CampaignExportPayload } | { ok: false; message: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, message: "Invalid JSON schema file." };
  }

  const schema = raw as Record<string, unknown>;

  if (schema.type !== CAMPAIGN_EXPORT_TYPE) {
    return { ok: false, message: "Schema type must be campaign." };
  }

  if (schema.version !== CAMPAIGN_EXPORT_VERSION) {
    return { ok: false, message: "Unsupported campaign schema version." };
  }

  if (!schema.name || typeof schema.name !== "string" || !schema.name.trim()) {
    return { ok: false, message: "Schema must include a campaign name." };
  }

  const productId = Number(schema.productId);
  if (!Number.isFinite(productId) || productId < 1) {
    return { ok: false, message: "Schema must include a valid productId." };
  }

  if (!schema.buyerId || typeof schema.buyerId !== "string" || !schema.buyerId.trim()) {
    return { ok: false, message: "Schema must include a valid buyerId." };
  }

  if (schema.campaignType !== "Redirect" && schema.campaignType !== "Silent") {
    return { ok: false, message: "Schema must include a valid campaignType." };
  }

  if (!schema.timezone || typeof schema.timezone !== "string" || !schema.timezone.trim()) {
    return { ok: false, message: "Schema must include a timezone." };
  }

  return { ok: true, schema: raw as CampaignExportPayload };
}

export function buildCampaignImportName(schemaName: string, existingNames: Iterable<string> = []) {
  const baseName = schemaName.trim();
  const existing = new Set([...existingNames].map((name) => name.trim().toLowerCase()));

  const firstCandidate = `${baseName} (Import)`;
  if (!existing.has(firstCandidate.toLowerCase())) {
    return firstCandidate;
  }

  let counter = 2;
  while (true) {
    const candidate = `${baseName} (Import) ${counter}`;
    if (!existing.has(candidate.toLowerCase())) {
      return candidate;
    }
    counter += 1;
  }
}

export function buildCampaignImportCreateData(schema: CampaignExportPayload, verticalIdsOldestFirst: string[]) {
  const verticalId = resolveImportVerticalId(schema.productId, verticalIdsOldestFirst);
  if (!verticalId) {
    throw new Error("Selected product in schema is not available.");
  }

  const minPrice = Number(schema.minPrice ?? 0);
  const generalFilters = Array.isArray(schema.generalFilters)
    ? normalizeGeneralFiltersForStorage(schema.generalFilters as CampaignGeneralFilter[])
    : [];

  return {
    name: schema.name.trim(),
    verticalRef: verticalId,
    buyerRef: schema.buyerId.trim(),
    integrationRef: schema.integrationId?.trim() || undefined,
    campaignType: schema.campaignType as CampaignType,
    delayScheduling:
      schema.campaignType === "Silent"
        ? normalizeCampaignDelayScheduling(schema.delayScheduling)
        : "Off",
    timezone: resolveCampaignTimezone(schema.timezone),
    minPrice: Number.isFinite(minPrice) ? minPrice : 0,
    duplicates: schema.duplicates ?? defaultCampaignDuplicates(),
    generalFilters,
    plDnplListIds: Array.isArray(schema.plDnplListIds) ? schema.plDnplListIds : [],
    copyPlDnplToOtherCampaigns: Boolean(schema.copyPlDnplToOtherCampaigns),
    scheduleRules: Array.isArray(schema.scheduleRules) ? schema.scheduleRules : [],
    integrationSettings: {
      configValues: schema.integrationSettings?.configValues ?? {},
    },
  };
}
