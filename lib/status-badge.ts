import { cn } from "@/lib/utils";

export type StatusBadgeVariant = "pill" | "solid" | "outline";

type StatusStyleSet = Record<StatusBadgeVariant, string>;

const BASE_PILL = "rounded-full font-medium";
const BASE_SOLID = "rounded font-semibold text-white";
const BASE_OUTLINE = "rounded-full border font-semibold bg-white dark:bg-transparent";

const STATUS_STYLES: Record<string, StatusStyleSet> = {
  active: {
    pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    solid: "bg-emerald-600 dark:bg-emerald-500",
    outline: "border-emerald-600 text-emerald-700 dark:border-emerald-500 dark:text-emerald-300",
  },
  inactive: {
    pill: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    solid: "bg-slate-500 dark:bg-slate-600",
    outline: "border-slate-400 text-slate-600 dark:border-slate-500 dark:text-slate-300",
  },
  paused: {
    pill: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    solid: "bg-amber-500 dark:bg-amber-600",
    outline: "border-amber-500 text-amber-700 dark:border-amber-500 dark:text-amber-300",
  },
  disabled: {
    pill: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    solid: "bg-rose-500 dark:bg-rose-600",
    outline: "border-rose-500 text-rose-600 dark:border-rose-500 dark:text-rose-300",
  },
  draft: {
    pill: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    solid: "bg-sky-600 dark:bg-sky-500",
    outline: "border-sky-500 text-sky-700 dark:border-sky-500 dark:text-sky-300",
  },
  accept: {
    pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    solid: "bg-emerald-600 dark:bg-emerald-500",
    outline: "border-emerald-600 text-emerald-700 dark:border-emerald-500 dark:text-emerald-300",
  },
  sold: {
    pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    solid: "bg-emerald-600 dark:bg-emerald-500",
    outline: "border-emerald-600 text-emerald-700 dark:border-emerald-500 dark:text-emerald-300",
  },
  success: {
    pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    solid: "bg-emerald-600 dark:bg-emerald-500",
    outline: "border-emerald-600 text-emerald-700 dark:border-emerald-500 dark:text-emerald-300",
  },
  redirected: {
    pill: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    solid: "bg-blue-600 dark:bg-blue-500",
    outline: "border-blue-500 text-blue-700 dark:border-blue-500 dark:text-blue-300",
  },
  completed: {
    pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    solid: "bg-emerald-600 dark:bg-emerald-500",
    outline: "border-emerald-600 text-emerald-700 dark:border-emerald-500 dark:text-emerald-300",
  },
  reject: {
    pill: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
    solid: "bg-red-600 dark:bg-red-500",
    outline: "border-red-500 text-red-600 dark:border-red-500 dark:text-red-300",
  },
  fail: {
    pill: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
    solid: "bg-red-600 dark:bg-red-500",
    outline: "border-red-500 text-red-600 dark:border-red-500 dark:text-red-300",
  },
  "not redirected": {
    pill: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    solid: "bg-slate-500 dark:bg-slate-600",
    outline: "border-slate-400 text-slate-600 dark:border-slate-500 dark:text-slate-300",
  },
  pending: {
    pill: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    solid: "bg-amber-500 dark:bg-amber-600",
    outline: "border-amber-500 text-amber-700 dark:border-amber-500 dark:text-amber-300",
  },
};

const DEFAULT_STYLES: StatusStyleSet = {
  pill: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  solid: "bg-slate-500 dark:bg-slate-600",
  outline: "border-slate-400 text-slate-600 dark:border-slate-500 dark:text-slate-300",
};

function normalizeStatusKey(status: string) {
  return status.trim().toLowerCase().replace(/\s+/g, " ");
}

export function getStatusBadgeClassName(status: string, variant: StatusBadgeVariant = "pill") {
  const key = normalizeStatusKey(status);
  const styles = STATUS_STYLES[key] ?? DEFAULT_STYLES;

  if (variant === "pill") {
    return cn(BASE_PILL, styles.pill);
  }

  if (variant === "solid") {
    return cn(BASE_SOLID, styles.solid);
  }

  return cn(BASE_OUTLINE, styles.outline);
}
