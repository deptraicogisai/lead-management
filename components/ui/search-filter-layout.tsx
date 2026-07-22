"use client";

import { type ButtonHTMLAttributes, type ReactNode, useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { ClearButton, SearchButton } from "@/components/ui/action-buttons";
import { DropdownSelect } from "@/components/ui/dropdown-select";
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
  "rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5 dark:border-slate-700 dark:bg-slate-900/70";

export const SEARCH_FILTER_GRID_CLASS =
  "search-filter-grid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5";

export const SEARCH_FILTER_CONTROL_CLASS = "min-h-11";

export const FILTER_DROPDOWN_MAX_VISIBLE_ITEMS = 5;

export const FILTER_DROPDOWN_ITEM_CLASS = "min-h-9";

export const FILTER_DROPDOWN_SCROLL_CLASS = "max-h-[calc(2.25rem*5)] overflow-y-auto overscroll-contain";

export const SEARCH_FILTER_DATE_RANGE_CLASS = "w-full min-w-0 [&>button]:min-h-11";

export function SearchFilterPanel({
  children,
  className,
  /** On phones, start collapsed so the table is visible sooner. */
  collapseOnMobile = true,
}: {
  children: ReactNode;
  className?: string;
  collapseOnMobile?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!collapseOnMobile) {
      setExpanded(true);
      return;
    }

    const media = window.matchMedia("(max-width: 639px)");
    const sync = () => setExpanded(!media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [collapseOnMobile]);

  return (
    <div className={cn(SEARCH_FILTER_PANEL_CLASS, className)}>
      {collapseOnMobile ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="mb-3 flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 sm:hidden dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
          aria-expanded={expanded}
        >
          <span>Filters</span>
          <ChevronDown
            size={18}
            className={cn("shrink-0 text-slate-500 transition-transform dark:text-slate-300", expanded && "rotate-180")}
          />
        </button>
      ) : null}

      <div
        className={cn(
          collapseOnMobile && !expanded && "max-sm:hidden"
        )}
      >
        {children}
      </div>
    </div>
  );
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

  return (
    <SearchFilterField className={className}>
      <FieldLabel htmlFor={id} label={label} />
      <DropdownSelect
        id={id}
        value={value}
        options={sortedOptions}
        onChange={onChange}
        className={SEARCH_FILTER_CONTROL_CLASS}
      />
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
    <div
      className={cn(
        "mobile-filter-actions mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3",
        className
      )}
    >
      {children}
      <SearchButton type="button" onClick={onSearch} {...searchButtonProps} />
      <ClearButton type="button" onClick={onClear} {...clearButtonProps} />
    </div>
  );
}
