"use client";

import { CircleHelp } from "lucide-react";
import type { ReactNode } from "react";
import { StickyActionsBar } from "@/components/ui/sticky-actions-bar";

type ListTableToolbarProps = {
  /** @deprecated Showing summary removed from toolbar. */
  showingFrom?: number;
  /** @deprecated Showing summary removed from toolbar. */
  showingTo?: number;
  /** @deprecated Showing summary removed from toolbar. */
  totalItems?: number;
  /** @deprecated Page size is controlled from PaginationControls. */
  pageSize?: number;
  /** @deprecated Page size is controlled from PaginationControls. */
  pageSizeOptions?: number[];
  /** @deprecated Page size is controlled from PaginationControls. */
  onPageSizeChange?: (value: number) => void;
  tableFilter?: string;
  onTableFilterChange?: (value: string) => void;
  onTableFilterSubmit?: () => void;
  filterPlaceholder?: string;
  actions?: ReactNode;
  selectedCount?: number;
  /** Stick filter/actions under app chrome while scrolling the grid. */
  sticky?: boolean;
  stuckLabel?: ReactNode;
  onStickyOffsetChange?: (offset: number) => void;
};

export function ListTableToolbar({
  tableFilter,
  onTableFilterChange,
  onTableFilterSubmit,
  filterPlaceholder = "",
  actions,
  selectedCount = 0,
  sticky = false,
  stuckLabel,
  onStickyOffsetChange,
}: ListTableToolbarProps) {
  const hasContent = Boolean(onTableFilterChange || actions || selectedCount > 0);
  if (!hasContent) return null;

  const body = (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {onTableFilterChange ? (
          <div className="inline-flex min-h-11 w-full min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 sm:min-h-0 sm:w-auto dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <CircleHelp size={14} className="shrink-0" />
            <span className="shrink-0">Filter:</span>
            <input
              type="text"
              value={tableFilter ?? ""}
              onChange={(event) => onTableFilterChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  onTableFilterSubmit?.();
                }
              }}
              className="min-h-9 min-w-0 flex-1 border-none bg-transparent text-sm outline-none sm:min-h-0 sm:w-36 dark:text-slate-100"
              placeholder={filterPlaceholder}
            />
          </div>
        ) : null}

        {actions ? (
          <div className="mobile-page-actions flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            {actions}
          </div>
        ) : null}

        {selectedCount > 0 ? (
          <span className="inline-flex items-center rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
            {selectedCount} selected
          </span>
        ) : null}
      </div>
    </div>
  );

  if (sticky) {
    return (
      <StickyActionsBar
        layout="content"
        stuckLabel={stuckLabel}
        onStickyOffsetChange={onStickyOffsetChange}
      >
        {body}
      </StickyActionsBar>
    );
  }

  return <div className="mb-4">{body}</div>;
}
