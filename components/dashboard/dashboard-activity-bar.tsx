import Link from "next/link";
import { cn } from "@/lib/utils";
import type { DashboardActivitySegment } from "@/lib/dashboard";

const toneClassName: Record<DashboardActivitySegment["tone"], string> = {
  today: "bg-[#d9534f] text-white",
  yesterday: "bg-[#f0ad4e] text-white",
  "last-week": "bg-[#9e9e9e] text-white",
  "last-month": "bg-[#616161] text-white",
};

type DashboardActivityBarProps = {
  segments: DashboardActivitySegment[];
};

export function DashboardActivityBar({ segments }: DashboardActivityBarProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-2.5 dark:border-slate-700">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">System Activity</h2>
        <Link
          href="/logs"
          className="text-xs font-semibold uppercase tracking-wide text-[#337ab7] underline-offset-2 hover:underline dark:text-[#5ba4e6]"
        >
          More Details
        </Link>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4">
        {segments.map((segment) => (
          <div
            key={segment.key}
            className={cn("flex min-h-[72px] flex-col justify-center px-4 py-3", toneClassName[segment.tone])}
          >
            <p className="text-xs font-semibold uppercase tracking-wide opacity-95">{segment.label}</p>
            <p className="mt-1 text-3xl font-semibold leading-none">{segment.count.toLocaleString("en-US")}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
