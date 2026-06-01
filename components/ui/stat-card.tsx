import { cn } from "@/lib/utils";

type CardProps = {
  title: string;
  value: string | number;
  hint?: string;
  className?: string;
};

export function StatCard({ title, value, hint, className }: CardProps) {
  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900", className)}>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-300">{title}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{value}</p>
      {hint ? <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">{hint}</p> : null}
    </div>
  );
}
