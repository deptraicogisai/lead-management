import {
  formatPerformanceCount,
  formatPerformanceMoney,
  formatPerformancePercent,
} from "@/lib/publisher-performance-summary";

export type DashboardPeriod = "today" | "yesterday" | "week";

export type DashboardComparison = {
  priorDay: number;
  priorWeek: number;
};

export type DashboardKpiCard = {
  key: string;
  title: string;
  value: number;
  format: "money" | "count" | "percent" | "money-paren";
  comparison: DashboardComparison;
};

export type DashboardActivitySegment = {
  key: DashboardPeriod | "last-month";
  label: string;
  count: number;
  tone: "today" | "yesterday" | "last-week" | "last-month";
};

export type DashboardChartSeries = {
  key: string;
  label: string;
  color: string;
  values: number[];
};

export type DashboardChart = {
  title: string;
  dates: string[];
  series: DashboardChartSeries[];
};

export type DashboardPublisherRankingRow = {
  id: string;
  label: string;
  leads: number;
  sold: number;
  redirect: number;
  redirectRate: number;
  epl: number;
  earning: number;
};

export type DashboardBuyerRankingRow = {
  id: string;
  label: string;
  leads: number;
  sold: number;
  earning: number;
};

export type DashboardProductRankingRow = {
  id: string;
  label: string;
  leads: number;
  sold: number;
  redirect: number;
  redirectRate: number;
  epl: number;
  earning: number;
};

export type DashboardNamedRow = {
  id: string;
  label: string;
};

export type DashboardRankingData = {
  topPublishers: DashboardPublisherRankingRow[];
  topBuyers: DashboardBuyerRankingRow[];
  topProductsByPublisher: DashboardProductRankingRow[];
  topProductsByBuyers: DashboardProductRankingRow[];
  newPublishers: DashboardNamedRow[];
  newCampaigns: DashboardNamedRow[];
};

export type DashboardSnapshot = {
  layoutName: string;
  kpis: DashboardKpiCard[];
  activity: DashboardActivitySegment[];
  publisherChart: DashboardChart;
  buyerChart: DashboardChart;
  rankings: Record<DashboardPeriod, DashboardRankingData>;
};

export const PUBLISHER_CHART_SERIES: Array<Omit<DashboardChartSeries, "values">> = [
  { key: "post", label: "Post", color: "#16a34a" },
  { key: "lead", label: "Lead", color: "#22c55e" },
  { key: "sold", label: "Sold", color: "#94a3b8" },
  { key: "redirect", label: "Redirect", color: "#337ab7" },
  { key: "pub", label: "Pub $", color: "#0ea5e9" },
  { key: "ttl", label: "TTL $", color: "#f59e0b" },
  { key: "adm", label: "ADM $", color: "#a855f7" },
  { key: "epl", label: "EPL $", color: "#ef4444" },
];

export const BUYER_CHART_SERIES: Array<Omit<DashboardChartSeries, "values">> = [
  { key: "post", label: "Post", color: "#16a34a" },
  { key: "rejected", label: "Rejected", color: "#f59e0b" },
  { key: "sold", label: "Sold", color: "#94a3b8" },
  { key: "redirectRate", label: "Redirects %", color: "#337ab7" },
  { key: "acceptRate", label: "Accept rate %", color: "#22c55e" },
  { key: "pub", label: "Pub $", color: "#0ea5e9" },
  { key: "adm", label: "ADM $", color: "#a855f7" },
  { key: "ttl", label: "TTL $", color: "#f97316" },
];

export function formatDashboardKpiValue(card: DashboardKpiCard) {
  switch (card.format) {
    case "money":
      return formatPerformanceMoney(card.value);
    case "money-paren": {
      const formatted = formatPerformanceMoney(card.value);
      return card.value < 0 ? `(${formatted.replace("-", "")})` : formatted;
    }
    case "count":
      return formatPerformanceCount(card.value);
    case "percent":
      return formatPerformancePercent(card.value);
    default:
      return String(card.value);
  }
}

export function formatDashboardComparisonValue(card: DashboardKpiCard, priorValue: number) {
  switch (card.format) {
    case "money":
    case "money-paren":
      return formatPerformanceMoney(priorValue);
    case "count":
      return formatPerformanceCount(priorValue);
    case "percent":
      return formatPerformancePercent(priorValue);
    default:
      return String(priorValue);
  }
}

export function formatDashboardChangePercent(current: number, prior: number) {
  if (!Number.isFinite(current) || !Number.isFinite(prior) || prior === 0) {
    return prior === current ? 0 : 100;
  }

  return ((current - prior) / Math.abs(prior)) * 100;
}

export function formatDashboardRedirectCell(redirect: number, redirectRate: number) {
  return `${formatPerformanceCount(redirect)} (${formatPerformancePercent(redirectRate)})`;
}
