"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";
import { Checkbox } from "@/components/ui/form-controls";
import { IdBadge } from "@/components/ui/id-badge";
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
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number } | null>(null);
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
  }, [dropdownOpen]);

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
                className="inline-flex max-w-full items-center gap-1 rounded-md border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
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
                left: menuPosition.left,
                width: menuPosition.width,
              }}
              className="z-[100] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-900"
            >
              <div className="border-b border-slate-200 p-2 dark:border-slate-700">
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25"
                />
              </div>

              <div className="max-h-60 overflow-y-auto py-1">
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
                        className="rounded-none px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/70"
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
