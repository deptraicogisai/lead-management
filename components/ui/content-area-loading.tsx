"use client";

import { useSidebarLayout } from "@/components/layout/sidebar-layout-context";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { cn } from "@/lib/utils";

type ContentAreaLoadingProps = {
  message?: string;
  loadingMessage?: string;
};

/**
 * Full-bleed loader that fills the dashboard content column (everything to the
 * right of the sidebar) and centers the spinner in it. Used for initial page
 * loads so the indicator sits in the middle of the visible content area instead
 * of being pushed down below toolbars/grids.
 */
export function ContentAreaLoading({ message, loadingMessage }: ContentAreaLoadingProps) {
  const { collapsed } = useSidebarLayout();
  const displayMessage = message ?? loadingMessage;

  return (
    <div
      className={cn(
        "fixed inset-y-0 right-0 left-0 z-20 flex items-center justify-center px-4",
        "bg-slate-100/80 backdrop-blur-[2px] dark:bg-slate-950/80",
        collapsed ? "lg:left-[4.5rem]" : "lg:left-64"
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-200/90 bg-white px-8 py-7 shadow-xl shadow-slate-900/10 dark:border-slate-700/90 dark:bg-slate-900 dark:shadow-black/30">
        <LoadingIndicator message={displayMessage} size="lg" stagedMessage={false} />
      </div>
      <span className="sr-only">{displayMessage ?? "Loading"}</span>
    </div>
  );
}
