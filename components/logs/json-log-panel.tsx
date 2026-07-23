"use client";

import { getCodeTokenClassName, tokenizeJson } from "@/lib/api-documentation-content";
import { cn } from "@/lib/utils";

export type JsonLogPanelTone = "request" | "success" | "error" | "neutral";

const LOG_PANEL_TONES: Record<
  JsonLogPanelTone,
  { header: string; border: string; body: string }
> = {
  request: {
    header: "bg-sky-700 text-white dark:bg-sky-600",
    border: "border-sky-200 dark:border-sky-500/40",
    body: "bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-slate-100",
  },
  success: {
    header: "bg-emerald-700 text-white dark:bg-emerald-600",
    border: "border-emerald-200 dark:border-emerald-500/40",
    body: "bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-slate-100",
  },
  error: {
    header: "bg-red-700 text-white dark:bg-red-600",
    border: "border-red-200 dark:border-red-500/40",
    body: "bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-slate-100",
  },
  neutral: {
    header: "bg-slate-700 text-white dark:bg-slate-600",
    border: "border-slate-200 dark:border-slate-600",
    body: "bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-slate-100",
  },
};

export function JsonLogPanel({
  title,
  data,
  tone,
  emptyMessage = "No data recorded.",
}: {
  title: string;
  data: unknown;
  tone: JsonLogPanelTone;
  emptyMessage?: string;
}) {
  const styles = LOG_PANEL_TONES[tone];
  const isEmpty =
    data == null ||
    data === "" ||
    (typeof data === "object" && !Array.isArray(data) && Object.keys(data as object).length === 0);

  if (isEmpty) {
    return (
      <div className={cn("overflow-hidden rounded-2xl border border-dashed shadow-sm", styles.border)}>
        <div className={cn("px-4 py-2.5 text-sm font-semibold", styles.header)}>{title}</div>
        <p className={cn("px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400", styles.body)}>
          {emptyMessage}
        </p>
      </div>
    );
  }

  const code = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  const tokens = tokenizeJson(code);

  return (
    <div className={cn("overflow-hidden rounded-2xl border shadow-sm", styles.border)}>
      <div className={cn("px-4 py-2.5 text-sm font-semibold", styles.header)}>{title}</div>
      <pre className={cn("max-h-80 overflow-auto p-4 text-xs leading-6", styles.body)}>
        {tokens.map((token, index) => {
          const className = getCodeTokenClassName(token.styleKey);
          return className ? (
            <span key={`${title}-${index}`} className={className}>
              {token.text}
            </span>
          ) : (
            <span key={`${title}-${index}`}>{token.text}</span>
          );
        })}
      </pre>
    </div>
  );
}
