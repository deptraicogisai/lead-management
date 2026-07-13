import {
  buildPublisherLeadDisplayCode,
  formatPublisherLeadMoney,
  formatPublisherLeadRedirectDelivery,
  normalizePublisherLeadPingTreeAllocations,
  resolvePublisherLeadDetailStatus,
  resolvePublisherLeadMoneyMetrics,
  resolvePublisherRedirectLabel,
  type PublisherLeadAcceptedDelivery,
  type PublisherLeadPingTreeAllocation,
} from "@/lib/publisher-lead-details";
import {
  formatBuyerLeadPrice,
  resolveBuyerLeadMoneyMetrics,
} from "@/lib/buyer-lead-details";
import { formatDateTimeDisplay } from "@/lib/date-range";
import { isLeadRedirectConfirmed } from "@/lib/publisher-redirect";
import {
  PING_TREE_PROCESSING_TYPES,
  isPingTreeProcessingType,
  type PingTreeProcessingType,
} from "@/lib/ping-tree-config";
import type { BuyerPostTraceStep } from "@/lib/buyer-post-trace";

export type LeadDetailTab = "lead-body" | "redirect" | "filter-log";
export type LeadDetailFilterProcessingKey = string;

export type LeadDetailFieldRow = {
  field: string;
  value: string;
};

export type LeadDetailFilterLogEntry = {
  source: "intake" | "delivery";
  label: string;
  messages: string[];
  status: "pass" | "fail" | "info";
};

export type LeadDetailRedirectRow = {
  date: string;
  dateLabel: string;
  clickDate: string;
  clickDateLabel: string;
  campaignId: string;
  campaignName: string;
  clientIp: string;
  status: "Yes" | "No";
  redirectUrl: string;
  referrer: string;
  referrerLabel: string;
  userAgent: string;
};

export type LeadDetailFilterLogRow = {
  id: string;
  date: string;
  dateLabel: string;
  buyerLabel: string;
  campaignId: string;
  campaignLabel: string;
  postPrice: string;
  soldPrice: string;
  status: string;
  message: string;
  offeredPriceLabel: string;
  timeLabel: string;
  postLeadUrl: string;
  httpStatus: number;
  requestPayload: Record<string, unknown> | null;
  responseBody: string;
  responseHeaders: Record<string, string>;
  rejectReason: string;
  errorReason: string;
};

export type LeadDetailFilterProcessingSection = {
  key: LeadDetailFilterProcessingKey;
  label: string;
  pingTreeLabel: string;
  minPriceLabel: string;
  /** Total campaigns configured on the ping tree. */
  campaignCount: number;
  /** Campaigns filtered before/without a buyer post. */
  filteredCount: number;
  /** Campaigns in the tree that were actually posted to the buyer. */
  postedCount: number;
  postedRows: LeadDetailFilterLogRow[];
  filteredRows: LeadDetailFilterLogRow[];
};

export type LeadDetailRecord = {
  id: string;
  publicLeadId: string;
  sequenceId: number;
  postedAt: string;
  postedAtLabel: string;
  productLabel: string;
  statusLabel: string;
  redirectLabel: string;
  redirectConfirmed: boolean;
  redirectUrl: string;
  publisherLabel: string;
  publisherChannel: string;
  publisherSource: string;
  method: string;
  buyerLabel: string;
  adm: string;
  ttl: string;
  publisherPayout: string;
  fields: LeadDetailFieldRow[];
  validationErrors: string[];
  filterLog: LeadDetailFilterLogEntry[];
  filterProcessing: LeadDetailFilterProcessingSection[];
  redirects: LeadDetailRedirectRow[];
};

export function buildLeadSequenceId(mongoId: string) {
  const hex = mongoId.replace(/[^a-fA-F0-9]/g, "").slice(-7);
  const value = Number.parseInt(hex || "0", 16);
  return Number.isFinite(value) ? value : 0;
}

export function readPayloadString(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return "";
}

export function formatLeadFieldValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function buildLeadBodyFields(
  payload: Record<string, unknown>,
  fieldLabelsByName?: Map<string, string>
): LeadDetailFieldRow[] {
  return Object.entries(payload)
    .filter(([key]) => !key.startsWith("__"))
    .map(([field, value]) => ({
      field: fieldLabelsByName?.get(field) || field,
      value: formatLeadFieldValue(value),
    }))
    .sort((left, right) => left.field.localeCompare(right.field));
}

export function formatRedirectDurationSeconds(fromIso: string, toIso: string) {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) {
    return null;
  }
  return Math.round((to - from) / 1000);
}

