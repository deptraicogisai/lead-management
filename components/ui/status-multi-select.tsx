"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/form-controls";
import {
  FILTER_DROPDOWN_ITEM_CLASS,
  FILTER_DROPDOWN_MAX_VISIBLE_ITEMS,
  FILTER_DROPDOWN_SCROLL_CLASS,
} from "@/components/ui/search-filter-layout";
import { cn } from "@/lib/utils";

export type StatusMultiSelectOption = {
  value: string;
  label: string;
};

type StatusMultiSelectProps = {
  id?: string;
  options: StatusMultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  /** Shown when nothing is selected (interpreted as "all"). */
  placeholder?: string;
  /** When selected count reaches this threshold, show "{n} selected" instead of labels. */
  summaryThreshold?: number;
  disabled?: boolean;
  className?: string;
};

/**
 * Multi-select dropdown for status filters.
 * Display rules: 0 selected -> placeholder, 1-2 -> comma-joined labels, >= threshold -> "{n} selected".
 */
export function StatusMultiSelect({
  id,
  options,
  selected,
  onChange,
  placeholder = "All",
  summaryThreshold = 3,
  disabled = false,
  className,
}: StatusMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const labelByValue = useMemo(
    () => new Map(options.map((option) => [option.value, option.label])),
    [options]
  );

  const selectedInOrder = useMemo(
    () => options.filter((option) => selected.includes(option.value)).map((option) => option.value),
    [options, selected]
  );

  const allSelected = options.length > 0 && selectedInOrder.length === options.length;

  const summaryLabel = useMemo(() => {
    if (selectedInOrder.length === 0 || allSelected) return placeholder;
    if (selectedInOrder.length >= summaryThreshold) return `${selectedInOrder.length} selected`;
    return selectedInOrder.map((value) => labelByValue.get(value) ?? value).join(", ");
  }, [allSelected, labelByValue, placeholder, selectedInOrder, summaryThreshold]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }

    const updateMenuPosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      setMenuPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open]);

  const toggleOption = (value: string, checked: boolean) => {
    if (checked) {
      onChange(selected.includes(value) ? selected : [...selected, value]);
      return;
    }
    onChange(selected.filter((item) => item !== value));
  };

  const selectAll = () => onChange(options.map((option) => option.value));
  const deselectAll = () => onChange([]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex min-h-[2.75rem] w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left text-sm text-slate-800 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50",
          disabled && "cursor-not-allowed opacity-60"
        )}
      >
        <span className={cn("truncate", selectedInOrder.length === 0 && "text-slate-400")}>{summaryLabel}</span>
        <ChevronDown size={16} className={cn("shrink-0 text-slate-400 transition", open && "rotate-180")} />
      </button>

      {open && menuPosition && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              style={{
                position: "fixed",
                top: menuPosition.top,
                left: menuPosition.left,
                width: menuPosition.width,
              }}
              className="z-[100] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-700">
                <button
                  type="button"
                  onClick={selectAll}
                  disabled={allSelected}
                  className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={deselectAll}
                  disabled={selectedInOrder.length === 0}
                  className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-amber-500/15 dark:text-amber-300 dark:hover:bg-amber-500/25"
                >
                  Deselect all
                </button>
              </div>

              <div
                className={cn(
                  "py-1",
                  options.length > FILTER_DROPDOWN_MAX_VISIBLE_ITEMS && FILTER_DROPDOWN_SCROLL_CLASS
                )}
              >
                {options.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">No options available.</p>
                ) : (
                  options.map((option) => (
                    <Checkbox
                      key={option.value}
                      id={`${id ?? "status-multi-select"}-${option.value}`}
                      checked={selected.includes(option.value)}
                      onChange={(checked) => toggleOption(option.value, checked)}
                      className={cn(
                        "rounded-none px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/70",
                        FILTER_DROPDOWN_ITEM_CLASS
                      )}
                      label={option.label}
                    />
                  ))
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
