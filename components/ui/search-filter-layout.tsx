"use client";

import { type ButtonHTMLAttributes, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { ClearButton, SearchButton } from "@/components/ui/action-buttons";
import { FieldLabel } from "@/components/ui/form-controls";
import { cn } from "@/lib/utils";
export type SearchFilterSelectOption = {
  value: string;
  label: string;
};

function isPinnedFilterSelectOption(option: SearchFilterSelectOption) {
  const normalizedValue = option.value.trim().toLowerCase();
  const normalizedLabel = option.label.trim().toLowerCase();

  return (
    normalizedValue === "" ||
    normalizedValue === "all" ||
    normalizedLabel === "all" ||
    normalizedLabel === "please select"
  );
}

export function sortFilterSelectOptions(options: SearchFilterSelectOption[]) {
  const pinned = options.filter(isPinnedFilterSelectOption);
  const rest = options
    .filter((option) => !isPinnedFilterSelectOption(option))
    .sort((left, right) =>
      left.label.localeCompare(right.label, undefined, { sensitivity: "base", numeric: true })
    );

  return [...pinned, ...rest];
}

export const SEARCH_FILTER_PANEL_CLASS =
  "rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900/70";

export const SEARCH_FILTER_GRID_CLASS = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5";

export const SEARCH_FILTER_CONTROL_CLASS = "min-h-11";

export const FILTER_DROPDOWN_MAX_VISIBLE_ITEMS = 6;

export const FILTER_DROPDOWN_ITEM_CLASS = "min-h-11";

export const FILTER_DROPDOWN_SCROLL_CLASS = "max-h-[calc(2.75rem*6)] overflow-y-auto overscroll-contain";

export const SEARCH_FILTER_DATE_RANGE_CLASS = "w-full min-w-0 [&>button]:min-h-11";
export function SearchFilterPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn(SEARCH_FILTER_PANEL_CLASS, className)}>{children}</div>;
}

export function SearchFilterGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn(SEARCH_FILTER_GRID_CLASS, className)}>{children}</div>;
}

export function SearchFilterField({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("min-w-0", className)}>{children}</div>;
}

export function SearchFilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchFilterSelectOption[];
  className?: string;
}) {
  const sortedOptions = useMemo(() => sortFilterSelectOptions(options), [options]);
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const selectedLabel = useMemo(
    () => sortedOptions.find((option) => option.value === value)?.label ?? "",
    [sortedOptions, value]
  );

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
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open]);

  return (
    <SearchFilterField className={className}>
      <FieldLabel htmlFor={id} label={label} />
      <div ref={rootRef} className="relative">
        <button
          id={id}
          ref={triggerRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left text-sm text-slate-800 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25",
            SEARCH_FILTER_CONTROL_CLASS
          )}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronDown
            size={16}
            className={cn("shrink-0 text-slate-400 transition", open && "rotate-180")}
          />
        </button>

        {open && menuPosition && typeof document !== "undefined"
          ? createPortal(
              <div
                ref={menuRef}
                role="listbox"
                aria-labelledby={id}
                style={{
                  position: "fixed",
                  top: menuPosition.top,
                  left: menuPosition.left,
                  width: menuPosition.width,
                }}
                className="z-[100] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-900"
              >
                <div
                  className={cn(
                    "py-1",
                    sortedOptions.length > FILTER_DROPDOWN_MAX_VISIBLE_ITEMS && FILTER_DROPDOWN_SCROLL_CLASS
                  )}
                >
                  {sortedOptions.map((option) => {
                    const isSelected = option.value === value;

                    return (
                      <button
                        key={option.value || "empty"}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          onChange(option.value);
                          setOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center px-3 py-2.5 text-left text-sm text-slate-800 transition hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800/70",
                          FILTER_DROPDOWN_ITEM_CLASS,
                          isSelected && "bg-blue-50 font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                        )}
                      >
                        <span className="truncate">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>,
              document.body
            )
          : null}
      </div>
    </SearchFilterField>
  );
}

export function SearchFilterActions({
  children,
  onSearch,
  onClear,
  className,
  searchButtonProps,
  clearButtonProps,
}: {
  children?: ReactNode;
  onSearch?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
  onClear?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
  className?: string;
  searchButtonProps?: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "type">;
  clearButtonProps?: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "type">;
}) {
  return (
    <div className={cn("mt-4 flex flex-wrap items-center justify-end gap-3", className)}>
      {children}
      <SearchButton type="button" onClick={onSearch} {...searchButtonProps} />
      <ClearButton type="button" onClick={onClear} {...clearButtonProps} />
    </div>
  );
}
