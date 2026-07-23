"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useTableStickyHeader } from "@/lib/use-table-sticky-header";
import { cn } from "@/lib/utils";

type StickyActionsBarProps = {
  children: ReactNode;
  /** Short label shown beside actions once the bar is stuck. */
  stuckLabel?: ReactNode;
  className?: string;
  enabled?: boolean;
  /**
   * `actions` — right-aligned action buttons (default).
   * `content` — full-width toolbar content (filter + actions).
   */
  layout?: "actions" | "content";
  /**
   * Reports how many pixels the table sticky header should clear
   * while this bar is stuck (0 when not stuck).
   */
  onStickyOffsetChange?: (offset: number) => void;
};

/**
 * Keeps page/list actions reachable while scrolling a long grid.
 * Sticks under the app chrome; gains a solid backdrop only after the original position leaves the viewport.
 */
export function StickyActionsBar({
  children,
  stuckLabel,
  className,
  enabled = true,
  layout = "actions",
  onStickyOffsetChange,
}: StickyActionsBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const { sentinelRef, stickyTop, headerIsStuck } = useTableStickyHeader(enabled);

  useLayoutEffect(() => {
    if (!onStickyOffsetChange) return;

    const publish = () => {
      if (!enabled) {
        onStickyOffsetChange(0);
        return;
      }

      const node = barRef.current;
      if (!node) {
        onStickyOffsetChange(0);
        return;
      }

      const rect = node.getBoundingClientRect();
      // Treat as stuck when the bar is pinned under the app chrome.
      const stuck = rect.top <= stickyTop + 1 && rect.bottom > stickyTop;
      onStickyOffsetChange(stuck ? Math.ceil(rect.height) : 0);
    };

    publish();

    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        publish();
      });
    };

    const node = barRef.current;
    const observer = node ? new ResizeObserver(schedule) : null;
    if (node && observer) observer.observe(node);

    const scrollTargets: Array<HTMLElement | Window> = [window];
    let parent = node?.parentElement ?? null;
    while (parent && parent !== document.body) {
      const style = window.getComputedStyle(parent);
      if (style.overflowY === "auto" || style.overflowY === "scroll" || style.overflowY === "overlay") {
        scrollTargets.push(parent);
      }
      parent = parent.parentElement;
    }

    for (const target of scrollTargets) {
      target.addEventListener("scroll", schedule, { passive: true });
    }
    window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
      for (const target of scrollTargets) {
        target.removeEventListener("scroll", schedule);
      }
      window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      onStickyOffsetChange(0);
    };
  }, [enabled, stickyTop, onStickyOffsetChange, headerIsStuck]);

  return (
    <div className={cn("mb-4", className)}>
      {enabled ? <div ref={sentinelRef} className="h-px w-full" aria-hidden /> : null}
      <div
        ref={barRef}
        className={cn(
          "z-[25] transition-[box-shadow,background-color,backdrop-filter,padding] duration-200 ease-out",
          enabled && "sticky",
          headerIsStuck &&
            "border-b border-slate-200 bg-white/95 py-2.5 shadow-sm backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95"
        )}
        style={enabled ? { top: stickyTop } : undefined}
      >
        {layout === "content" ? (
          <div className="flex flex-col gap-2">
            {headerIsStuck && stuckLabel ? (
              <div className="min-w-0 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                {stuckLabel}
              </div>
            ) : null}
            {children}
          </div>
        ) : (
          <div
            className={cn(
              "flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center",
              headerIsStuck && stuckLabel ? "sm:justify-between" : "sm:justify-end"
            )}
          >
            {headerIsStuck && stuckLabel ? (
              <div className="min-w-0 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                {stuckLabel}
              </div>
            ) : null}
            <div className="mobile-page-actions flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              {children}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
