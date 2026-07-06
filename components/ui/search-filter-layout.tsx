"use client";

import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { ClearButton, SearchButton } from "@/components/ui/action-buttons";
import { FieldLabel, Select } from "@/components/ui/form-controls";
import { cn } from "@/lib/utils";

export const SEARCH_FILTER_PANEL_CLASS =
  "rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900/70";

export const SEARCH_FILTER_GRID_CLASS = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5";

export const SEARCH_FILTER_CONTROL_CLASS = "min-h-11";

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
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <SearchFilterField className={className}>
      <FieldLabel htmlFor={id} label={label} />
      <Select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={SEARCH_FILTER_CONTROL_CLASS}
      >
        {options.map((option) => (
          <option key={option.value || "empty"} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
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