export function formatRedirectClickDateLabel(clickIso: string, createdIso: string) {
  if (!clickIso) return "—";
  const base = formatDateTimeDisplay(clickIso);
  const seconds = formatRedirectDurationSeconds(createdIso, clickIso);
  if (seconds == null) return base;
  return `${base} ( ${seconds} s )`;
}

export function formatRedirectReferrerLabel(referrer: string) {
  const trimmed = referrer.trim();
  if (!trimmed) return "—";
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return url.hostname || trimmed;
  } catch {
    return trimmed;
  }
}

export function buildLeadRedirectRows(params: {
  redirectUrl?: string | null;
  redirectConfirmedAt?: Date | string | null;
  redirectClientIp?: string | null;
  redirectReferrer?: string | null;
  redirectClickUserAgent?: string | null;
  userAgent?: string | null;
  postedAt: string;
  redirectCreatedAt?: string | null;
  campaignId?: string | null;
  campaignName?: string | null;
  payload?: Record<string, unknown>;
}): LeadDetailRedirectRow[] {
  const redirectUrl = params.redirectUrl?.trim() || "";
  if (!redirectUrl) return [];

  const createdAt = params.redirectCreatedAt?.trim() || params.postedAt;
  const confirmed =
    params.redirectConfirmedAt != null
      ? typeof params.redirectConfirmedAt === "string"
        ? params.redirectConfirmedAt
        : new Date(params.redirectConfirmedAt).toISOString()
      : "";
  const clickIso =
    confirmed && !Number.isNaN(new Date(confirmed).getTime())
      ? new Date(confirmed).toISOString()
      : "";
  const payloadIp = readPayloadString(params.payload ?? {}, [
    "ip",
    "client_ip",
    "clientIp",
    "ip_address",
    "ipAddress",
  ]);
  const clientIp = params.redirectClientIp?.trim() || payloadIp || "—";
  const referrer = params.redirectReferrer?.trim() || "";
  const userAgent =
    params.redirectClickUserAgent?.trim() || params.userAgent?.trim() || "—";

  return [
    {
      date: createdAt,
      dateLabel: formatDateTimeDisplay(createdAt),
      clickDate: clickIso,
      clickDateLabel: clickIso ? formatRedirectClickDateLabel(clickIso, createdAt) : "—",
      campaignId: params.campaignId?.trim() || "",
      campaignName: params.campaignName?.trim() || "—",
      clientIp,
      status: clickIso ? "Yes" : "No",
      redirectUrl,
      referrer,
      referrerLabel: formatRedirectReferrerLabel(referrer),
      userAgent,
    },
  ];
}

function formatIndexedLabel(name: string, displayId?: number | null) {
  const trimmed = name.trim() || "Unknown";
  return typeof displayId === "number" && Number.isFinite(displayId)
    ? `[${displayId}] ${trimmed}`
    : trimmed;
}

function wasBuyerDeliveryPosted(delivery: {
  httpStatus?: number | null;
  requestPayload?: unknown;
  responseBody?: string | null;
}) {
  if (typeof delivery.httpStatus === "number" && delivery.httpStatus > 0) return true;
  if (typeof delivery.responseBody === "string" && delivery.responseBody.trim()) return true;
  if (delivery.requestPayload && typeof delivery.requestPayload === "object") return true;
  return false;
}

function resolveFilterLogMessage(delivery: {
  buyerStatus: string;
  rejectReason?: string | null;
  errorReason?: string | null;
  validationErrors?: string[] | null;
}) {
  const rejectReason = delivery.rejectReason?.trim() || "";
  if (rejectReason) return rejectReason;
  const errorReason = delivery.errorReason?.trim() || "";
  if (errorReason) return errorReason;
  const validation = (delivery.validationErrors ?? []).map((item) => item.trim()).filter(Boolean);
  if (validation.length > 0) return validation[0];
  return delivery.buyerStatus || "—";
}

function formatFilterLogResponseTime(responseTimeMs: number | null | undefined) {
  if (responseTimeMs == null || !Number.isFinite(responseTimeMs) || responseTimeMs < 0) {
    return "—";
  }
  const seconds = responseTimeMs / 1000;
  return Number(seconds.toFixed(4)).toString();
}

export function formatFilterProcessingTabLabel(processingType: string) {
  if (processingType === "Silent") return "Silent Processing";
  if (processingType === "Main processing") return "Main Processing";
  return processingType.trim() || "Processing";
}

