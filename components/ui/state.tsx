"use client";

import type { ReactNode } from "react";
import { SpinnerIcon } from "@/components/ui/loading-indicator";
import { cn } from "@/lib/utils";

export function PageSection({
  title,
  actions,
  children,
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const showHeader = Boolean(title || actions);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 md:p-6 dark:border-slate-700 dark:bg-slate-900">
      {showHeader ? (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          {title ? <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3> : <span />}
          {actions ? (
            <div className="mobile-page-actions flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-2">
              {actions}
            </div>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

type SkeletonLineProps = {
  className?: string;
};

export function SkeletonLine({ className }: SkeletonLineProps) {
  return <div className={cn("skeleton-shimmer rounded-md bg-slate-200 dark:bg-slate-800", className)} />;
}

export function SkeletonCard() {
  return (
    <div className="animate-loading-enter rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <SkeletonLine className="h-3 w-24" />
        <SkeletonLine className="h-6 w-6 rounded-full" />
      </div>
      <SkeletonLine className="mt-4 h-7 w-28" />
      <SkeletonLine className="mt-3 h-3 w-full max-w-[180px]" />
    </div>
  );
}

type SkeletonTableProps = {
  rows?: number;
  columns?: number;
  className?: string;
};

export function SkeletonTable({ rows = 8, columns = 5, className }: SkeletonTableProps) {
  const headerWidths = ["w-28", "w-36", "w-24", "w-32", "w-20", "w-28"];
  const rowWidths = ["w-[72%]", "w-[58%]", "w-[44%]", "w-[62%]", "w-[38%]", "w-[52%]"];

  return (
    <div
      className={cn(
        "animate-loading-enter overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900",
        className
      )}
      aria-hidden="true"
    >
      <div className="border-b border-slate-200 bg-slate-50/90 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
        <div className="flex gap-6">
          {Array.from({ length: columns }).map((_, index) => (
            <SkeletonLine key={`header-${index}`} className={cn("h-3", headerWidths[index % headerWidths.length])} />
          ))}
        </div>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={`row-${rowIndex}`} className="flex items-center gap-6 px-4 py-3.5">
            {Array.from({ length: columns }).map((__, columnIndex) => (
              <SkeletonLine
                key={`cell-${rowIndex}-${columnIndex}`}
                className={cn("h-3", rowWidths[(rowIndex + columnIndex) % rowWidths.length])}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageLoadingShell() {
  return (
    <div className="space-y-4 p-2">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <SkeletonTable rows={9} columns={6} />
    </div>
  );
}

export function Spinner() {
  return <SpinnerIcon size="md" />;
}
