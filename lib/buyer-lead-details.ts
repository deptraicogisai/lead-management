import {
  buildDefaultLeadDetailsDateRange,
  formatDateTimeDisplay,
} from "@/lib/date-range";
import { BUYER_LEAD_DETAILS_STATUS_OPTIONS, BUYER_LEAD_REJECT_GROUP_STATUSES } from "@/lib/buyer-lead-status";
import { formatProductLabel } from "@/lib/integration-builder";
import { isLeadRedirectConfirmed } from "@/lib/publisher-redirect";
import { isDelayPostingStatus } from "@/lib/delay-posting-countdown";
import {
  buildPublisherLeadDisplayCode,
  formatPingTreeSnapshotDisplayLabel,
  formatPublisherLeadMoney,
  normalizePublisherLeadPingTreeAllocations,
  resolvePingTreeAllocationForDelivery,
  resolvePublisherChannelLabel,
  resolvePublisherSourceLabel,
  type PublisherChannelMappingInfo,
} from "@/lib/publisher-lead-details";

export type BuyerLeadDetailsRow = {
  id: string;
  leadId: string;
  displayLeadCode: string;
  postedAt: string;
  postStatus: string;
  /** ISO time when Delay Posting is due; null when not delayed. */
  scheduledPostAt: string | null;
  productLabel: string;
  buyerLabel: string;
  campaignLabel: string;
  redirectLabel: string;
  redirectConfirmed: boolean;
  isRedirectCampaign: boolean;
  postPrice: string;
  pub: string;
  adm: string;
  ttl: string;
  publisherLabel: string;
  publisherTag: string;
  publisherChannel: string;
  publisherSource: string;
  responseTimeLabel: string;
  campaignId: string;
  buyerId: string;
  campaignName: string;
  campaignDisplayId: number;
  buyerCompany: string;
  pingTreeType: "Redirect" | "Silent";
  pingTreeLabel: string;
  pingTreeName: string;
  pingTreeDisplayId: number | null;
  campaignOrder: number;
  buyerStatus: string;
  price: number | null;
  redirectUrl: string;
  rejectReason: string;
  errorReason: string;
  postLeadUrl: string;
  httpStatus: number;
  requestPayload: Record<string, unknown> | null;
  responseBody: string;
  responseHeaders: Record<string, string>;
  validationErrors: string[];
  rawPayload: Record<string, unknown>;
};

export type BuyerLeadDetailsFilters = {
  leadId: string;
  dateFrom: string;
  dateTo: string;
  productId: string;
  publisherId: string;
  publisherChannel: string[];
  publisherSource: string[];
  buyerId: string;
  campaignId: string;
  pingTreeId: string;
  redirectStatus: string;
  publisherTag: string;
  /** Empty = All. Multiple selected statuses are OR-matched. */
  status: string[];
  tableSearch: string;
};

export function createDefaultBuyerLeadDetailsFilters(timeZone: string): BuyerLeadDetailsFilters {
  const defaultDateRange = buildDefaultLeadDetailsDateRange(timeZone);
  return {
    leadId: "",
    dateFrom: defaultDateRange.from,
    dateTo: defaultDateRange.to,
    productId: "",
    publisherId: "",
    publisherChannel: [],
    publisherSource: [],
    buyerId: "",
    campaignId: "",
    pingTreeId: "",
    redirectStatus: "All",
    publisherTag: "",
    status: [],
    tableSearch: "",
  };
}

/** @deprecated Prefer createDefaultBuyerLeadDetailsFilters(timeZone). */
export const defaultBuyerLeadDetailsFilters = createDefaultBuyerLeadDetailsFilters("America/New_York");

export { BUYER_LEAD_DETAILS_STATUS_OPTIONS, BUYER_LEAD_REJECT_GROUP_STATUSES };

