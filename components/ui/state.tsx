import type { ReactNode } from "react";

export function PageSection({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function SkeletonCard() {
  return <div className="h-28 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />;
}

export function Spinner() {
  return <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400" />;
}
