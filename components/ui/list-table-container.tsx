"use client";

import type { ReactNode } from "react";
import { ContentAreaLoading } from "@/components/ui/content-area-loading";
import { LoadingOverlay } from "@/components/ui/loading-indicator";
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
  loadingMessage = "Loading list...",
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

        <ContentAreaLoading loadingMessage={loadingMessage} />
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
