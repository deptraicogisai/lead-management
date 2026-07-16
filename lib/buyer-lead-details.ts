import { buildDefaultLeadDetailsDateRange, formatDateTimeDisplay } from "@/lib/date-range";
import { BUYER_LEAD_DETAILS_STATUS_OPTIONS } from "@/lib/buyer-lead-status";
import { formatProductLabel } from "@/lib/integration-builder";
import { isLeadRedirectConfirmed } from "@/lib/publisher-redirect";
import {
  buildPublisherLeadDisplayCode,
  formatPublisherLeadMoney,
  normalizePublisherLeadPingTreeAllocations,
  resolvePublisherChannelLabel,
  resolvePublisherSourceLabel,
  type PublisherChannelMappingInfo,
  type PublisherLeadPingTreeAllocation,
} from "@/lib/publisher-lead-details";

export type BuyerLeadDetailsRow = {
  id: string;
  leadId: string;
  displayLeadCode: string;
  postedAt: string;
  postStatus: string;
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
  status: string;
  tableSearch: string;
};

const defaultDateRange = buildDefaultLeadDetailsDateRange();

export const defaultBuyerLeadDetailsFilters: BuyerLeadDetailsFilters = {
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
  status: "All",
  tableSearch: "",
};

export { BUYER_LEAD_DETAILS_STATUS_OPTIONS };

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
  if (status) partial.status = status;

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
  allocations: PublisherLeadPingTreeAllocation[],
  pingTreeType: "Redirect" | "Silent"
) {
  return allocations.find((allocation) => allocation.pingTreeType === pingTreeType) ?? null;
}

export function buildBuyerLeadPingTreeFields(
  rawAllocations: unknown,
  pingTreeType: "Redirect" | "Silent"
) {
  const allocation = resolveBuyerDeliveryPingTree(
    normalizePublisherLeadPingTreeAllocations(rawAllocations),
    pingTreeType
  );

  return {
    pingTreeLabel: allocation
      ? allocation.displayId != null
        ? `[${allocation.displayId}] ${allocation.configName?.trim() || "Unknown"}`
        : allocation.configName?.trim() || "—"
      : "—",
    pingTreeName: allocation?.configName?.trim() || "",
    pingTreeDisplayId: allocation?.displayId ?? null,
  };
}

export function mapBuyerDeliveryToLeadDetailsRow(input: {
  deliveryId: string;
  leadId: string;
  postedAt: string;
  buyerStatus: string;
  price: number | null;
  pingTreeType: "Redirect" | "Silent";
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
  const pingTreeFields = buildBuyerLeadPingTreeFields(input.pingTreeAllocations, input.pingTreeType);
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

  return {
    id: input.deliveryId,
    leadId: input.leadId,
    displayLeadCode: buildPublisherLeadDisplayCode(input.leadId),
    postedAt: input.postedAt,
    postStatus: formatBuyerLeadPostStatus(input.buyerStatus),
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
    search.set("status", "Reject");
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
