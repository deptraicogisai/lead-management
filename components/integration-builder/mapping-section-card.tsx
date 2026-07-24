"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type MappingSectionCardProps = {
  title: string;
  badge?: string;
  description?: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
  className?: string;
  /** Soft accent for Ping vs Post */
  tone?: "default" | "post" | "ping";
};

const TONE_STYLES = {
  default: {
    badge: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
    headerHover: "hover:bg-slate-50/80 dark:hover:bg-slate-800/60",
  },
  post: {
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
    headerHover: "hover:bg-emerald-50/50 dark:hover:bg-emerald-500/5",
  },
  ping: {
    badge: "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
    headerHover: "hover:bg-sky-50/50 dark:hover:bg-sky-500/5",
  },
} as const;

export function MappingSectionCard({
  title,
  badge,
  description,
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  children,
  className,
  tone = "default",
}: MappingSectionCardProps) {
  const reactId = useId();
  const panelId = `mapping-section-${reactId}`;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const toneStyles = TONE_STYLES[tone];

  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) {
      setUncontrolledOpen(next);
    }
    onOpenChange?.(next);
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow duration-300 dark:border-slate-700 dark:bg-slate-900",
        open && "shadow-md shadow-slate-200/60 dark:shadow-black/20",
        className
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full items-center gap-3 border-b px-5 py-4 text-left transition-colors duration-200",
          open ? "border-slate-200 dark:border-slate-700" : "border-transparent",
          toneStyles.headerHover
        )}
      >
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition-transform duration-300 ease-out dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300",
            open && "rotate-180 bg-white dark:bg-slate-900"
          )}
        >
          <ChevronDown size={16} strokeWidth={2.25} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold uppercase tracking-wide text-slate-800 dark:text-slate-100">
              {title}
            </span>
            {badge ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                  toneStyles.badge
                )}
              >
                {badge}
              </span>
            ) : null}
          </span>
          {description ? (
            <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{description}</span>
          ) : null}
        </span>

        <span className="shrink-0 text-xs font-medium text-slate-400 dark:text-slate-500">
          {open ? "Collapse" : "Expand"}
        </span>
      </button>

      <div
        id={panelId}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
        aria-hidden={!open}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={cn(
              "transition-[transform,opacity] duration-300 ease-in-out motion-reduce:transition-none",
              open ? "translate-y-0 opacity-100" : "-translate-y-1.5 opacity-0"
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
