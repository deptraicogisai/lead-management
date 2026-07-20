import {
  buildDefaultLeadDetailsDateRange,
  formatDateRangeDisplay,
  formatDateTimeDisplay,
  parseDateTimeValue,
} from "@/lib/date-range";
import { isLeadRedirectConfirmed } from "@/lib/publisher-redirect";

export type PublisherLeadFieldColumn = {
  fieldName: string;
  label: string;
};

export type PublisherLeadAcceptedDelivery = {
  buyerDisplayId: number | null;
  buyerCompany: string;
  campaignDisplayId: number | null;
  campaignName: string;
  price: number | null;
  pingTreeType: "Redirect" | "Silent" | "";
};

export type PublisherLeadDetailsRow = {
  id: string;
  displayCode: string;
  qualityDots: boolean[];
  postedAt: string;
  createdAt: string;
  statusLabel: "Sold" | "Reject" | "Intake Reject" | "Post Error" | "Test" | "New";
  tier: number;
  publisherLabel: string;
  redirectLabel: string;
  redirectConfirmed: boolean;
  isRedirectCampaign: boolean;
  publisherPayout: string;
  adm: string;
  ttl: string;
  ref: string;
  agn: string;
  productLabel: string;
  channelLabel: string;
  publisherSource: string;
  pingTreeLabel: string;
  pingTreeAllocations: PublisherLeadPingTreeAllocation[];
  userAgent: string;
  validationErrors: string[];
  rawPayload: Record<string, unknown>;
};

export type PublisherLeadPingTreeAllocation = {
  pingTreeType: string;
  processingType?: string;
  configId: string;
  configName: string;
  displayId: number | null;
};

export const formatPublisherLeadTableTime = formatDateTimeDisplay;

export function formatPublisherLeadMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "$0.00";
  }

  return `$${value.toFixed(2)}`;
}

export function formatPublisherLeadRedirectDelivery(delivery?: PublisherLeadAcceptedDelivery | null) {
  if (!delivery) {
    return "—";
  }

  const buyerCompany = delivery.buyerCompany.trim();
  const campaignName = delivery.campaignName.trim();
  if (!buyerCompany && !campaignName) {
    return "—";
  }

  const buyerPart = delivery.buyerDisplayId
    ? `[${delivery.buyerDisplayId}] ${buyerCompany || "Buyer"}`
    : buyerCompany || "Buyer";
  const priceSuffix =
    delivery.price != null && Number.isFinite(delivery.price) ? `_$${delivery.price.toFixed(2)}` : "";
  const campaignPart = delivery.campaignDisplayId
    ? `[${delivery.campaignDisplayId}] ${campaignName || "Campaign"}${priceSuffix}`
    : `${campaignName || "Campaign"}${priceSuffix}`;

  return `${buyerPart} : ${campaignPart}`;
}

export type PublisherLeadScope = "post" | "lead" | "sold" | "reject";

export type PublisherLeadDetailsFilters = {
  leadId: string;
  dateFrom: string;
  dateTo: string;
  productId: string;
  method: string;
  status: string;
  publisherId: string;
  publisherChannel: string[];
  publisherSource: string[];
  publisherTags: string;
  redirectStatus: string;
  leadScope: PublisherLeadScope | "";
  tableSearch: string;
};

export function createDefaultPublisherLeadDetailsFilters(
  timeZone: string
): PublisherLeadDetailsFilters {
  const defaultDateRange = buildDefaultLeadDetailsDateRange(timeZone);
  return {
    leadId: "",
    dateFrom: defaultDateRange.from,
    dateTo: defaultDateRange.to,
    productId: "",
    method: "All",
    status: "All",
    publisherId: "",
    publisherChannel: [],
    publisherSource: [],
    publisherTags: "",
    redirectStatus: "All",
    leadScope: "",
    tableSearch: "",
  };
}

/** @deprecated Prefer createDefaultPublisherLeadDetailsFilters(timeZone). */
export const defaultPublisherLeadDetailsFilters = createDefaultPublisherLeadDetailsFilters(
  "America/New_York"
);

