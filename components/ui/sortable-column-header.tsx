"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { SortDirection } from "@/lib/table-sort";

type SortableColumnHeaderProps = {
  label: ReactNode;
  active: boolean;
  direction?: SortDirection;
  onClick: () => void;
  align?: "left" | "right";
  className?: string;
};

export function SortableColumnHeader({
  label,
  active,
  direction,
  onClick,
  align = "left",
  className,
}: SortableColumnHeaderProps) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        onClick();
      }}
      className={cn(
        "inline-flex max-w-full select-none items-center gap-1 font-semibold text-slate-700 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 dark:text-slate-100 dark:hover:text-white",
        align === "right" ? "w-full justify-end text-right" : "text-left",
        className
      )}
    >
      <span className="whitespace-nowrap">{label}</span>
      <span
        className={cn(
          "inline-flex w-3 shrink-0 flex-col items-center justify-center text-[8px] leading-[0.7]",
          active ? "text-blue-600 dark:text-blue-300" : "text-slate-400"
        )}
        aria-hidden
      >
        <span className={cn(active && direction !== "asc" && "opacity-30")}>▲</span>
        <span className={cn(active && direction !== "desc" && "opacity-30")}>▼</span>
      </span>
    </button>
  );
}
