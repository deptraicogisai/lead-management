"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Checkbox } from "@/components/ui/form-controls";
import {
  FILTER_DROPDOWN_ITEM_CLASS,
  FILTER_DROPDOWN_MAX_VISIBLE_ITEMS,
  FILTER_DROPDOWN_SCROLL_CLASS,
} from "@/components/ui/search-filter-layout";
import { cn } from "@/lib/utils";
import { CONTROL_HINT_CLASS, CONTROL_MUTED_CLASS, CONTROL_TEXT_CLASS } from "@/lib/control-contrast";

export type SearchableMultiSelectOption = {
  id: string;
  label: string;
  description?: string;
  displayId?: number;
};

type SearchableMultiSelectProps = {
  id?: string;
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  options: SearchableMultiSelectOption[];
  labelOptions?: SearchableMultiSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
  /** When false, selected chips show only `label` (e.g. campaign name). Default true. */
  showSelectedDisplayId?: boolean;
};

type MenuLayout = {
  openUpward: boolean;
  maxHeight?: number;
};

const MENU_GAP = 4;
const VIEWPORT_PADDING = 8;
const SEARCH_HEADER_HEIGHT = 48;
const ESTIMATED_ITEM_HEIGHT = 36;
const ESTIMATED_ITEM_WITH_DESCRIPTION_HEIGHT = 52;
const MAX_VISIBLE_SELECTED_CHIPS = 5;
const SELECTED_CHIPS_SCROLL_CLASS =
  "max-h-[calc(1.75rem*5+0.375rem*4)] overflow-y-auto overscroll-contain pr-0.5";

function formatOptionText(option: SearchableMultiSelectOption, includeDisplayId: boolean) {
  if (includeDisplayId && option.displayId !== undefined) {
    return `[${option.displayId}] ${option.label}`;
  }
  return option.label;
}

