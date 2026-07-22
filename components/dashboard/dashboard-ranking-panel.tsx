"use client";

import Link from "next/link";
import {
  CalendarDays,
  CalendarRange,
  CircleDollarSign,
  History,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  formatDashboardRedirectCell,
  type DashboardBuyerRankingRow,
  type DashboardNamedRow,
  type DashboardPeriod,
  type DashboardProductRankingRow,
  type DashboardPublisherRankingRow,
  type DashboardRankingData,
} from "@/lib/dashboard";
import {
  formatPerformanceCount,
  formatPerformanceMoney,
} from "@/lib/publisher-performance-summary";
import {
  publisherCellLinkClassName,
  redirectMetricColorClassName,
  tableBodyCellClassName,
  tableHeaderCellClassName,
  tableNumericCellClassName,
} from "@/lib/typography";

type DashboardRankingPanelProps = {
  title: string;
  summaryHref: string;
  rankings: Record<DashboardPeriod, DashboardRankingData>;
  variant: "publishers" | "buyers" | "products-publisher" | "products-buyer" | "new-publishers" | "new-campaigns";
};

const periodOptions: Array<{ value: DashboardPeriod; label: string; icon: LucideIcon }> = [
  { value: "today", label: "Today", icon: CalendarDays },
  { value: "yesterday", label: "Yesterday", icon: History },
  { value: "week", label: "Week", icon: CalendarRange },
];

/** Compact fixed viewport for ~6 body rows so period switches don't flash a scrollbar. */
const rankingTableScrollClassName = cn(
  "table-scroll-thin h-[calc(2.75rem+6*2.55rem)] overflow-y-auto overflow-x-auto overscroll-x-contain",
  "[scrollbar-gutter:stable]"
);

const stickyHeaderCellClassName = cn(
  tableHeaderCellClassName,
  "sticky top-0 z-10 bg-slate-50 dark:bg-slate-800"
);

function EmptyState() {
  return (
    <RankingTableScroll>
      <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-500 dark:text-slate-400">
        No records found.
      </div>
    </RankingTableScroll>
  );
}

function RankingTableScroll({ children }: { children: ReactNode }) {
  return <div className={rankingTableScrollClassName}>{children}</div>;
}

function MoneyHeader({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center justify-end gap-1">
      <CircleDollarSign size={13} className="text-emerald-600 dark:text-emerald-400" aria-hidden />
      {children}
    </span>
  );
}

