"use client";

import {
  SearchableMultiSelect,
  type SearchableMultiSelectOption,
} from "@/components/ui/searchable-multi-select";

/** Width sized so ~4 selected chips fit on one row. */
export const COPY_TARGET_SELECT_CLASS_NAME = "w-full max-w-2xl min-w-0";

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
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
      <label className="shrink-0 whitespace-nowrap pt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
        {title}
      </label>
      <div className={`${COPY_TARGET_SELECT_CLASS_NAME} space-y-1.5`}>
        <SearchableMultiSelect
          selectedIds={selectedIds}
          onChange={onSelectedIdsChange}
          options={options}
          placeholder={placeholder}
          searchPlaceholder={searchPlaceholder}
          isLoading={isLoading}
          emptyMessage={emptyMessage}
          showSelectedDisplayId={false}
        />
        {description ? (
          <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">{description}</p>
        ) : null}
      </div>
    </div>
  );
}
