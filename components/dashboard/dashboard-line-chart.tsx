import type { DashboardChart } from "@/lib/dashboard";

type DashboardLineChartProps = {
  chart: DashboardChart;
};

const CHART_WIDTH = 960;
const CHART_HEIGHT = 240;
const PADDING = { top: 16, right: 16, bottom: 28, left: 44 };

function buildPath(values: number[], maxValue: number, innerWidth: number, innerHeight: number) {
  if (values.length === 0) return "";

  const stepX = values.length > 1 ? innerWidth / (values.length - 1) : 0;

  return values
    .map((value, index) => {
      const x = PADDING.left + index * stepX;
      const normalized = maxValue > 0 ? value / maxValue : 0;
      const y = PADDING.top + innerHeight - normalized * innerHeight;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

export function DashboardLineChart({ chart }: DashboardLineChartProps) {
  const innerWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const innerHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const maxValue = Math.max(...chart.series.flatMap((series) => series.values), 1);
  const ticks = 4;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-800 dark:text-slate-100">{chart.title}</h2>
      </div>
      <div className="grid min-w-0 md:grid-cols-[minmax(0,1fr)_13rem]">
        <div className="min-w-0 overflow-x-auto px-2 py-3 sm:px-4">
          <svg
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            className="min-w-[680px] w-full"
            role="img"
            aria-label={chart.title}
          >
            {Array.from({ length: ticks + 1 }).map((_, index) => {
              const y = PADDING.top + (innerHeight / ticks) * index;
              const value = maxValue - (maxValue / ticks) * index;

              return (
                <g key={`grid-${index}`}>
                  <line
                    x1={PADDING.left}
                    x2={CHART_WIDTH - PADDING.right}
                    y1={y}
                    y2={y}
                    className="stroke-slate-200 dark:stroke-slate-700"
                    strokeWidth="1"
                  />
                  <text
                    x={PADDING.left - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-slate-400 text-[9px] dark:fill-slate-500"
                  >
                    {value >= 1000
                      ? `${(value / 1000).toFixed(1)}k`
                      : value.toFixed(value < 10 ? 2 : 0)}
                  </text>
                </g>
              );
            })}

            {chart.series.map((series) => (
              <path
                key={series.key}
                d={buildPath(series.values, maxValue, innerWidth, innerHeight)}
                fill="none"
                stroke={series.color}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}

            {chart.dates.map((date, index) => {
              const stepX = chart.dates.length > 1 ? innerWidth / (chart.dates.length - 1) : 0;
              const x = PADDING.left + index * stepX;

              return (
                <text
                  key={date}
                  x={x}
                  y={CHART_HEIGHT - 8}
                  textAnchor="middle"
                  className="fill-slate-500 text-[9px] dark:fill-slate-400"
                >
                  {date}
                </text>
              );
            })}
          </svg>
        </div>

        <aside className="border-t border-slate-200 bg-slate-50/60 px-4 py-3 md:border-t-0 md:border-l dark:border-slate-700 dark:bg-slate-800/30">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Legend
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4 md:grid-cols-1">
            {chart.series.map((series) => (
              <div
                key={series.key}
                className="flex min-w-0 items-center gap-2 text-xs text-slate-600 dark:text-slate-300"
              >
                <span
                  className="h-0.5 w-5 shrink-0 rounded-full"
                  style={{ backgroundColor: series.color }}
                />
                <span className="truncate">{series.label}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