export function isPublisherLeadScope(value: string | null | undefined): value is PublisherLeadScope {
  return value === "post" || value === "lead" || value === "sold" || value === "reject";
}

export function parsePublisherLeadDetailsFiltersFromSearchParams(
  searchParams: Pick<URLSearchParams, "get">
): Partial<PublisherLeadDetailsFilters> {
  const patch: Partial<PublisherLeadDetailsFilters> = {};

  const publisherId = searchParams.get("publisherId")?.trim();
  if (publisherId) patch.publisherId = publisherId;

  const productId = searchParams.get("productId")?.trim();
  if (productId) patch.productId = productId;

  const dateFrom = searchParams.get("dateFrom")?.trim();
  if (dateFrom) patch.dateFrom = dateFrom;

  const dateTo = searchParams.get("dateTo")?.trim();
  if (dateTo) patch.dateTo = dateTo;

  const leadScope = searchParams.get("leadScope")?.trim().toLowerCase() ?? "";
  if (isPublisherLeadScope(leadScope)) {
    patch.leadScope = leadScope;
    patch.status =
      leadScope === "sold" ? "Sold" : leadScope === "reject" ? "Reject" : "All";
  }

  const redirectStatus = searchParams.get("redirectStatus")?.trim();
  if (redirectStatus === "Redirected" || redirectStatus === "Not Redirected") {
    patch.redirectStatus = redirectStatus;
  }

  return patch;
}

export function buildPublisherLeadDetailsHref(params: {
  publisherId: string;
  dateFrom?: string;
  dateTo?: string;
  productId?: string;
  leadScope?: PublisherLeadScope;
  redirectStatus?: "Redirected" | "Not Redirected";
}) {
  const search = new URLSearchParams();
  search.set("publisherId", params.publisherId);

  if (params.leadScope) {
    search.set("leadScope", params.leadScope);
  }
  if (params.redirectStatus) {
    search.set("redirectStatus", params.redirectStatus);
  }

  if (params.dateFrom) {
    search.set("dateFrom", new Date(params.dateFrom).toISOString());
  }
  if (params.dateTo) {
    search.set("dateTo", new Date(params.dateTo).toISOString());
  }
  if (params.productId) {
    search.set("productId", params.productId);
  }

  return `/reports/publisher/lead-details?${search.toString()}`;
}

export const formatPublisherLeadTime = formatDateTimeDisplay;

export function formatPublisherLeadDateRangeLabel(from: string, to: string) {
  const fromDate = parseDateTimeValue(from);
  const toDate = parseDateTimeValue(to);

  if (fromDate && toDate) {
    return formatDateRangeDisplay(fromDate, toDate);
  }

  if (fromDate) {
    return formatDateTimeDisplay(fromDate);
  }

  if (toDate) {
    return formatDateTimeDisplay(toDate);
  }

  return "";
}

export function buildPublisherLeadDisplayCode(id: string) {
  const suffix = id.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
  return `W_${suffix || "LEAD"}`;
}

export function buildQualityDots(
  publisherStatus?: "Sold" | "Reject" | "Post Error" | "Test" | null,
  validationStatus?: "success" | "fail"
) {
  if (validationStatus === "fail") {
    return [false, false, true, false];
  }

  if (publisherStatus === "Sold") {
    return [true, true, true, false];
  }

  return [false, true, false, false];
}

export function resolvePublisherLeadDetailStatus(input: {
  publisherStatus?: "Sold" | "Reject" | "Post Error" | "Test" | null;
  validationStatus?: "success" | "fail";
}): PublisherLeadDetailsRow["statusLabel"] {
  if (input.validationStatus === "fail") return "Intake Reject";
  if (input.publisherStatus === "Sold") return "Sold";
  if (input.publisherStatus === "Test") return "Test";
  if (input.publisherStatus === "Post Error") return "Post Error";
  if (input.publisherStatus === "Reject") return "Reject";
  return "New";
}