function PeriodTabs({
  period,
  onChange,
}: {
  period: DashboardPeriod;
  onChange: (value: DashboardPeriod) => void;
}) {
  return (
    <div
      className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-slate-100/80 p-1 shadow-inner dark:border-slate-700 dark:bg-slate-900/80"
      role="tablist"
      aria-label="Ranking period"
    >
      {periodOptions.map((option) => {
        const Icon = option.icon;
        const active = period === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all duration-200 sm:text-xs",
              active
                ? "bg-gradient-to-r from-emerald-700 to-emerald-600 text-white shadow-sm ring-1 ring-emerald-500/30 dark:from-emerald-600 dark:to-emerald-500"
                : "text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            )}
          >
            <Icon size={13} strokeWidth={2.25} aria-hidden />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function PublisherTable({ rows }: { rows: DashboardPublisherRankingRow[] }) {
  if (rows.length === 0) return <EmptyState />;

  return (
    <RankingTableScroll>
      <table className="min-w-full border-collapse">
        <thead>
          <tr>
            <th className={stickyHeaderCellClassName}>Publisher</th>
            <th className={cn(stickyHeaderCellClassName, tableNumericCellClassName)}>Leads</th>
            <th className={cn(stickyHeaderCellClassName, tableNumericCellClassName)}>Sold</th>
            <th className={cn(stickyHeaderCellClassName, tableNumericCellClassName)}>Redirect,%</th>
            <th className={cn(stickyHeaderCellClassName, tableNumericCellClassName)}>
              <MoneyHeader>EPL</MoneyHeader>
            </th>
            <th className={cn(stickyHeaderCellClassName, tableNumericCellClassName)}>
              <MoneyHeader>Earning</MoneyHeader>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
              <td className={tableBodyCellClassName}>
                <span className={publisherCellLinkClassName}>{row.label}</span>
              </td>
              <td className={cn(tableBodyCellClassName, tableNumericCellClassName)}>{formatPerformanceCount(row.leads)}</td>
              <td className={cn(tableBodyCellClassName, tableNumericCellClassName)}>{formatPerformanceCount(row.sold)}</td>
              <td className={cn(tableBodyCellClassName, tableNumericCellClassName, redirectMetricColorClassName)}>
                {formatDashboardRedirectCell(row.redirect, row.redirectRate)}
              </td>
              <td className={cn(tableBodyCellClassName, tableNumericCellClassName)}>{formatPerformanceMoney(row.epl)}</td>
              <td className={cn(tableBodyCellClassName, tableNumericCellClassName)}>{formatPerformanceMoney(row.earning)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </RankingTableScroll>
  );
}

function BuyerTable({ rows }: { rows: DashboardBuyerRankingRow[] }) {
  if (rows.length === 0) return <EmptyState />;

  return (
    <RankingTableScroll>
      <table className="min-w-full border-collapse">
        <thead>
          <tr>
            <th className={stickyHeaderCellClassName}>Buyer</th>
            <th className={cn(stickyHeaderCellClassName, tableNumericCellClassName)}>Leads</th>
            <th className={cn(stickyHeaderCellClassName, tableNumericCellClassName)}>Sold</th>
            <th className={cn(stickyHeaderCellClassName, tableNumericCellClassName)}>
              <MoneyHeader>Earning</MoneyHeader>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
              <td className={tableBodyCellClassName}>
                <span className={publisherCellLinkClassName}>{row.label}</span>
              </td>
              <td className={cn(tableBodyCellClassName, tableNumericCellClassName)}>{formatPerformanceCount(row.leads)}</td>
              <td className={cn(tableBodyCellClassName, tableNumericCellClassName)}>{formatPerformanceCount(row.sold)}</td>
              <td className={cn(tableBodyCellClassName, tableNumericCellClassName)}>{formatPerformanceMoney(row.earning)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </RankingTableScroll>
  );
}

function ProductTable({ rows }: { rows: DashboardProductRankingRow[] }) {
  if (rows.length === 0) return <EmptyState />;

  return (
    <RankingTableScroll>
      <table className="min-w-full border-collapse">
        <thead>
          <tr>
            <th className={stickyHeaderCellClassName}>Product</th>
            <th className={cn(stickyHeaderCellClassName, tableNumericCellClassName)}>Leads</th>
            <th className={cn(stickyHeaderCellClassName, tableNumericCellClassName)}>Sold</th>
            <th className={cn(stickyHeaderCellClassName, tableNumericCellClassName)}>Redirect,%</th>
            <th className={cn(stickyHeaderCellClassName, tableNumericCellClassName)}>
              <MoneyHeader>EPL</MoneyHeader>
            </th>
            <th className={cn(stickyHeaderCellClassName, tableNumericCellClassName)}>
              <MoneyHeader>Earning</MoneyHeader>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
              <td className={tableBodyCellClassName}>{row.label}</td>
              <td className={cn(tableBodyCellClassName, tableNumericCellClassName)}>{formatPerformanceCount(row.leads)}</td>
              <td className={cn(tableBodyCellClassName, tableNumericCellClassName)}>{formatPerformanceCount(row.sold)}</td>
              <td className={cn(tableBodyCellClassName, tableNumericCellClassName, redirectMetricColorClassName)}>
                {formatDashboardRedirectCell(row.redirect, row.redirectRate)}
              </td>
              <td className={cn(tableBodyCellClassName, tableNumericCellClassName)}>{formatPerformanceMoney(row.epl)}</td>
              <td className={cn(tableBodyCellClassName, tableNumericCellClassName)}>{formatPerformanceMoney(row.earning)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </RankingTableScroll>
  );
}

function NamedTable({ rows, label }: { rows: DashboardNamedRow[]; label: string }) {
  if (rows.length === 0) return <EmptyState />;

  return (
    <RankingTableScroll>
      <table className="min-w-full border-collapse">
        <thead>
          <tr>
            <th className={stickyHeaderCellClassName}>{label}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
              <td className={tableBodyCellClassName}>{row.label}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </RankingTableScroll>
  );
}

export function DashboardRankingPanel({ title, summaryHref, rankings, variant }: DashboardRankingPanelProps) {
  const [period, setPeriod] = useState<DashboardPeriod>("today");
  const data = rankings[period];
  const activePeriodLabel =
    periodOptions.find((option) => option.value === period)?.label ?? "Today";

  const content = (() => {
    switch (variant) {
      case "publishers":
        return <PublisherTable rows={data.topPublishers} />;
      case "buyers":
        return <BuyerTable rows={data.topBuyers} />;
      case "products-publisher":
        return <ProductTable rows={data.topProductsByPublisher} />;
      case "products-buyer":
        return <ProductTable rows={data.topProductsByBuyers} />;
      case "new-publishers":
        return <NamedTable rows={data.newPublishers} label="Publisher" />;
      case "new-campaigns":
        return <NamedTable rows={data.newCampaigns} label="Campaign" />;
      default:
        return null;
    }
  })();

  const resultCount = (() => {
    switch (variant) {
      case "publishers":
        return data.topPublishers.length;
      case "buyers":
        return data.topBuyers.length;
      case "products-publisher":
        return data.topProductsByPublisher.length;
      case "products-buyer":
        return data.topProductsByBuyers.length;
      case "new-publishers":
        return data.newPublishers.length;
      case "new-campaigns":
        return data.newCampaigns.length;
      default:
        return 0;
    }
  })();

  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-800 dark:text-slate-100">{title}</h2>
        <PeriodTabs period={period} onChange={setPeriod} />
      </div>
      <div
        key={period}
        className="dashboard-period-result min-h-[180px] flex-1"
        aria-live="polite"
        aria-label={`${activePeriodLabel}: ${resultCount} results`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-4 py-2 text-[11px] dark:border-slate-800 dark:bg-slate-800/30">
          <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
            Showing {activePeriodLabel}
          </span>
          <span className="tabular-nums text-slate-500 dark:text-slate-400">
            {resultCount} {resultCount === 1 ? "result" : "results"}
          </span>
        </div>
        {content}
      </div>
      <div className="flex justify-end border-t border-slate-200 px-4 py-3 dark:border-slate-700">
        <Link
          href={summaryHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex rounded-lg border border-emerald-700 bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          View Performance Summary
        </Link>
      </div>
    </section>
  );
}
