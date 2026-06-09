import { cn } from "@/lib/utils";

type IdBadgeProps = {
  id: string | number;
  className?: string;
};

export function IdBadge({ id, className }: IdBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-transparent text-sm font-medium text-slate-600 dark:border-slate-500 dark:text-slate-300",
        className
      )}
    >
      {id}
    </span>
  );
}
