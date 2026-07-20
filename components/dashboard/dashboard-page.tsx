"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleHelp } from "lucide-react";
import { DashboardActivityBar } from "@/components/dashboard/dashboard-activity-bar";
import { DashboardKpiCardView } from "@/components/dashboard/dashboard-kpi-card";
import { DashboardLineChart } from "@/components/dashboard/dashboard-line-chart";
import { DashboardRankingPanel } from "@/components/dashboard/dashboard-ranking-panel";
import { PageLoadingShell } from "@/components/ui/state";
import type { DashboardSnapshot } from "@/lib/dashboard";
import { secondaryButtonClassName } from "@/lib/button-styles";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export function DashboardPageContent() {
  const [data, setData] = useState<DashboardSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to fetch dashboard.");
      }

      const payload = (await response.json()) as DashboardSnapshot;
      setData(payload);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  if (isLoading) {
    return <PageLoadingShell />;
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <p className="text-sm text-slate-600 dark:text-slate-300">Failed to load dashboard.</p>
        <button
          type="button"
          onClick={() => void loadDashboard()}
          className={cn(secondaryButtonClassName, "mt-4 px-4 py-2")}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Dashboard</h1>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-slate-500 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Dashboard help"
          >
            <CircleHelp size={14} />
          </button>
        </div>
        <div className="text-sm text-slate-600 dark:text-slate-300">
          Layout: <span className="font-semibold text-slate-900 dark:text-slate-100">{data.layoutName}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {data.kpis.slice(0, 5).map((card) => (
          <DashboardKpiCardView key={card.key} card={card} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.kpis.slice(5).map((card) => (
          <DashboardKpiCardView key={card.key} card={card} />
        ))}
      </div>

      <DashboardActivityBar segments={data.activity} />

      <div className="space-y-4">
        <DashboardLineChart chart={data.publisherChart} />
        <DashboardLineChart chart={data.buyerChart} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <DashboardRankingPanel
          title="Top Publishers"
          summaryHref="/reports/publisher/performance-summary"
          rankings={data.rankings}
          variant="publishers"
        />
        <DashboardRankingPanel
          title="Top Buyers"
          summaryHref="/reports/buyer/performance-summary"
          rankings={data.rankings}
          variant="buyers"
        />
        <DashboardRankingPanel
          title="Top Products by Publisher"
          summaryHref="/reports/publisher/performance-summary"
          rankings={data.rankings}
          variant="products-publisher"
        />
        <DashboardRankingPanel
          title="New Publishers"
          summaryHref="/sellers"
          rankings={data.rankings}
          variant="new-publishers"
        />
        <DashboardRankingPanel
          title="Top Products by Buyers"
          summaryHref="/reports/buyer/performance-summary"
          rankings={data.rankings}
          variant="products-buyer"
        />
        <DashboardRankingPanel
          title="New Campaigns"
          summaryHref="/campaigns"
          rankings={data.rankings}
          variant="new-campaigns"
        />
      </div>
    </div>
  );
}
