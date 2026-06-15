"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type DocumentSyncItemStatus = "pending" | "syncing" | "synced" | "failed";

export type DocumentSyncItem = {
  id: number;
  name: string;
  status: DocumentSyncItemStatus;
  message?: string;
};

export type DocumentSyncProgress = {
  completed: number;
  total: number;
  currentProductName: string;
  synced: number;
  failed: number;
  isComplete: boolean;
  items: DocumentSyncItem[];
};

function StatusIcon({ status }: { status: DocumentSyncItemStatus }) {
  if (status === "synced") {
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />;
  }

  if (status === "failed") {
    return <XCircle className="h-4 w-4 shrink-0 text-red-500" />;
  }

  if (status === "syncing") {
    return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-600" />;
  }

  return <span className="h-4 w-4 shrink-0 rounded-full border border-slate-300 dark:border-slate-600" />;
}

export function SyncProgressPanel({
  progress,
  onDismiss,
}: {
  progress: DocumentSyncProgress;
  onDismiss?: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
  const syncedItems = progress.items.filter((item) => item.status === "synced");
  const failedItems = progress.items.filter((item) => item.status === "failed");

  useEffect(() => {
    if (!listRef.current || progress.isComplete) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [progress.items, progress.isComplete]);

  return (
    <div className="flex min-h-[420px] flex-col space-y-5">
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {progress.isComplete ? "Sync completed" : "Fetching product documentation"}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {progress.isComplete
                ? "All products have been processed. Review the results below."
                : "Downloading product APIs from Phonexa and saving to database."}
            </p>
          </div>
          {progress.isComplete && onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              View documentation
            </button>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Progress</p>
            <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
              {progress.completed} / {progress.total}
            </p>
            <p className="text-sm text-blue-600 dark:text-blue-400">{percent}%</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Success</p>
            <p className="mt-1 text-lg font-semibold text-emerald-800 dark:text-emerald-200">{progress.synced}</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/30">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">Failed</p>
            <p className="mt-1 text-lg font-semibold text-red-800 dark:text-red-200">{progress.failed}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                progress.isComplete ? "bg-emerald-500" : "bg-blue-600"
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
          {!progress.isComplete && progress.currentProductName ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Currently fetching: <span className="font-medium text-slate-900 dark:text-slate-100">{progress.currentProductName}</span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
        <section className="flex min-h-[280px] flex-col overflow-hidden rounded-xl border border-emerald-200 dark:border-emerald-900/40">
          <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/30">
            <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
              Synced successfully ({syncedItems.length})
            </h3>
          </div>
          <div ref={progress.isComplete ? undefined : listRef} className="flex-1 overflow-y-auto p-2">
            {syncedItems.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-slate-400">No successful syncs yet.</p>
            ) : (
              <ul className="space-y-1">
                {syncedItems.map((item) => (
                  <li
                    key={`synced-${item.id}`}
                    className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 dark:text-slate-200"
                  >
                    <StatusIcon status={item.status} />
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    <span className="shrink-0 text-xs text-slate-400">#{item.id}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="flex min-h-[280px] flex-col overflow-hidden rounded-xl border border-red-200 dark:border-red-900/40">
          <div className="border-b border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/40 dark:bg-red-950/30">
            <h3 className="text-sm font-semibold text-red-800 dark:text-red-200">Sync failed ({failedItems.length})</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {failedItems.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-slate-400">No failures.</p>
            ) : (
              <ul className="space-y-1">
                {failedItems.map((item) => (
                  <li
                    key={`failed-${item.id}`}
                    className="rounded-lg px-2 py-2 text-sm text-slate-700 dark:text-slate-200"
                  >
                    <div className="flex items-center gap-2">
                      <StatusIcon status={item.status} />
                      <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
                      <span className="shrink-0 text-xs text-slate-400">#{item.id}</span>
                    </div>
                    {item.message ? (
                      <p className="mt-1 pl-6 text-xs text-red-600 dark:text-red-400">{item.message}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