export function formatFilterProcessingTreeTitle(processingType: string) {
  if (processingType === "Main processing") return "Main Tree";
  if (processingType === "Silent") return "Second Tree";
  return processingType.trim() || "Tree";
}

function resolveDeliveryProcessingType(params: {
  processingType?: string | null;
  pingTreeType: "Redirect" | "Silent";
  allocations: PublisherLeadPingTreeAllocation[];
}): PingTreeProcessingType {
  if (isPingTreeProcessingType(params.processingType)) {
    return params.processingType;
  }

  const allocationMatch = params.allocations.find((allocation) => {
    if (allocation.pingTreeType !== params.pingTreeType) return false;
    return isPingTreeProcessingType(allocation.processingType);
  });
  if (allocationMatch && isPingTreeProcessingType(allocationMatch.processingType)) {
    return allocationMatch.processingType;
  }

  return params.pingTreeType === "Silent" ? "Silent" : "Main processing";
}

function resolveAllocationForProcessingType(
  allocations: PublisherLeadPingTreeAllocation[],
  processingType: PingTreeProcessingType
) {
  const exact = allocations.find((allocation) => allocation.processingType === processingType);
  if (exact) return exact;

  const pingTreeType = processingType === "Silent" ? "Silent" : "Redirect";
  return allocations.find((allocation) => allocation.pingTreeType === pingTreeType) ?? null;
}

export function buildLeadFilterProcessing(params: {
  deliveries: Array<{
    id: string;
    pingTreeType: "Redirect" | "Silent";
    processingType?: string | null;
    postedAt: string;
    buyerStatus: string;
    price: number | null;
    campaignMinPrice: number | null;
    buyerDisplayId: number | null;
    buyerCompany: string;
    campaignId: string;
    campaignDisplayId: number | null;
    campaignName: string;
    rejectReason?: string | null;
    errorReason?: string | null;
    validationErrors?: string[] | null;
    responseTimeMs?: number | null;
    httpStatus?: number | null;
    postLeadUrl?: string | null;
    requestPayload?: Record<string, unknown> | null;
    responseBody?: string | null;
    responseHeaders?: Record<string, string> | null;
  }>;
  pingTreeAllocations?: PublisherLeadPingTreeAllocation[] | unknown;
  /** Total campaigns on each ping tree config (configId → count). */
  campaignCountByConfigId?: Record<string, number>;
}): LeadDetailFilterProcessingSection[] {
  const allocations = normalizePublisherLeadPingTreeAllocations(params.pingTreeAllocations);
  const deliveriesWithType = params.deliveries.map((delivery) => ({
    delivery,
    processingType: resolveDeliveryProcessingType({
      processingType: delivery.processingType,
      pingTreeType: delivery.pingTreeType,
      allocations,
    }),
  }));

  const presentTypes = new Set(deliveriesWithType.map((entry) => entry.processingType));
  const orderedTypes = [
    ...PING_TREE_PROCESSING_TYPES.filter((type) => presentTypes.has(type)),
    ...[...presentTypes].filter(
      (type) => !(PING_TREE_PROCESSING_TYPES as readonly string[]).includes(type)
    ),
  ];

  return orderedTypes.map((processingType) => {
    const sectionDeliveries = deliveriesWithType.filter(
      (entry) => entry.processingType === processingType
    );
    const postedRows: LeadDetailFilterLogRow[] = [];
    const filteredRows: LeadDetailFilterLogRow[] = [];

    for (const { delivery } of sectionDeliveries) {
      const money = resolveBuyerLeadMoneyMetrics({
        buyerStatus: delivery.buyerStatus,
        price: delivery.price,
        campaignMinPrice: delivery.campaignMinPrice,
      });
      const isAccept = delivery.buyerStatus === "Accept";
      const offeredPrice =
        delivery.buyerStatus === "Price Reject" &&
        typeof delivery.price === "number" &&
        Number.isFinite(delivery.price)
          ? formatBuyerLeadPrice(delivery.price)
          : "";

      const row: LeadDetailFilterLogRow = {
        id: delivery.id,
        date: delivery.postedAt,
        dateLabel: formatDateTimeDisplay(delivery.postedAt),
        buyerLabel: formatIndexedLabel(delivery.buyerCompany, delivery.buyerDisplayId),
        campaignId: delivery.campaignId,
        campaignLabel: formatIndexedLabel(delivery.campaignName, delivery.campaignDisplayId),
        postPrice: money.postPrice,
        soldPrice: isAccept ? money.ttl : "—",
        status: delivery.buyerStatus,
        message: resolveFilterLogMessage(delivery),
        offeredPriceLabel: offeredPrice,
        timeLabel: formatFilterLogResponseTime(delivery.responseTimeMs),
        postLeadUrl: delivery.postLeadUrl?.trim() || "",
        httpStatus: typeof delivery.httpStatus === "number" ? delivery.httpStatus : 0,
        requestPayload: delivery.requestPayload ?? null,
        responseBody: delivery.responseBody?.trim() || "",
        responseHeaders: delivery.responseHeaders ?? {},
        rejectReason: delivery.rejectReason?.trim() || "",
        errorReason: delivery.errorReason?.trim() || "",
      };

      if (wasBuyerDeliveryPosted(delivery)) {
        postedRows.push(row);
      } else {
        filteredRows.push(row);
      }
    }

    const allocation = resolveAllocationForProcessingType(allocations, processingType);
    const treeTitle = formatFilterProcessingTreeTitle(processingType);
    const pingTreeLabel =
      allocation?.displayId != null
        ? `Ping Tree: ${treeTitle} [${allocation.displayId}]`
        : allocation?.configName?.trim()
          ? `Ping Tree: ${treeTitle} · ${allocation.configName.trim()}`
          : `Ping Tree: ${treeTitle}`;

    const postedCount = postedRows.length;
    const allRows = [...postedRows, ...filteredRows];
    const configCampaignCount =
      allocation?.configId && params.campaignCountByConfigId
        ? params.campaignCountByConfigId[allocation.configId]
        : undefined;
    const campaignCount =
      typeof configCampaignCount === "number" && Number.isFinite(configCampaignCount)
        ? Math.max(configCampaignCount, allRows.length)
        : Math.max(allRows.length, postedCount);
    const filteredCount = Math.max(campaignCount - postedCount, filteredRows.length);
    const minPriceValues = allRows
      .map((row) => Number.parseFloat(row.postPrice.replace(/[^0-9.-]/g, "")))
      .filter((value) => Number.isFinite(value));
    const minPriceLabel =
      minPriceValues.length > 0
        ? formatBuyerLeadPrice(Math.min(...minPriceValues))
        : formatBuyerLeadPrice(0);

    return {
      key: processingType,
      label: formatFilterProcessingTabLabel(processingType),
      pingTreeLabel,
      minPriceLabel,
      campaignCount,
      filteredCount,
      postedCount,
      postedRows,
      filteredRows,
    } satisfies LeadDetailFilterProcessingSection;
  });
}

