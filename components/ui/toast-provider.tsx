"use client";

import { CheckCircle2, X, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { subscribeToToasts, type ToastRecord } from "@/lib/toast";
import { cn } from "@/lib/utils";

export function ToastProvider() {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  useEffect(() => {
    return subscribeToToasts((toast) => {
      setToasts((current) => [...current, toast]);

      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== toast.id));
      }, toast.durationMs ?? 4000);
    });
  }, []);

  const dismiss = (id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[100] flex w-auto max-w-sm flex-col gap-3 sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-[max(1rem,env(safe-area-inset-top))] sm:w-full"
    >
      {toasts.map((toast) => {
        const isError = toast.variant === "error";
        const Icon = isError ? XCircle : CheckCircle2;

        return (
          <div
            key={toast.id}
            role="status"
            className={cn(
              "pointer-events-auto overflow-hidden rounded-2xl border bg-white shadow-lg dark:bg-slate-900",
              isError
                ? "border-red-200 dark:border-red-500/40"
                : "border-emerald-200 dark:border-emerald-500/40"
            )}
          >
            <div className="flex items-start gap-3 p-4">
              <Icon
                size={20}
                className={cn(
                  "mt-0.5 shrink-0",
                  isError ? "text-red-600 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"
                )}
              />
              <div className="min-w-0 flex-1">
                {toast.title ? (
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{toast.title}</p>
                ) : null}
                <p className={cn("text-sm text-slate-600 dark:text-slate-300", toast.title && "mt-1")}>
                  {toast.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="shrink-0 rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                aria-label="Dismiss notification"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
