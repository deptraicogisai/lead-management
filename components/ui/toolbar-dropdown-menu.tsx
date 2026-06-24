"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ToolbarDropdownMenuProps = {
  open: boolean;
  children: ReactNode;
  className?: string;
};

export function ToolbarDropdownMenu({ open, children, className }: ToolbarDropdownMenuProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className={cn(
        "absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg",
        "sm:left-auto sm:right-0 sm:w-52",
        "dark:border-slate-700 dark:bg-slate-900",
        className
      )}
    >
      {children}
    </div>
  );
}

export const toolbarDropdownItemClassName =
  "block w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 sm:px-4 sm:text-sm dark:text-slate-200 dark:hover:bg-slate-800";
