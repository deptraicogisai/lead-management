import { cn } from "@/lib/utils";

/** Shared button styles — aligned with Buyer List. Compact on mobile, standard from sm+. */
export const buttonBaseClassName =
  "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition duration-200 disabled:cursor-not-allowed disabled:opacity-60 sm:gap-2 sm:rounded-xl sm:text-sm";

export const primaryButtonClassName = cn(
  buttonBaseClassName,
  "border border-emerald-700 bg-emerald-800 px-3 py-2 font-semibold text-white hover:bg-emerald-700 sm:px-4 sm:py-2.5 dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"
);

export const toolbarPrimaryButtonClassName = cn(
  buttonBaseClassName,
  "border border-emerald-700 bg-emerald-800 px-2.5 py-1.5 font-medium text-white hover:bg-emerald-700 sm:px-3 sm:py-2 dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"
);

export const secondaryButtonClassName = cn(
  buttonBaseClassName,
  "border border-slate-300 bg-white px-3 py-2 font-medium text-slate-700 hover:bg-slate-100 sm:px-4 sm:py-2.5 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
);

export const cancelButtonClassName = secondaryButtonClassName;

export const dangerButtonClassName = cn(
  buttonBaseClassName,
  "bg-red-600 px-3 py-2 font-semibold text-white hover:bg-red-700 sm:px-4 sm:py-2.5 dark:bg-red-500 dark:hover:bg-red-400"
);

export const warningButtonClassName = cn(
  buttonBaseClassName,
  "border border-amber-300 px-2.5 py-1.5 font-medium text-amber-700 hover:bg-amber-50 sm:px-3 sm:py-2 dark:border-amber-700/70 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/15"
);

export const paginationNavButtonClassName = cn(
  buttonBaseClassName,
  "border border-slate-300 px-2 py-1.5 font-medium text-slate-700 hover:bg-slate-100 sm:px-2.5 sm:py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
);

export const paginationActiveClassName = "bg-emerald-800 text-white dark:bg-emerald-600";

export const paginationInactiveClassName = cn(
  buttonBaseClassName,
  "border border-slate-300 px-2 py-1.5 font-medium text-slate-700 hover:bg-slate-100 sm:px-2.5 sm:py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
);

export const compactPrimaryButtonClassName = cn(
  buttonBaseClassName,
  "border border-emerald-700 bg-emerald-800 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 sm:px-2.5 sm:text-xs dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"
);

export const tableActionButtonClassName =
  "rounded-md border border-slate-300 px-1.5 py-0.5 text-[11px] font-medium text-slate-700 transition hover:bg-slate-100 sm:rounded-lg sm:px-2 sm:py-1 sm:text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700";

export const tableActionDangerButtonClassName =
  "rounded-md border border-red-200 px-1.5 py-0.5 text-[11px] font-medium text-red-600 transition hover:bg-red-50 sm:rounded-lg sm:px-2 sm:py-1 sm:text-xs dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200 dark:hover:bg-red-500/20";
