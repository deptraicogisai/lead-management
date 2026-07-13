"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";
import { Checkbox } from "@/components/ui/form-controls";
import { IdBadge } from "@/components/ui/id-badge";
import {
  FILTER_DROPDOWN_ITEM_CLASS,
  FILTER_DROPDOWN_MAX_VISIBLE_ITEMS,
  FILTER_DROPDOWN_SCROLL_CLASS,
} from "@/components/ui/search-filter-layout";
import { cn } from "@/lib/utils";

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
};

type MenuPosition = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
};

const MENU_GAP = 4;
const MENU_MIN_WIDTH = 448;
const VIEWPORT_PADDING = 8;
const SEARCH_HEADER_HEIGHT = 52;
const ESTIMATED_ITEM_HEIGHT = 44;

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
}: SearchableMultiSelectProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }

      setDropdownOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!dropdownOpen) {
      setMenuPosition(null);
      return;
    }

    const updateMenuPosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const spaceBelow = viewportHeight - rect.bottom - VIEWPORT_PADDING;
      const spaceAbove = rect.top - VIEWPORT_PADDING;
      const preferredListHeight =
        Math.min(filteredOptions.length, FILTER_DROPDOWN_MAX_VISIBLE_ITEMS) * ESTIMATED_ITEM_HEIGHT +
        SEARCH_HEADER_HEIGHT;
      const openUpward = spaceBelow < preferredListHeight && spaceAbove > spaceBelow;
      const availableSpace = openUpward ? spaceAbove : spaceBelow;
      const maxHeight = Math.max(160, Math.min(preferredListHeight, availableSpace - MENU_GAP));
      const width = Math.min(Math.max(rect.width, MENU_MIN_WIDTH), viewportWidth - VIEWPORT_PADDING * 2);
      const left = Math.min(
        Math.max(VIEWPORT_PADDING, rect.left),
        viewportWidth - width - VIEWPORT_PADDING
      );

      setMenuPosition({
        top: openUpward ? undefined : rect.bottom + MENU_GAP,
        bottom: openUpward ? viewportHeight - rect.top + MENU_GAP : undefined,
        left,
        width,
        maxHeight,
      });
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [dropdownOpen, filteredOptions.length]);

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
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        disabled={disabled || isLoading}
        onClick={() => setDropdownOpen((open) => !open)}
        className={cn(
          "flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-sm dark:border-slate-600 dark:bg-slate-800",
          (disabled || isLoading) && "cursor-not-allowed opacity-60"
        )}
      >
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {isLoading ? (
            <span className="text-slate-400">Loading...</span>
          ) : selectedOptions.length === 0 ? (
            <span className="text-slate-400">{placeholder}</span>
          ) : (
            selectedOptions.map((option) => (
              <span
                key={option.id}
                className="inline-flex max-w-[calc((100%-1.125rem)/4)] items-center gap-1 rounded-md border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              >
                <span className="truncate">
                  {option.displayId !== undefined ? `[${option.displayId}] ${option.label}` : option.label}
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
                  className="rounded p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100"
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
          className={cn("shrink-0 text-slate-400 transition", dropdownOpen && "rotate-180")}
        />
      </button>

      {dropdownOpen && menuPosition && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              style={{
                position: "fixed",
                top: menuPosition.top,
                bottom: menuPosition.bottom,
                left: menuPosition.left,
                width: menuPosition.width,
                maxHeight: menuPosition.maxHeight,
              }}
              className="z-[300] flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-900"
            >
              <div className="shrink-0 border-b border-slate-200 p-2 dark:border-slate-700">
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25"
                />
              </div>

              <div
                className={cn(
                  "min-h-0 flex-1 overflow-y-auto py-1 overscroll-contain",
                  filteredOptions.length > FILTER_DROPDOWN_MAX_VISIBLE_ITEMS && FILTER_DROPDOWN_SCROLL_CLASS
                )}
              >
                {filteredOptions.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</p>
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
                          option.displayId !== undefined || option.description ? (
                            <span className="flex min-w-0 items-start gap-2.5">
                              {option.displayId !== undefined ? <IdBadge id={option.displayId} /> : null}
                              <span className="flex min-w-0 flex-col">
                                <span className="font-medium text-slate-800 dark:text-slate-100">{option.label}</span>
                                {option.description ? (
                                  <span className="text-xs text-slate-500 dark:text-slate-400">{option.description}</span>
                                ) : null}
                              </span>
                            </span>
                          ) : (
                            option.label
                          )
                        }
                      />
                    );
                  })
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
