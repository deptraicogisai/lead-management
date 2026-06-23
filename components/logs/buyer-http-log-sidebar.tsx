"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { getCodeTokenClassName, tokenizeJson } from "@/lib/api-documentation-content";
import {
  parseResponseBodyForDisplay,
  type BuyerHttpExchangeLog,
} from "@/lib/buyer-http-log";
import { cn } from "@/lib/utils";

type LogPanelTone = "request" | "success" | "error" | "neutral";

const LOG_PANEL_TONES: Record<
  LogPanelTone,
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

function JsonLogPanel({ title, data, tone }: { title: string; data: unknown; tone: LogPanelTone }) {
  const code = JSON.stringify(data, null, 2);
  const tokens = tokenizeJson(code);
  const styles = LOG_PANEL_TONES[tone];

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

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-1 break-all text-sm text-slate-800 dark:text-slate-100">{value || "—"}</dd>
    </div>
  );
}

export type BuyerHttpLogSidebarProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  postedAt?: string;
  buyerStatus?: string;
  deliveryStatus?: string;
  httpStatus?: number;
  postLeadUrl?: string;
  log: BuyerHttpExchangeLog;
};

export function BuyerHttpLogSidebar({
  open,
  onClose,
  title,
  subtitle,
  postedAt,
  buyerStatus,
  deliveryStatus,
  httpStatus,
  postLeadUrl,
  log,
}: BuyerHttpLogSidebarProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const request = log.request;
  const response = log.response;
  const responseSuccess =
    response != null &&
    response.httpStatus > 0 &&
    response.httpStatus < 400 &&
    buyerStatus !== "Error" &&
    buyerStatus !== "Timeout" &&
    deliveryStatus !== "fail";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close buyer log sidebar"
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <aside className="relative flex h-full w-full max-w-3xl flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="min-w-0 space-y-1">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
            {subtitle ? <p className="text-sm text-slate-600 dark:text-slate-300">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 p-2 text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <dl className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 dark:border-slate-700 dark:bg-slate-800/50">
            {postedAt ? <MetaItem label="Posted At" value={postedAt} /> : null}
            {buyerStatus ? <MetaItem label="Buyer Status" value={buyerStatus} /> : null}
            {deliveryStatus ? <MetaItem label="Delivery Status" value={deliveryStatus} /> : null}
            {httpStatus != null ? <MetaItem label="HTTP Status" value={String(httpStatus)} /> : null}
            {postLeadUrl ? (
              <div className="sm:col-span-2">
                <MetaItem label="Post URL" value={postLeadUrl} />
              </div>
            ) : null}
          </dl>

          {log.errorMessage ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
              {log.errorMessage}
            </div>
          ) : null}

          {request ? (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">System → Buyer Request</h3>
              <JsonLogPanel
                title={`${request.method} ${request.url}`}
                tone="request"
                data={{
                  method: request.method,
                  url: request.url,
                  headers: request.headers,
                  body: request.body,
                }}
              />
            </section>
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">
              No buyer request was recorded.
            </p>
          )}

          {response ? (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Buyer → System Response</h3>
              <JsonLogPanel
                title={`HTTP ${response.httpStatus || httpStatus || 0}`}
                tone={responseSuccess ? "success" : "error"}
                data={{
                  httpStatus: response.httpStatus || httpStatus || 0,
                  headers: response.headers ?? {},
                  body: parseResponseBodyForDisplay(response.body),
                }}
              />
            </section>
          ) : null}

          {log.mappedValues && Object.keys(log.mappedValues).length > 0 ? (
            <JsonLogPanel title="Array Mapping Values" tone="neutral" data={log.mappedValues} />
          ) : null}

          {log.publisherLead && Object.keys(log.publisherLead).length > 0 ? (
            <JsonLogPanel title="Publisher Lead" tone="neutral" data={log.publisherLead} />
          ) : null}

          {log.systemLead && Object.keys(log.systemLead).length > 0 ? (
            <JsonLogPanel title="System Lead" tone="neutral" data={log.systemLead} />
          ) : null}
        </div>
      </aside>
    </div>
  );
}