function formatIndexedLabel(name: string, index?: number) {
  if (!index) return name;
  return `[${index}] ${name}`;
}

function readPayloadString(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }

  for (const [payloadKey, value] of Object.entries(payload)) {
    const normalized = payloadKey.trim().toLowerCase().replace(/[\s_-]/g, "");
    const matched = keys.some((key) => key.trim().toLowerCase().replace(/[\s_-]/g, "") === normalized);
    if (!matched) continue;
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }

  return "";
}

/** Publisher Channel = Vertical Mapping identified by intake API key. */
export type PublisherChannelMappingInfo = {
  displayId?: number | null;
  apiName?: string | null;
};

export function formatPublisherChannelMappingLabel(
  mapping: PublisherChannelMappingInfo | null | undefined
) {
  const name = mapping?.apiName?.trim() || "";
  if (!name) return "";
  const displayId = typeof mapping?.displayId === "number" ? mapping.displayId : null;
  return displayId != null ? `[${displayId}] ${name}` : name;
}

/**
 * Shown as Publisher Channel in lead detail lists.
 * Prefer the Vertical Mapping matched by API key (`mappingRef`); payload is legacy fallback only.
 */
export function resolvePublisherChannelLabel(
  payload: Record<string, unknown> | null | undefined,
  mapping?: PublisherChannelMappingInfo | null
) {
  const fromMapping = formatPublisherChannelMappingLabel(mapping);
  if (fromMapping) return fromMapping;

  if (!payload) return "—";

  const channelName = readPayloadString(payload, ["channel", "publisher_channel", "publisherChannel"]);
  const channelId = readPayloadString(payload, ["channel_id", "channelId"]);

  if (channelName.startsWith("[")) return channelName;
  if (channelId && channelName) return `[${channelId}] ${channelName}`;
  if (channelName) return channelName;
  if (channelId) return `[${channelId}]`;
  return "—";
}

/** Posted lead `source` is Publisher Source — only resolve once. */
export function resolvePublisherSourceLabel(payload: Record<string, unknown> | null | undefined) {
  if (!payload) return "—";
  const sourceName =
    readPayloadString(payload, ["source", "publisher_source", "publisherSource", "utm_source"]) || "";
  const sourceId = readPayloadString(payload, [
    "source_id",
    "sourceId",
    "publisher_source_id",
    "publisherSourceId",
  ]);
  if (sourceName.startsWith("[")) return sourceName;
  if (sourceId && sourceName) return `[${sourceId}] ${sourceName}`;
  if (sourceName) return sourceName;
  if (sourceId) return `[${sourceId}]`;
  return "—";
}

const CHANNEL_SOURCE_FIELD_KEYS = new Set([
  "source",
  "publishersource",
  "utmsource",
  "sourceid",
  "publishersourceid",
  "channel",
  "publisherchannel",
  "channelid",
]);

export function isPublisherChannelOrSourceFieldName(fieldName: string) {
  const normalized = fieldName.trim().toLowerCase().replace(/[\s_-]/g, "");
  return CHANNEL_SOURCE_FIELD_KEYS.has(normalized);
}

function readPayloadMoney(payload: Record<string, unknown>, keys: string[]) {
  const raw = readPayloadString(payload, keys);
  if (!raw) return "—";
  const parsed = Number(raw);
  if (Number.isFinite(parsed)) return `$${parsed.toFixed(2)}`;
  return raw.startsWith("$") ? raw : `$${raw}`;
}

