import { buildDefaultLeadDetailsDateRange } from "@/lib/date-range";

export type PublisherPerformanceFilters = {
  dateFrom: string;
  dateTo: string;
  productId: string;
  publisherId: string;
  publisherTag: string;
  tableSearch: string;
};

export function createDefaultPublisherPerformanceFilters(
  timeZone: string
): PublisherPerformanceFilters {
  const defaultDateRange = buildDefaultLeadDetailsDateRange(timeZone);
  return {
    dateFrom: defaultDateRange.from,
    dateTo: defaultDateRange.to,
    productId: "",
    publisherId: "",
    publisherTag: "",
    tableSearch: "",
  };
}

/** @deprecated Prefer createDefaultPublisherPerformanceFilters(timeZone). */
export const defaultPublisherPerformanceFilters = createDefaultPublisherPerformanceFilters(
  "America/New_York"
);

/** Aggregated metrics for a single publisher (or the totals row). */
export type PublisherPerformanceMetrics = {
  post: number;
  lead: number;
  sold: number;
  reject: number;
  redirect: number;
  redirectRate: number;
  dup1Rate: number;
  dup14Rate: number;
  dup30Rate: number;
  dup45Rate: number;
  epl: number;
  alp: number;
  pub: number;
  adm: number;
  ttl: number;
  ref: number;
  agn: number;
  revShare: number;
};

export type PublisherPerformanceRow = PublisherPerformanceMetrics & {
  id: string;
  publisherLabel: string;
  publisherTag: string;
};

export function emptyPublisherPerformanceMetrics(): PublisherPerformanceMetrics {
  return {
    post: 0,
    lead: 0,
    sold: 0,
    reject: 0,
    redirect: 0,
    redirectRate: 0,
    dup1Rate: 0,
    dup14Rate: 0,
    dup30Rate: 0,
    dup45Rate: 0,
    epl: 0,
    alp: 0,
    pub: 0,
    adm: 0,
    ttl: 0,
    ref: 0,
    agn: 0,
    revShare: 0,
  };
}

/**
 * Derived money/ratio metrics computed from the raw counts and sums:
 * - ADM (admin margin) = TTL revenue - publisher payout
 * - Rev-Share = publisher payout / TTL revenue
 * - EPL (earnings per lead) = publisher payout / valid leads
 * - ALP (average lead price) = TTL / valid leads
 * - Redirect count = leads with confirmed publisher redirect (redirectConfirmedAt)
 * - Redirect rate = Redirect / valid leads
 */
export function finalizePublisherPerformanceMetrics(
  base: Pick<
    PublisherPerformanceMetrics,
    "post" | "lead" | "sold" | "reject" | "redirect" | "pub" | "ttl" | "ref" | "agn" | "dup1Rate" | "dup14Rate" | "dup30Rate" | "dup45Rate"
  >
): PublisherPerformanceMetrics {
  const adm = round2(base.ttl - base.pub);
  const revShare = base.ttl > 0 ? base.pub / base.ttl : 0;
  const epl = base.lead > 0 ? base.pub / base.lead : 0;
  const alp = base.lead > 0 ? base.ttl / base.lead : 0;
  const redirectRate = base.lead > 0 ? base.redirect / base.lead : 0;

  return {
    ...base,
    pub: round2(base.pub),
    ttl: round2(base.ttl),
    ref: round2(base.ref),
    agn: round2(base.agn),
    adm,
    revShare,
    epl,
    alp,
    redirectRate,
  };
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function formatPerformanceMoney(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  const sign = safe < 0 ? "-" : "";
  return `${sign}$${Math.abs(safe).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPerformancePercent(fraction: number, fractionDigits = 2) {
  const safe = Number.isFinite(fraction) ? fraction : 0;
  return `${(safe * 100).toFixed(fractionDigits)}%`;
}

export function formatPerformanceCount(value: number) {
  return Number.isFinite(value) ? value.toLocaleString("en-US") : "0";
}

export function formatDupWindows(metrics: PublisherPerformanceMetrics) {
  return [metrics.dup1Rate, metrics.dup14Rate, metrics.dup30Rate, metrics.dup45Rate]
    .map((rate) => `${Math.round((Number.isFinite(rate) ? rate : 0) * 100)}%`)
    .join(" / ");
}