export function SearchableMultiSelect({
  id,
  selectedIds,
  onChange,
  options,
  labelOptions,
  placeholder = "Select items...",
  searchPlaceholder = "Search...",
  disabled = false,
  isLoading = false,
  emptyMessage = "No items available.",
  className,
  showSelectedDisplayId = true,
}: SearchableMultiSelectProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [menuLayout, setMenuLayout] = useState<MenuLayout | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const labelOptionMap = useMemo(
    () => new Map((labelOptions ?? options).map((option) => [option.id, option])),
    [labelOptions, options]
  );

  const selectedOptions = useMemo(
    () =>
      selectedIds
        .map((selectedId) => labelOptionMap.get(selectedId))
        .filter((option): option is SearchableMultiSelectOption => Boolean(option)),
    [labelOptionMap, selectedIds]
  );

  const filteredOptions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;

    return options.filter((option) => {
      const haystack = `${option.displayId ?? ""} ${option.label} ${option.description ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [options, search]);

  const listNeedsScroll = filteredOptions.length > FILTER_DROPDOWN_MAX_VISIBLE_ITEMS;
  const estimatedItemHeight = useMemo(
    () =>
      filteredOptions.some((option) => Boolean(option.description))
        ? ESTIMATED_ITEM_WITH_DESCRIPTION_HEIGHT
        : ESTIMATED_ITEM_HEIGHT,
    [filteredOptions]
  );

  useEffect(() => {
    if (!dropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setDropdownOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  useEffect(() => {
    if (!dropdownOpen) {
      setMenuLayout(null);
      return;
    }

    const updateMenuLayout = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom - VIEWPORT_PADDING;
      const spaceAbove = rect.top - VIEWPORT_PADDING;
      const visibleCount = listNeedsScroll
        ? FILTER_DROPDOWN_MAX_VISIBLE_ITEMS
        : Math.max(filteredOptions.length, 1);
      const preferredListHeight = visibleCount * estimatedItemHeight + SEARCH_HEADER_HEIGHT + 8;
      const openUpward = spaceBelow < preferredListHeight && spaceAbove > spaceBelow;
      const availableSpace = (openUpward ? spaceAbove : spaceBelow) - MENU_GAP;
      const fitsInViewport = preferredListHeight <= availableSpace;
      const maxHeight =
        listNeedsScroll || !fitsInViewport
          ? Math.min(preferredListHeight, Math.max(listNeedsScroll ? 160 : 96, availableSpace))
          : undefined;

      setMenuLayout({ openUpward, maxHeight });
    };

    updateMenuLayout();
    window.addEventListener("resize", updateMenuLayout);
    window.addEventListener("scroll", updateMenuLayout, true);

    return () => {
      window.removeEventListener("resize", updateMenuLayout);
      window.removeEventListener("scroll", updateMenuLayout, true);
    };
  }, [dropdownOpen, filteredOptions.length, estimatedItemHeight, listNeedsScroll]);

  const toggleOption = (optionId: string, checked: boolean) => {
    if (checked) {
      onChange(selectedIds.includes(optionId) ? selectedIds : [...selectedIds, optionId]);
      return;
    }
    onChange(selectedIds.filter((id) => id !== optionId));
  };

  const removeOption = (optionId: string) => {
    onChange(selectedIds.filter((id) => id !== optionId));
  };

  return (
    <div ref={rootRef} className={cn("relative", dropdownOpen && "z-[400]", className)}>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        disabled={disabled || isLoading}
        onClick={() => setDropdownOpen((open) => !open)}
        className={cn(
          "flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-sm dark:border-slate-500 dark:bg-slate-800",
          CONTROL_TEXT_CLASS,
          dropdownOpen && "border-blue-400 ring-2 ring-blue-100 dark:border-blue-400 dark:ring-blue-400/25",
          (disabled || isLoading) && "cursor-not-allowed opacity-60"
        )}
      >
        <span
          className={cn(
            "flex min-w-0 flex-1 flex-wrap items-center gap-1.5",
            selectedOptions.length > MAX_VISIBLE_SELECTED_CHIPS && SELECTED_CHIPS_SCROLL_CLASS
          )}
        >
          {isLoading ? (
            <span className={CONTROL_MUTED_CLASS}>Loading...</span>
          ) : selectedOptions.length === 0 ? (
            <span className={CONTROL_MUTED_CLASS}>{placeholder}</span>
          ) : (
            selectedOptions.map((option) => (
              <span
                key={option.id}
                className="inline-flex max-w-full items-center gap-1 rounded-md border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-500 dark:bg-slate-900 dark:text-slate-100"
              >
                <span className="break-words whitespace-normal">
                  {formatOptionText(option, showSelectedDisplayId)}
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeOption(option.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      removeOption(option.id);
                    }
                  }}
                  className={cn(
                    "shrink-0 rounded p-0.5 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100",
                    CONTROL_MUTED_CLASS
                  )}
                  aria-label={`Remove ${option.label}`}
                >
                  <X size={12} />
                </span>
              </span>
            ))
          )}
        </span>
        <ChevronDown
          size={16}
          className={cn("shrink-0 transition", CONTROL_MUTED_CLASS, dropdownOpen && "rotate-180")}
        />
      </button>

      {dropdownOpen && menuLayout ? (
        <div
          style={menuLayout.maxHeight ? { maxHeight: menuLayout.maxHeight } : undefined}
          className={cn(
            "absolute left-0 right-0 z-[400] flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-900",
            menuLayout.openUpward ? "bottom-[calc(100%+4px)]" : "top-[calc(100%+4px)]"
          )}
        >
          <div className="shrink-0 border-b border-slate-200 p-2 dark:border-slate-700">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-50 dark:placeholder:text-slate-300 dark:focus:border-blue-400 dark:focus:ring-blue-400/25"
            />
          </div>

          <div
            className={cn(
              "py-1",
              (listNeedsScroll || Boolean(menuLayout.maxHeight)) &&
                cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", listNeedsScroll && FILTER_DROPDOWN_SCROLL_CLASS)
            )}
          >
            {filteredOptions.length === 0 ? (
              <p className={cn("px-3 py-2 text-sm", CONTROL_MUTED_CLASS)}>{emptyMessage}</p>
            ) : (
              filteredOptions.map((option) => {
                const checked = selectedIds.includes(option.id);
                return (
                  <Checkbox
                    key={option.id}
                    id={`${id ?? "multi-select"}-${option.id}`}
                    checked={checked}
                    onChange={(nextChecked) => toggleOption(option.id, nextChecked)}
                    className={cn(
                      "rounded-none px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/70",
                      FILTER_DROPDOWN_ITEM_CLASS
                    )}
                    label={
                      option.description ? (
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-sm text-slate-800 dark:text-slate-100">
                            {formatOptionText(option, true)}
                          </span>
                          <span className={cn("truncate text-xs", CONTROL_HINT_CLASS)}>
                            {option.description}
                          </span>
                        </span>
                      ) : (
                        <span className="truncate text-sm text-slate-800 dark:text-slate-100">
                          {formatOptionText(option, true)}
                        </span>
                      )
                    }
                  />
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
