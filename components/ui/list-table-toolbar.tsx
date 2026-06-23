"use client";

import { CircleHelp } from "lucide-react";
import type { ReactNode } from "react";
import { paginationActiveClassName } from "@/lib/button-styles";
import { cn } from "@/lib/utils";

type ListTableToolbarProps = {
  showingFrom: number;
  showingTo: number;
  totalItems: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (value: number) => void;
  tableFilter?: string;
  onTableFilterChange?: (value: string) => void;
  onTableFilterSubmit?: () => void;
  filterPlaceholder?: string;
  actions?: ReactNode;
  selectedCount?: number;
};

export function ListTableToolbar({
  showingFrom,
  showingTo,
  totalItems,
  pageSize,
  pageSizeOptions = [15, 50],
  onPageSizeChange,
  tableFilter,
  onTableFilterChange,
  onTableFilterSubmit,
  filterPlaceholder = "",
  actions,
  selectedCount = 0,
}: ListTableToolbarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {onPageSizeChange && pageSize !== undefined ? (
          <div className="inline-flex overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
            {pageSizeOptions.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => onPageSizeChange(size)}
                className={cn(
                  "px-3 py-2 text-sm font-medium transition",
                  pageSize === size ? paginationActiveClassName : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                )}
              >
                {size}
              </button>
            ))}
          </div>
        ) : null}

        <div className="text-sm text-slate-600 dark:text-slate-300">
          Showing <span className="font-semibold text-slate-900 dark:text-slate-100">{showingFrom}</span> to{" "}
          <span className="font-semibold text-slate-900 dark:text-slate-100">{showingTo}</span> of{" "}
          <span className="font-semibold text-slate-900 dark:text-slate-100">{totalItems}</span> entries
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {onTableFilterChange ? (
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <CircleHelp size={14} />
            <span>Filter:</span>
            <input
              type="text"
              value={tableFilter ?? ""}
              onChange={(event) => onTableFilterChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  onTableFilterSubmit?.();
                }
              }}
              className="w-28 border-none bg-transparent text-sm outline-none dark:text-slate-100"
              placeholder={filterPlaceholder}
            />
          </div>
        ) : null}

        {actions}

        {selectedCount > 0 ? (
          <span className="inline-flex items-center rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
            {selectedCount} selected
          </span>
        ) : null}
      </div>
    </div>
  );
}