export function buildLeadFilterLog(params: {
  validationErrors: string[];
  deliveryTraces: Array<{
    campaignName: string;
    buyerCompany: string;
    buyerStatus: string;
    deliveryTrace?: BuyerPostTraceStep[] | null;
  }>;
}): LeadDetailFilterLogEntry[] {
  const entries: LeadDetailFilterLogEntry[] = [];

  if (params.validationErrors.length > 0) {
    entries.push({
      source: "intake",
      label: "Publisher Intake",
      messages: params.validationErrors,
      status: "fail",
    });
  } else {
    entries.push({
      source: "intake",
      label: "Publisher Intake",
      messages: ["No intake filter/PL-DNPL rejections recorded."],
      status: "pass",
    });
  }

  for (const delivery of params.deliveryTraces) {
    const steps = Array.isArray(delivery.deliveryTrace) ? delivery.deliveryTrace : [];
    const filterSteps = steps.filter((step) => {
      const key = `${step.key ?? ""} ${step.label ?? ""}`.toLowerCase();
      return (
        key.includes("filter") ||
        key.includes("pl") ||
        key.includes("dnpl") ||
        key.includes("duplicate") ||
        key.includes("schedule") ||
        key.includes("validation")
      );
    });

    const messages =
      filterSteps.length > 0
        ? filterSteps.flatMap((step) => {
            const lines: string[] = [];
            if (step.summary) lines.push(step.summary);
            if (step.result?.error) lines.push(step.result.error);
            if (step.result?.message) lines.push(step.result.message);
            for (const check of step.validationChecks ?? []) {
              if (check.messages?.length) {
                lines.push(...check.messages.map((message) => `${check.category}: ${message}`));
              }
            }
            return lines.length > 0 ? lines : [`${step.label}: ${step.status}`];
          })
        : [`Buyer status: ${delivery.buyerStatus}`];

    const failed = filterSteps.some((step) => step.status === "fail" || step.status === "error");

    entries.push({
      source: "delivery",
      label: `${delivery.campaignName} · ${delivery.buyerCompany}`,
      messages,
      status: failed ? "fail" : "info",
    });
  }

  return entries;
}