export function formatPayloadFieldValue(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return "—";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

type VerticalFieldDoc = {
  fieldName: string;
  description?: string;
};

type VerticalDoc = {
  _id?: { toString(): string };
  fields?: VerticalFieldDoc[];
};

export function normalizeLeadPayload(doc: Record<string, unknown>): Record<string, unknown> {
  const payload = doc.payload;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }

  if (typeof doc.rawData === "string" && doc.rawData.trim()) {
    try {
      const parsed = JSON.parse(doc.rawData) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }

  return {};
}

export function buildPublisherLeadFieldColumns(productId: string, verticals: VerticalDoc[]) {
  const columns: PublisherLeadFieldColumn[] = [];
  const seen = new Set<string>();

  const appendFields = (fields: VerticalFieldDoc[] | undefined) => {
    for (const field of fields ?? []) {
      const fieldName = field.fieldName?.trim();
      if (!fieldName || seen.has(fieldName) || isPublisherChannelOrSourceFieldName(fieldName)) {
        continue;
      }

      seen.add(fieldName);
      columns.push({
        fieldName,
        label: field.description?.trim() || fieldName,
      });
    }
  };

  if (productId) {
    const vertical = verticals.find((item) => item._id?.toString() === productId);
    appendFields(vertical?.fields);
    return columns;
  }

  for (const vertical of verticals) {
    appendFields(vertical.fields);
  }

  return columns;
}

export function buildPublisherLeadFieldColumnsFromLeads(
  leads: Array<{ verticalRef?: string; payload: Record<string, unknown> }>,
  verticals: VerticalDoc[],
  productId: string
) {
  if (productId) {
    return buildPublisherLeadFieldColumns(productId, verticals);
  }

  const labelByFieldName = new Map<string, string>();
  for (const vertical of verticals) {
    for (const field of vertical.fields ?? []) {
      const fieldName = field.fieldName?.trim();
      if (!fieldName) continue;
      if (!labelByFieldName.has(fieldName)) {
        labelByFieldName.set(fieldName, field.description?.trim() || fieldName);
      }
    }
  }

  const columns: PublisherLeadFieldColumn[] = [];
  const seen = new Set<string>();

  for (const lead of leads) {
    for (const fieldName of Object.keys(lead.payload ?? {})) {
      if (!fieldName || seen.has(fieldName) || isPublisherChannelOrSourceFieldName(fieldName)) continue;
      seen.add(fieldName);
      columns.push({
        fieldName,
        label: labelByFieldName.get(fieldName) ?? fieldName,
      });
    }
  }

  return columns;
}

function formatPingTreeAllocationLabel(allocation: PublisherLeadPingTreeAllocation) {
  const name = allocation.configName?.trim() || "Unknown";
  if (allocation.displayId != null) {
    return `[${allocation.displayId}] ${name}`;
  }
  return name;
}

export function normalizePublisherLeadPingTreeAllocations(
  value: unknown
): PublisherLeadPingTreeAllocation[] {
  if (!Array.isArray(value)) return [];

  const allocations: PublisherLeadPingTreeAllocation[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const raw = item as {
      pingTreeType?: unknown;
      processingType?: unknown;
      configId?: unknown;
      configName?: unknown;
      displayId?: unknown;
    };
    const configId = typeof raw.configId === "string" ? raw.configId.trim() : "";
    if (!configId) continue;

    allocations.push({
      pingTreeType: typeof raw.pingTreeType === "string" ? raw.pingTreeType : "",
      processingType: typeof raw.processingType === "string" ? raw.processingType.trim() : "",
      configId,
      configName: typeof raw.configName === "string" ? raw.configName.trim() : "",
      displayId: typeof raw.displayId === "number" ? raw.displayId : null,
    });
  }

  return allocations;
}

export function formatPublisherLeadPingTreeLabel(allocations: PublisherLeadPingTreeAllocation[]) {
  if (allocations.length === 0) return "—";
  if (allocations.length === 1) {
    return formatPingTreeAllocationLabel(allocations[0]);
  }

  const typeLabel = (pingTreeType: string) => {
    if (pingTreeType === "Silent") return "Silent";
    if (pingTreeType === "Redirect") return "Main";
    return pingTreeType || "Tree";
  };

  return allocations
    .map((allocation) => `${typeLabel(allocation.pingTreeType)}: ${formatPingTreeAllocationLabel(allocation)}`)
    .join(" · ");
}

export function resolvePublisherRedirectLabel(redirectConfirmedAt?: Date | string | null) {
  if (!redirectConfirmedAt) return "Not Redirected";
  const confirmedAt = new Date(redirectConfirmedAt);
  return Number.isNaN(confirmedAt.getTime()) ? "Not Redirected" : "Redirected";
}

export function resolvePublisherLeadMoneyMetrics(input: {
  soldPrice?: number | null;
  buyerRevenue?: number | null;
}) {
  const pub = typeof input.soldPrice === "number" && Number.isFinite(input.soldPrice) ? input.soldPrice : 0;
  const ttl =
    typeof input.buyerRevenue === "number" && Number.isFinite(input.buyerRevenue) ? input.buyerRevenue : 0;
  const adm = ttl - pub;

  return {
    publisherPayout: formatPublisherLeadMoney(pub),
    ttl: formatPublisherLeadMoney(ttl),
    adm: formatPublisherLeadMoney(adm),
  };
}

export function mapLeadDocToPublisherRow(input: {
  id: string;
  validationStatus: "success" | "fail";
  publisherStatus?: "Sold" | "Reject" | "Post Error" | "Test" | null;
  redirectConfirmedAt?: Date | string | null;
  soldPrice?: number | null;
  postedAt: string;
  createdAt: string;
  userAgent?: string;
  validationErrors?: string[];
  payload: Record<string, unknown>;
  publisherName: string;
  publisherIndex: number;
  verticalName: string;
  verticalIndex: number;
  mappingLabel?: string;
  channelMapping?: PublisherChannelMappingInfo | null;
  pingTreeAllocations?: PublisherLeadPingTreeAllocation[];
  acceptedDelivery?: PublisherLeadAcceptedDelivery | null;
  buyerRevenue?: number | null;
}): PublisherLeadDetailsRow {
  const payload = input.payload ?? {};
  const pingTreeAllocations = input.pingTreeAllocations ?? [];
  const moneyMetrics = resolvePublisherLeadMoneyMetrics({
    soldPrice: input.soldPrice,
    buyerRevenue: input.buyerRevenue,
  });
  const isRedirectCampaign = input.acceptedDelivery?.pingTreeType === "Redirect";
  const redirectLabel = isRedirectCampaign
    ? formatPublisherLeadRedirectDelivery(input.acceptedDelivery)
    : "—";
  const redirectConfirmed = isLeadRedirectConfirmed({
    redirectConfirmedAt: input.redirectConfirmedAt,
  });

  return {
    id: input.id,
    displayCode: buildPublisherLeadDisplayCode(input.id),
    qualityDots: buildQualityDots(input.publisherStatus, input.validationStatus),
    postedAt: input.postedAt,
    createdAt: input.createdAt,
    statusLabel: resolvePublisherLeadDetailStatus({
      publisherStatus: input.publisherStatus,
      validationStatus: input.validationStatus,
    }),
    tier: 0,
    publisherLabel: input.publisherIndex
      ? `[${input.publisherIndex}] ${input.publisherName}`
      : input.publisherName,
    redirectLabel,
    redirectConfirmed,
    isRedirectCampaign,
    publisherPayout: moneyMetrics.publisherPayout,
    adm: moneyMetrics.adm,
    ttl: moneyMetrics.ttl,
    ref: readPayloadMoney(payload, ["ref", "referral"]),
    agn: readPayloadMoney(payload, ["agn", "agent"]),
    productLabel: formatIndexedLabel(input.verticalName, input.verticalIndex),
    channelLabel: resolvePublisherChannelLabel(payload, input.channelMapping),
    publisherSource: resolvePublisherSourceLabel(payload),
    pingTreeLabel: formatPublisherLeadPingTreeLabel(pingTreeAllocations),
    pingTreeAllocations,
    userAgent: input.userAgent?.trim() || "Unknown",
    validationErrors: input.validationErrors ?? [],
    rawPayload: payload,
  };
}
