"use client";

import type { ReactNode } from "react";
import { LoadingIndicator, LoadingOverlay } from "@/components/ui/loading-indicator";
import { cn } from "@/lib/utils";

type ListTableContainerProps = {
  isInitialLoad: boolean;
  isRefreshing: boolean;
  loadingMessage: string;
  children: ReactNode;
  className?: string;
  initialLoadClassName?: string;
};

export function ListTableContainer({
  isInitialLoad,
  isRefreshing,
  loadingMessage,
  children,
  className,
  initialLoadClassName,
}: ListTableContainerProps) {
  if (isInitialLoad) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 dark:border-slate-600 dark:bg-slate-900",
          initialLoadClassName
        )}
      >
        <LoadingIndicator message={loadingMessage} size="lg" />
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