export function buildLeadDetailRecord(params: {
  id: string;
  validationStatus: "success" | "fail";
  publisherStatus?: "Sold" | "Reject" | "Post Error" | "Test" | null;
  redirectConfirmedAt?: Date | string | null;
  redirectUrl?: string | null;
  redirectClientIp?: string | null;
  redirectReferrer?: string | null;
  redirectClickUserAgent?: string | null;
  userAgent?: string | null;
  soldPrice?: number | null;
  postedAt: string;
  redirectCreatedAt?: string | null;
  redirectCampaignId?: string | null;
  redirectCampaignName?: string | null;
  payload: Record<string, unknown>;
  validationErrors?: string[];
  publisherLabel: string;
  productLabel: string;
  acceptedDelivery?: PublisherLeadAcceptedDelivery | null;
  buyerRevenue?: number | null;
  buyerLabel?: string;
  fieldLabelsByName?: Map<string, string>;
  filterLog?: LeadDetailFilterLogEntry[];
  filterProcessing?: LeadDetailFilterProcessingSection[];
}): LeadDetailRecord {
  const money = resolvePublisherLeadMoneyMetrics({
    soldPrice: params.soldPrice,
    buyerRevenue: params.buyerRevenue,
  });
  const isRedirectCampaign = params.acceptedDelivery?.pingTreeType === "Redirect";
  const redirectLabel = isRedirectCampaign
    ? formatPublisherLeadRedirectDelivery(params.acceptedDelivery)
    : resolvePublisherRedirectLabel(params.redirectConfirmedAt);
  const channelName =
    readPayloadString(params.payload, ["channel", "publisher_channel", "publisherChannel"]) || "Organic";
  const channelId = readPayloadString(params.payload, ["channel_id", "channelId"]) || "2";
  const sourceName =
    readPayloadString(params.payload, [
      "source",
      "publisher_source",
      "publisherSource",
      "utm_source",
    ]) || "";
  const sourceId = readPayloadString(params.payload, [
    "source_id",
    "sourceId",
    "publisher_source_id",
    "publisherSourceId",
  ]);
  const method = readPayloadString(params.payload, ["method", "http_method", "requestMethod"]) || "POST";
  const publisherSource = sourceName.startsWith("[")
    ? sourceName
    : sourceId && sourceName
      ? `[${sourceId}] ${sourceName}`
      : sourceName || (sourceId ? `[${sourceId}]` : "—");

  return {
    id: params.id,
    publicLeadId: buildPublisherLeadDisplayCode(params.id),
    sequenceId: buildLeadSequenceId(params.id),
    postedAt: params.postedAt,
    postedAtLabel: formatDateTimeDisplay(params.postedAt),
    productLabel: params.productLabel,
    statusLabel: resolvePublisherLeadDetailStatus({
      publisherStatus: params.publisherStatus,
      validationStatus: params.validationStatus,
    }),
    redirectLabel,
    redirectConfirmed: isLeadRedirectConfirmed({ redirectConfirmedAt: params.redirectConfirmedAt }),
    redirectUrl: params.redirectUrl?.trim() || "",
    publisherLabel: params.publisherLabel,
    publisherChannel: `[${channelId}] ${channelName}`,
    publisherSource,
    method,
    buyerLabel: params.buyerLabel?.trim() || "",
    adm: money.adm,
    ttl: money.ttl,
    publisherPayout: money.publisherPayout,
    fields: buildLeadBodyFields(params.payload, params.fieldLabelsByName),
    validationErrors: params.validationErrors ?? [],
    filterLog: params.filterLog ?? [],
    filterProcessing: params.filterProcessing ?? [],
    redirects: buildLeadRedirectRows({
      redirectUrl: params.redirectUrl,
      redirectConfirmedAt: params.redirectConfirmedAt,
      redirectClientIp: params.redirectClientIp,
      redirectReferrer: params.redirectReferrer,
      redirectClickUserAgent: params.redirectClickUserAgent,
      userAgent: params.userAgent,
      postedAt: params.postedAt,
      redirectCreatedAt: params.redirectCreatedAt,
      campaignId: params.redirectCampaignId,
      campaignName: params.redirectCampaignName,
      payload: params.payload,
    }),
  };
}

export { buildPublisherLeadDisplayCode, formatPublisherLeadMoney, normalizePublisherLeadPingTreeAllocations };
