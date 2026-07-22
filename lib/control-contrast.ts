import { cn } from "@/lib/utils";

/**
 * Shared light/dark contrast tokens for form controls and filter UI.
 * Prefer these over raw slate-400 muted classes (too faint on dark surfaces).
 */

/** Primary value text inside inputs/selects. */
export const CONTROL_TEXT_CLASS = "text-slate-800 dark:text-slate-50";

/** Labels above fields. */
export const CONTROL_LABEL_CLASS = "text-slate-700 dark:text-slate-200";

/** Placeholders, empty states, chevrons, secondary icons. */
export const CONTROL_MUTED_CLASS = "text-slate-500 dark:text-slate-300";

/** Helper / description copy under fields. */
export const CONTROL_HINT_CLASS = "text-slate-600 dark:text-slate-300";

/** Control chrome borders — slightly stronger in dark for edge definition. */
export const CONTROL_BORDER_CLASS = "border-slate-300 dark:border-slate-500";

/** Default control surface. */
export const CONTROL_SURFACE_CLASS = "bg-white dark:bg-slate-800";

/** Disabled control text/surface. */
export const CONTROL_DISABLED_CLASS =
  "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500 opacity-80 dark:border-slate-600 dark:bg-slate-900/70 dark:text-slate-400";

/** Base field look shared by Input / Select triggers. */
export const CONTROL_FIELD_CLASS = cn(
  "w-full rounded-xl border text-sm outline-none transition duration-200",
  CONTROL_BORDER_CLASS,
  CONTROL_SURFACE_CLASS,
  CONTROL_TEXT_CLASS,
  "focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:border-blue-400 dark:focus:ring-blue-400/25",
  "placeholder:text-slate-500 dark:placeholder:text-slate-300"
);
