"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { SortDirection } from "@/lib/table-sort";

type SortableColumnHeaderProps = {
  label: ReactNode;
  active: boolean;
  direction?: SortDirection;
  onClick: () => void;
};

export function SortableColumnHeader({ label, active, direction, onClick }: SortableColumnHeaderProps) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        onClick();
      }}
      className="inline-flex select-none items-center gap-1 text-left font-semibold text-slate-700 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 dark:text-slate-100 dark:hover:text-white"
    >
      <span>{label}</span>
      <span
        className={cn(
          "text-[10px] leading-none",
          active ? "text-blue-600 dark:text-blue-300" : "text-slate-400"
        )}
        aria-hidden
      >
        {active ? (direction === "asc" ? "▲" : "▼") : "▲▼"}
      </span>
    </button>
  );
}
