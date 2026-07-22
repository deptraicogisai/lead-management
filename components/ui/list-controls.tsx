"use client";

import type { ReactNode } from "react";
import { CONTROL_FIELD_CLASS, CONTROL_LABEL_CLASS } from "@/lib/control-contrast";
import { cn } from "@/lib/utils";

type ListControlsProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  actions?: ReactNode;
};

export function ListControls({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  actions,
}: ListControlsProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:flex-row md:items-end md:justify-between">
      <div className="w-full md:max-w-md">
        <label className={cn("mb-1 block text-sm font-medium", CONTROL_LABEL_CLASS)}>Search</label>
        <input
          type="text"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          className={cn(CONTROL_FIELD_CLASS, "px-3 py-2.5")}
        />
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 md:justify-end">{actions}</div> : null}
    </div>
  );
}
