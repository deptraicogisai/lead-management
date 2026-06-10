import { cn } from "@/lib/utils";

type IdBadgeProps = {
  id: string | number;
  interactive?: boolean;
  className?: string;
};

export function IdBadge({ id, interactive = false, className }: IdBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium transition",
        interactive
          ? "cursor-pointer border-blue-300 bg-blue-50 text-blue-700 group-hover:border-blue-400 group-hover:bg-blue-100 dark:border-blue-500/50 dark:bg-blue-500/10 dark:text-blue-300"
          : "border-slate-300 bg-transparent text-slate-600 dark:border-slate-500 dark:text-slate-300",
        className
      )}
    >
      {id}
    </span>
  );
}
