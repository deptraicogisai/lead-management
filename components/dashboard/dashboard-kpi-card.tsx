import { cn } from "@/lib/utils";
import {
  formatDashboardChangePercent,
  formatDashboardComparisonValue,
  formatDashboardKpiValue,
  type DashboardKpiCard,
} from "@/lib/dashboard";

type DashboardKpiCardProps = {
  card: DashboardKpiCard;
};

function ComparisonRow({
  label,
  priorValue,
  currentValue,
  card,
}: {
  label: string;
  priorValue: number;
  currentValue: number;
  card: DashboardKpiCard;
}) {
  const change = formatDashboardChangePercent(currentValue, priorValue);
  const isUp = change >= 0;

  return (
    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 sm:text-xs dark:text-slate-400">
      <span className="truncate">{label}</span>
      <div className="flex items-center gap-1 whitespace-nowrap">
        <span className="font-medium text-slate-700 dark:text-slate-200">
          {formatDashboardComparisonValue(card, priorValue)}
        </span>
        <span className={cn("font-semibold", isUp ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
          {isUp ? "▲" : "▼"}
          {Math.abs(change).toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

export function DashboardKpiCardView({ card }: DashboardKpiCardProps) {
  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/80">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 sm:text-xs dark:text-slate-300">
          {card.title}
        </h3>
      </div>
      <div className="px-3 py-4 text-center">
        <p className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.65rem] dark:text-slate-50">
          {formatDashboardKpiValue(card)}
        </p>
      </div>
      <div className="space-y-1.5 border-t border-slate-200 px-3 py-2.5 dark:border-slate-700">
        <ComparisonRow label="Prior Day" priorValue={card.comparison.priorDay} currentValue={card.value} card={card} />
        <ComparisonRow label="Prior Week" priorValue={card.comparison.priorWeek} currentValue={card.value} card={card} />
      </div>
    </article>
  );
}
