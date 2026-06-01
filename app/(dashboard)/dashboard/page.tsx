import { PageSection } from "@/components/ui/state";
import { StatCard } from "@/components/ui/stat-card";
import { stats } from "@/lib/mock-data";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Leads" value={stats.totalLeads} hint="+12% this month" />
        <StatCard title="Total Sellers" value={stats.totalSellers} hint="5 pending approval" />
        <StatCard title="Total Buyers" value={stats.totalBuyers} hint="3 recently active" />
        <StatCard title="Success Rate" value={stats.successRate} hint="Distribution success" />
      </div>

      <PageSection title="Performance Overview">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-300">Lead Quality Score</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">91 / 100</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-300">Average Response Time</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">420 ms</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-300">Rejected Leads</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">8.1%</p>
          </div>
        </div>
      </PageSection>
    </div>
  );
}
