"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { getPaginationItems } from "@/lib/pagination";
import { paginationActiveClassName, paginationNavButtonClassName } from "@/lib/button-styles";
import { cn } from "@/lib/utils";

type PaginationControlsProps = {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** @deprecated Page size is controlled from the grid toolbar. */
  onPageSizeChange?: (value: number) => void;
  /** @deprecated Page size is controlled from the grid toolbar. */
  pageSizeOptions?: number[];
};

const navButtonClassName = paginationNavButtonClassName;

export function PaginationControls({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: PaginationControlsProps) {
  const safeTotalPages = Math.max(totalPages, 1);
  const currentPage = totalItems > 0 ? Math.min(page, safeTotalPages) : 1;
  const pageItems = useMemo(() => getPaginationItems(currentPage, safeTotalPages), [currentPage, safeTotalPages]);

  const startItem = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endItem = totalItems > 0 ? Math.min(currentPage * pageSize, totalItems) : 0;
  const isDisabled = totalItems === 0;

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

      <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={isDisabled || currentPage <= 1}
            aria-label="First page"
            title="First page"
            className={navButtonClassName}
          >
            <ChevronsLeft size={16} />
            <span className="hidden sm:inline">First</span>
          </button>

          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={isDisabled || currentPage <= 1}
            aria-label="Previous page"
            title="Previous page"
            className={navButtonClassName}
          >
            <ChevronLeft size={16} />
            <span className="hidden sm:inline">Previous</span>
          </button>

          <div className="flex items-center gap-1 px-1">
            {pageItems.map((item, index) =>
              item === "ellipsis" ? (
                <span
                  key={`ellipsis-${index}`}
                  className="min-w-8 px-1 text-center text-sm text-slate-400 dark:text-slate-500"
                  aria-hidden
                >
                  ...
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => onPageChange(item)}
                  disabled={isDisabled}
                  aria-label={`Page ${item}`}
                  aria-current={item === currentPage ? "page" : undefined}
                  className={cn(
                    "min-w-9 rounded-xl px-2.5 py-2 font-medium transition",
                    item === currentPage ? paginationActiveClassName : paginationNavButtonClassName
                  )}
                >
                  {item}
                </button>
              )
            )}
          </div>

          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={isDisabled || currentPage >= safeTotalPages}
            aria-label="Next page"
            title="Next page"
            className={navButtonClassName}
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight size={16} />
          </button>

          <button
            type="button"
            onClick={() => onPageChange(safeTotalPages)}
            disabled={isDisabled || currentPage >= safeTotalPages}
            aria-label="Last page"
            title="Last page"
            className={navButtonClassName}
          >
            <span className="hidden sm:inline">Last</span>
            <ChevronsRight size={16} />
          </button>
      </div>
    </div>
  );
}
