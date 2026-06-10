"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PAGE_SIZE_OPTIONS, resolvePageSizeOptions } from "@/lib/pagination";

type PaginationControlsProps = {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (value: number) => void;
  pageSizeOptions?: number[];
};

export function PaginationControls({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [...PAGE_SIZE_OPTIONS],
}: PaginationControlsProps) {
  const sizeOptions = useMemo(
    () => resolvePageSizeOptions(pageSize, pageSizeOptions),
    [pageSize, pageSizeOptions]
  );

  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalItems);

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {totalItems > 0 ? (
          <>
            Showing <span className="font-medium text-slate-900 dark:text-slate-100">{startItem}</span> -{" "}
            <span className="font-medium text-slate-900 dark:text-slate-100">{endItem}</span> of{" "}
            <span className="font-medium text-slate-900 dark:text-slate-100">{totalItems}</span>
          </>
        ) : (
          <>No records found</>
        )}
      </p>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        {onPageSizeChange ? (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-100">Page Size</label>
            <select
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25"
            >
              {sizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option} / page
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || totalItems === 0}
            aria-label="Previous page"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            <ChevronLeft size={16} />
            Previous
          </button>
          <span className="text-sm text-slate-600 dark:text-slate-300">
            Page <span className="font-medium text-slate-900 dark:text-slate-100">{Math.min(page, Math.max(totalPages, 1))}</span> of{" "}
            <span className="font-medium text-slate-900 dark:text-slate-100">{Math.max(totalPages, 1)}</span>
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || totalItems === 0}
            aria-label="Next page"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
