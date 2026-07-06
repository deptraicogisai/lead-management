import { buildDefaultLeadDetailsDateRange } from "@/lib/date-range";
import {
  formatPerformanceCount,
  formatPerformanceMoney,
  formatPerformancePercent,
} from "@/lib/publisher-performance-summary";

export type BuyerPerformanceFilters = {
  dateFrom: string;
  dateTo: string;
  productId: string;
  buyerId: string;
  publisherId: string;
  tableSearch: string;
};

const defaultDateRange = buildDefaultLeadDetailsDateRange();

export const defaultBuyerPerformanceFilters: BuyerPerformanceFilters = {
  dateFrom: defaultDateRange.from,
  dateTo: defaultDateRange.to,
  productId: "",
  buyerId: "",
  publisherId: "",
  tableSearch: "",
};

export type BuyerPerformanceMetrics = {
  post: number;
  rejected: number;
  accept: number;
  acceptRate: number;
  redirect: number;
  redirectRate: number;
  cpl: number;
  pub: number;
  adm: number;
  ttl: number;
  sendError: number;
  timeout: number;
  timeoutRate: number;
};

export type BuyerPerformanceRow = BuyerPerformanceMetrics & {
  id: string;
  buyerLabel: string;
};

export function emptyBuyerPerformanceMetrics(): BuyerPerformanceMetrics {
  return {
    post: 0,
    rejected: 0,
    accept: 0,
    acceptRate: 0,
    redirect: 0,
    redirectRate: 0,
    cpl: 0,
    pub: 0,
    adm: 0,
    ttl: 0,
    sendError: 0,
    timeout: 0,
    timeoutRate: 0,
  };
}

export function finalizeBuyerPerformanceMetrics(
  base: Pick<
    BuyerPerformanceMetrics,
    | "post"
    | "rejected"
    | "accept"
    | "redirect"
    | "pub"
    | "ttl"
    | "sendError"
    | "timeout"
  >
): BuyerPerformanceMetrics {
  const adm = round2(base.ttl - base.pub);
  const acceptRate = base.post > 0 ? base.accept / base.post : 0;
  const redirectRate = base.accept > 0 ? base.redirect / base.accept : 0;
  const timeoutRate = base.post > 0 ? base.timeout / base.post : 0;
  const cpl = base.accept > 0 ? base.ttl / base.accept : 0;

  return {
    ...base,
    pub: round2(base.pub),
    ttl: round2(base.ttl),
    adm,
    acceptRate,
    redirectRate,
    timeoutRate,
    cpl: round2(cpl),
  };
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export { formatPerformanceCount, formatPerformanceMoney, formatPerformancePercent };
