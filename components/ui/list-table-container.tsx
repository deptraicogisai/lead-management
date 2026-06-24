"use client";

import type { ReactNode } from "react";
import { LoadingIndicator, LoadingOverlay } from "@/components/ui/loading-indicator";
import { SkeletonTable } from "@/components/ui/state";
import { cn } from "@/lib/utils";

type ListTableContainerProps = {
  isInitialLoad: boolean;
  isRefreshing: boolean;
  loadingMessage?: string;
  children: ReactNode;
  className?: string;
  initialLoadClassName?: string;
  skeletonRows?: number;
  minHeightClassName?: string;
};

export function ListTableContainer({
  isInitialLoad,
  isRefreshing,
  loadingMessage = "Loading list data",
  children,
  className,
  initialLoadClassName,
  skeletonRows = 10,
  minHeightClassName = "min-h-[min(480px,55vh)]",
}: ListTableContainerProps) {
  if (isInitialLoad) {
    return (
      <div
        className={cn("relative", minHeightClassName, initialLoadClassName)}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="absolute inset-0 opacity-50">
          <SkeletonTable rows={skeletonRows} className="h-full" />
        </div>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white/95 px-6 py-5 shadow-xl shadow-slate-900/10 backdrop-blur-sm dark:border-slate-600 dark:bg-slate-900/95 dark:shadow-black/30">
            <LoadingIndicator size="md" />
          </div>
        </div>

        <span className="sr-only">{loadingMessage}</span>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {children}
      {isRefreshing ? <LoadingOverlay /> : null}
    </div>
  );
}
