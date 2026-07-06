"use client";

import Link from "next/link";
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

const periodOptions: Array<{ value: DashboardPeriod; label: string }> = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "Week" },
];

function EmptyState() {
  return <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">No records found.</p>;
}

function PeriodTabs({
  period,
  onChange,
}: {
  period: DashboardPeriod;
  onChange: (value: DashboardPeriod) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {periodOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded px-2 py-1 text-[11px] font-semibold uppercase tracking-wide transition sm:text-xs",
            period === option.value
              ? "bg-emerald-700 text-white dark:bg-emerald-600"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function PublisherTable({ rows }: { rows: DashboardPublisherRankingRow[] }) {
  if (rows.length === 0) return <EmptyState />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/70">
            <th className={tableHeaderCellClassName}>Publisher</th>
            <th className={cn(tableHeaderCellClassName, tableNumericCellClassName)}>Leads</th>
            <th className={cn(tableHeaderCellClassName, tableNumericCellClassName)}>Sold</th>
            <th className={cn(tableHeaderCellClassName, tableNumericCellClassName)}>Redirect,%</th>
            <th className={cn(tableHeaderCellClassName, tableNumericCellClassName)}>EPL</th>
            <th className={cn(tableHeaderCellClassName, tableNumericCellClassName)}>Earning</th>
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
    </div>
  );
}

function BuyerTable({ rows }: { rows: DashboardBuyerRankingRow[] }) {
  if (rows.length === 0) return <EmptyState />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/70">
            <th className={tableHeaderCellClassName}>Buyer</th>
            <th className={cn(tableHeaderCellClassName, tableNumericCellClassName)}>Leads</th>
            <th className={cn(tableHeaderCellClassName, tableNumericCellClassName)}>Sold</th>
            <th className={cn(tableHeaderCellClassName, tableNumericCellClassName)}>Earning</th>
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
    </div>
  );
}

function ProductTable({ rows }: { rows: DashboardProductRankingRow[] }) {
  if (rows.length === 0) return <EmptyState />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/70">
            <th className={tableHeaderCellClassName}>Product</th>
            <th className={cn(tableHeaderCellClassName, tableNumericCellClassName)}>Leads</th>
            <th className={cn(tableHeaderCellClassName, tableNumericCellClassName)}>Sold</th>
            <th className={cn(tableHeaderCellClassName, tableNumericCellClassName)}>Redirect,%</th>
            <th className={cn(tableHeaderCellClassName, tableNumericCellClassName)}>EPL</th>
            <th className={cn(tableHeaderCellClassName, tableNumericCellClassName)}>Earning</th>
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
    </div>
  );
}

function NamedTable({ rows, label }: { rows: DashboardNamedRow[]; label: string }) {
  if (rows.length === 0) return <EmptyState />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/70">
            <th className={tableHeaderCellClassName}>{label}</th>
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
    </div>
  );
}

export function DashboardRankingPanel({ title, summaryHref, rankings, variant }: DashboardRankingPanelProps) {
  const [period, setPeriod] = useState<DashboardPeriod>("today");
  const data = rankings[period];

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

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-800 dark:text-slate-100">{title}</h2>
        <PeriodTabs period={period} onChange={setPeriod} />
      </div>
      <div className="min-h-[180px] flex-1">{content}</div>
      <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-700">
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