export function parseBuyerLeadDetailsFiltersFromSearchParams(
  searchParams: Pick<URLSearchParams, "get">
): Partial<BuyerLeadDetailsFilters> {
  const partial: Partial<BuyerLeadDetailsFilters> = {};
  const buyerId = searchParams.get("buyerId")?.trim();
  const productId = searchParams.get("productId")?.trim();
  const dateFrom = searchParams.get("dateFrom")?.trim();
  const dateTo = searchParams.get("dateTo")?.trim();
  const status = searchParams.get("status")?.trim();

  if (buyerId) partial.buyerId = buyerId;
  if (productId) partial.productId = productId;
  if (dateFrom) partial.dateFrom = new Date(dateFrom).toISOString();
  if (dateTo) partial.dateTo = new Date(dateTo).toISOString();
  if (status && status !== "All") {
    partial.status = status
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return partial;
}

export function formatBuyerLeadPostStatus(status: string) {
  return status.trim() || "—";
}

export function formatBuyerLeadPrice(price: number | null) {
  if (price == null || !Number.isFinite(price)) {
    return formatPublisherLeadMoney(0);
  }
  return formatPublisherLeadMoney(price);
}

/** @deprecated Use resolvePublisherSourceLabel — lead payload `source` is Publisher Source. */
export function resolveBuyerLeadSource(payload: Record<string, unknown> | null | undefined) {
  const value = resolvePublisherSourceLabel(payload);
  return value === "—" ? "" : value;
}

/** Buyer HTTP response time: request sent to buyer until response received (seconds). */
export function formatBuyerResponseTime(responseTimeMs: number | null | undefined) {
  if (responseTimeMs == null || !Number.isFinite(responseTimeMs) || responseTimeMs < 0) {
    return "—";
  }

  const seconds = responseTimeMs / 1000;
  return Number(seconds.toFixed(2)).toString();
}

/** Redirect column: Redirect campaigns → Yes/No; Silent → — */
export function formatBuyerLeadRedirectLabel(input: {
  pingTreeType: "Redirect" | "Silent";
  redirectConfirmed: boolean;
}) {
  if (input.pingTreeType !== "Redirect") {
    return "—";
  }

  return input.redirectConfirmed ? "Yes" : "No";
}

export function resolveBuyerLeadMoneyMetrics(input: {
  buyerStatus: string;
  price: number | null;
  campaignMinPrice: number | null;
  /** Per-delivery publisher payout after RevShare (preferred). */
  publisherPayout?: number | null;
  /** @deprecated Fallback for older rows that only stored seller-lead soldPrice. */
  soldPrice?: number | null;
}) {
  const isAccept = input.buyerStatus === "Accept";
  const ttl = isAccept && typeof input.price === "number" && Number.isFinite(input.price) ? input.price : 0;
  const payout =
    typeof input.publisherPayout === "number" && Number.isFinite(input.publisherPayout)
      ? input.publisherPayout
      : typeof input.soldPrice === "number" && Number.isFinite(input.soldPrice)
        ? input.soldPrice
        : null;
  const pub = isAccept && payout !== null ? payout : 0;
  const campaignMinPrice =
    typeof input.campaignMinPrice === "number" && Number.isFinite(input.campaignMinPrice)
      ? input.campaignMinPrice
      : 0;

  return {
    postPrice: formatBuyerLeadPrice(campaignMinPrice),
    pub: formatPublisherLeadMoney(pub),
    ttl: formatPublisherLeadMoney(ttl),
    adm: formatPublisherLeadMoney(ttl - pub),
  };
}

export function resolveBuyerDeliveryPingTree(
  allocations: ReturnType<typeof normalizePublisherLeadPingTreeAllocations>,
  pingTreeType: "Redirect" | "Silent",
  processingType?: string | null
) {
  return resolvePingTreeAllocationForDelivery(allocations, { pingTreeType, processingType });
}

export function buildBuyerLeadPingTreeFields(
  rawAllocations: unknown,
  pingTreeType: "Redirect" | "Silent",
  processingType?: string | null
) {
  const allocation = resolveBuyerDeliveryPingTree(
    normalizePublisherLeadPingTreeAllocations(rawAllocations),
    pingTreeType,
    processingType
  );

  const pingTreeLabel = formatPingTreeSnapshotDisplayLabel(allocation, {
    pingTreeType,
    processingType,
  });

  return {
    pingTreeLabel,
    pingTreeName: allocation ? pingTreeLabel : "",
    pingTreeDisplayId: allocation?.displayId ?? null,
  };
}

export function mapBuyerDeliveryToLeadDetailsRow(input: {
  deliveryId: string;
  leadId: string;
  postedAt: string;
  buyerStatus: string;
  scheduledPostAt?: string | Date | null;
  price: number | null;
  pingTreeType: "Redirect" | "Silent";
  processingType?: string | null;
  redirectConfirmedAt?: Date | string | null;
  publisherPayout?: number | null;
  soldPrice?: number | null;
  productName: string;
  productIndex: number;
  buyerLabel: string;
  buyerDisplayId: number | null;
  campaignName: string;
  campaignDisplayId: number | null;
  campaignMinPrice: number | null;
  publisherName: string;
  publisherIndex: number;
  publisherTag: string;
  leadPayload?: Record<string, unknown> | null;
  channelMapping?: PublisherChannelMappingInfo | null;
  responseTimeMs?: number | null;
  redirectUrl: string;
  rejectReason: string;
  errorReason: string;
  postLeadUrl: string;
  httpStatus: number;
  requestPayload: Record<string, unknown> | null;
  responseBody: string;
  responseHeaders: Record<string, string>;
  validationErrors: string[];
  campaignId: string;
  buyerId: string;
  campaignOrder: number;
  pingTreeAllocations?: unknown;
}): BuyerLeadDetailsRow {
  const pingTreeFields = buildBuyerLeadPingTreeFields(
    input.pingTreeAllocations,
    input.pingTreeType,
    input.processingType
  );
  const isRedirectCampaign = input.pingTreeType === "Redirect";
  const redirectConfirmed = isLeadRedirectConfirmed({
    redirectConfirmedAt: input.redirectConfirmedAt,
  });
  const redirectLabel = formatBuyerLeadRedirectLabel({
    pingTreeType: input.pingTreeType,
    redirectConfirmed,
  });
  const money = resolveBuyerLeadMoneyMetrics({
    buyerStatus: input.buyerStatus,
    price: input.price,
    campaignMinPrice: input.campaignMinPrice,
    publisherPayout: input.publisherPayout,
    soldPrice: input.soldPrice,
  });

  const scheduledPostAtIso =
    isDelayPostingStatus(input.buyerStatus) && input.scheduledPostAt
      ? input.scheduledPostAt instanceof Date
        ? input.scheduledPostAt.toISOString()
        : String(input.scheduledPostAt)
      : null;

  return {
    id: input.deliveryId,
    leadId: input.leadId,
    displayLeadCode: buildPublisherLeadDisplayCode(input.leadId),
    postedAt: input.postedAt,
    postStatus: formatBuyerLeadPostStatus(input.buyerStatus),
    scheduledPostAt: scheduledPostAtIso,
    productLabel: formatProductLabel(input.productName, input.productIndex),
    buyerLabel: input.buyerLabel,
    campaignLabel: input.campaignName || "—",
    redirectLabel,
    redirectConfirmed,
    isRedirectCampaign,
    postPrice: money.postPrice,
    pub: money.pub,
    adm: money.adm,
    ttl: money.ttl,
    publisherLabel: input.publisherIndex
      ? `[${input.publisherIndex}] ${input.publisherName}`
      : input.publisherName,
    publisherTag: input.publisherTag,
    publisherChannel: resolvePublisherChannelLabel(input.leadPayload, input.channelMapping),
    publisherSource: resolvePublisherSourceLabel(input.leadPayload),
    responseTimeLabel: formatBuyerResponseTime(input.responseTimeMs),
    campaignId: input.campaignId,
    buyerId: input.buyerId,
    campaignName: input.campaignName,
    campaignDisplayId: input.campaignDisplayId ?? 0,
    buyerCompany: input.buyerLabel,
    pingTreeType: input.pingTreeType,
    ...pingTreeFields,
    campaignOrder: input.campaignOrder,
    buyerStatus: input.buyerStatus,
    price: input.price,
    redirectUrl: input.redirectUrl,
    rejectReason: input.rejectReason,
    errorReason: input.errorReason,
    postLeadUrl: input.postLeadUrl,
    httpStatus: input.httpStatus,
    requestPayload: input.requestPayload,
    responseBody: input.responseBody,
    responseHeaders: input.responseHeaders,
    validationErrors: input.validationErrors,
    rawPayload: input.leadPayload ?? {},
  };
}

export { buildPublisherLeadDisplayCode as buildBuyerLeadDisplayCode };

export const formatBuyerLeadTime = formatDateTimeDisplay;
export const formatBuyerLeadTableTime = formatDateTimeDisplay;

export type BuyerLeadScope = "accept" | "reject" | "timeout" | "error";

export function buildBuyerLeadDetailsHref(params: {
  buyerId: string;
  dateFrom?: string;
  dateTo?: string;
  productId?: string;
  scope?: BuyerLeadScope;
}) {
  const search = new URLSearchParams();
  search.set("buyerId", params.buyerId);

  if (params.scope === "accept") {
    search.set("status", "Accept");
  } else if (params.scope === "reject") {
    search.set("status", BUYER_LEAD_REJECT_GROUP_STATUSES.join(","));
  } else if (params.scope === "timeout") {
    search.set("status", "Timeout");
  } else if (params.scope === "error") {
    search.set("status", "Error");
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

  return `/reports/buyer/lead-details?${search.toString()}`;
}
