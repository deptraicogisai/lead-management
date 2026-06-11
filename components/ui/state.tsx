"use client";

import type { ReactNode } from "react";
import { SpinnerIcon } from "@/components/ui/loading-indicator";

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
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      {showHeader ? (
        <div className={`flex items-center justify-between gap-3 ${title || actions ? "mb-5" : ""}`}>
          {title ? <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3> : <span />}
          {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function SkeletonCard() {
  return <div className="h-28 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />;
}

export function Spinner() {
  return <SpinnerIcon size="md" />;
}
