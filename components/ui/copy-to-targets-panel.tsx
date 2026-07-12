"use client";

import {
  SearchableMultiSelect,
  type SearchableMultiSelectOption,
} from "@/components/ui/searchable-multi-select";

type CopyToTargetsPanelProps = {
  open: boolean;
  title: string;
  description?: string;
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  options: SearchableMultiSelectOption[];
  isLoading?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
};

export function CopyToTargetsPanel({
  open,
  title,
  description,
  selectedIds,
  onSelectedIdsChange,
  options,
  isLoading = false,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyMessage = "No options available.",
}: CopyToTargetsPanelProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        <label className="shrink-0 whitespace-nowrap pt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          {title}
        </label>
        <div className="min-w-0 w-full flex-1">
          <SearchableMultiSelect
            selectedIds={selectedIds}
            onChange={onSelectedIdsChange}
            options={options}
            placeholder={placeholder}
            searchPlaceholder={searchPlaceholder}
            isLoading={isLoading}
            emptyMessage={emptyMessage}
          />
        </div>
      </div>
      {description ? <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p> : null}
    </div>
  );
}
