"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/form-controls";
import {
  FILTER_DROPDOWN_ITEM_CLASS,
  FILTER_DROPDOWN_MAX_VISIBLE_ITEMS,
  FILTER_DROPDOWN_SCROLL_CLASS,
} from "@/components/ui/search-filter-layout";
import { toolbarPrimaryButtonClassName } from "@/lib/button-styles";
import { cn } from "@/lib/utils";

export type ColumnVisibilityOption = {
  key: string;
  label: string;
};

type ColumnVisibilitySelectProps = {
  id?: string;
  options: ColumnVisibilityOption[];
  selectedKeys: string[];
  onChange: (selectedKeys: string[]) => void;
  disabled?: boolean;
  className?: string;
};

type StoredColumnVisibility = {
  selectedKeys: string[];
  knownKeys: string[];
};

const STORAGE_PREFIX = "lm:column-visibility:";

function uniqueKeys(keys: string[]) {
  return Array.from(new Set(keys));
}

/** Keep only keys that exist in the current catalog; never return an empty selection. */
export function normalizeVisibleColumnKeys(
  selected: string[] | null | undefined,
  allKeys: string[]
): string[] {
  if (allKeys.length === 0) return [];
  if (!selected?.length) return allKeys;

  const valid = uniqueKeys(selected.filter((key) => allKeys.includes(key)));
  return valid.length > 0 ? valid : allKeys;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/** True when `nextKeys` is a strict subset of `knownKeys` (dynamic columns not loaded yet). */
function isCatalogIncomplete(nextKeys: string[], knownKeys: string[]) {
  if (knownKeys.length === 0 || nextKeys.length === 0) return false;
  const nextSet = new Set(nextKeys);
  const knownSet = new Set(knownKeys);
  const nextIsSubset = nextKeys.every((key) => knownSet.has(key));
  const knownHasMissing = knownKeys.some((key) => !nextSet.has(key));
  return nextIsSubset && knownHasMissing;
}

export function readVisibleColumnKeys(storageKey: string): StoredColumnVisibility | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;

    // Legacy format: string[]
    if (isStringArray(parsed)) {
      const knownKeys = uniqueKeys(parsed);
      if (knownKeys.length === 0) return null;
      return {
        selectedKeys: normalizeVisibleColumnKeys(parsed, knownKeys),
        knownKeys,
      };
    }

    if (
      parsed &&
      typeof parsed === "object" &&
      isStringArray((parsed as StoredColumnVisibility).selectedKeys) &&
      isStringArray((parsed as StoredColumnVisibility).knownKeys)
    ) {
      const stored = parsed as StoredColumnVisibility;
      const knownKeys = uniqueKeys(stored.knownKeys);
      const selectedKeys = normalizeVisibleColumnKeys(stored.selectedKeys, knownKeys);
      return { selectedKeys, knownKeys };
    }

    return null;
  } catch {
    return null;
  }
}

export function writeVisibleColumnKeys(storageKey: string, value: StoredColumnVisibility) {
  if (typeof window === "undefined") return;

  try {
    const knownKeys = uniqueKeys(value.knownKeys);
    const selectedKeys = normalizeVisibleColumnKeys(value.selectedKeys, knownKeys);
    window.localStorage.setItem(
      `${STORAGE_PREFIX}${storageKey}`,
      JSON.stringify({ selectedKeys, knownKeys })
    );
  } catch {
    // Ignore quota / private-mode write failures.
  }
}

/**
 * Green pill control for toggling table column visibility.
 * Trigger label always shows "{n} selected".
 */
export function ColumnVisibilitySelect({
  id = "column-visibility",
  options,
  selectedKeys,
  onChange,
  disabled = false,
  className,
}: ColumnVisibilitySelectProps) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number } | null>(
    null
  );
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const selectedInOrder = useMemo(
    () => options.filter((option) => selectedKeys.includes(option.key)).map((option) => option.key),
    [options, selectedKeys]
  );

  const allSelected = options.length > 0 && selectedInOrder.length === options.length;

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
        left: Math.max(8, rect.right - Math.max(rect.width, 240)),
        width: Math.max(rect.width, 240),
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

  const toggleOption = (key: string, checked: boolean) => {
    if (checked) {
      onChange(selectedKeys.includes(key) ? selectedKeys : [...selectedKeys, key]);
      return;
    }
    onChange(selectedKeys.filter((item) => item !== key));
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        disabled={disabled || options.length === 0}
        onClick={() => setOpen((current) => !current)}
        className={cn(toolbarPrimaryButtonClassName, "w-full sm:w-auto")}
        title="Show or hide columns"
      >
        <span className="whitespace-nowrap">{selectedInOrder.length} selected</span>
        <ChevronDown size={15} className={cn("shrink-0 transition", open && "rotate-180")} />
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
                  onClick={() => onChange(options.map((option) => option.key))}
                  disabled={allSelected}
                  className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => onChange([])}
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
                {options.map((option) => (
                  <Checkbox
                    key={option.key}
                    id={`${id}-${option.key}`}
                    checked={selectedKeys.includes(option.key)}
                    onChange={(checked) => toggleOption(option.key, checked)}
                    className={cn(
                      "rounded-none px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/70",
                      FILTER_DROPDOWN_ITEM_CLASS
                    )}
                    label={option.label}
                  />
                ))}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

/** Keep prior selections; auto-enable columns the user has never seen before. */
export function syncVisibleColumnKeys(
  previousVisible: string[] | null,
  previousAllKeys: string[],
  nextAllKeys: string[]
) {
  if (previousVisible == null) {
    return nextAllKeys;
  }

  const nextSet = new Set(nextAllKeys);
  const kept = previousVisible.filter((key) => nextSet.has(key));

  if (previousAllKeys.length === 0) {
    return kept.length > 0 ? kept : nextAllKeys;
  }

  const previousAllSet = new Set(previousAllKeys);
  const newlyAppeared = nextAllKeys.filter((key) => !previousAllSet.has(key));
  return uniqueKeys([...kept, ...newlyAppeared]);
}

function resolveVisibleKeys(
  selectedKeys: string[] | null,
  knownKeys: string[],
  nextAllKeys: string[]
) {
  if (selectedKeys == null) {
    return nextAllKeys;
  }

  const nextSet = new Set(nextAllKeys);
  const kept = selectedKeys.filter((key) => nextSet.has(key));
  const brandNew = nextAllKeys.filter((key) => !knownKeys.includes(key));
  return uniqueKeys([...kept, ...brandNew]);
}

/**
 * Persists column visibility in localStorage so F5 restores the latest selection.
 */
export function usePersistedVisibleColumnKeys(
  storageKey: string,
  allColumnKeys: string[],
  options?: { ready?: boolean }
) {
  const ready = options?.ready ?? true;
  const sessionSelectedRef = useRef<string[] | null>(null);
  const knownKeysRef = useRef<string[]>([]);
  const [visibleColumnKeys, setVisibleColumnKeysState] = useState<string[] | null>(null);

  useEffect(() => {
    if (!ready || allColumnKeys.length === 0) return;

    const stored = readVisibleColumnKeys(storageKey);
    const priorKnown = uniqueKeys([...(stored?.knownKeys ?? []), ...knownKeysRef.current]);
    const selectedSource = sessionSelectedRef.current ?? stored?.selectedKeys ?? null;
    const nextSelected = resolveVisibleKeys(selectedSource, priorKnown, allColumnKeys);
    const catalogIncomplete = isCatalogIncomplete(allColumnKeys, priorKnown);

    // While dynamic columns are still loading, keep the stored selection intact.
    if (catalogIncomplete) {
      sessionSelectedRef.current = stored?.selectedKeys ?? selectedSource;
      const visibleNow = normalizeVisibleColumnKeys(nextSelected, allColumnKeys);
      setVisibleColumnKeysState(visibleNow);
      return;
    }

    const nextKnown = uniqueKeys([...priorKnown, ...allColumnKeys]);
    const resolvedSelected = normalizeVisibleColumnKeys(nextSelected, allColumnKeys);
    knownKeysRef.current = nextKnown;
    sessionSelectedRef.current = resolvedSelected;
    setVisibleColumnKeysState(resolvedSelected);
    writeVisibleColumnKeys(storageKey, {
      selectedKeys: resolvedSelected,
      knownKeys: nextKnown,
    });
  }, [allColumnKeys, ready, storageKey]);

  const setVisibleColumnKeys = useCallback(
    (keys: string[]) => {
      const stored = readVisibleColumnKeys(storageKey);
      const priorKnown = uniqueKeys([
        ...(stored?.knownKeys ?? []),
        ...knownKeysRef.current,
        ...allColumnKeys,
      ]);

      // Preserve selections for columns not in the current (incomplete) catalog.
      const available = new Set(allColumnKeys);
      const preservedHidden = (stored?.selectedKeys ?? []).filter((key) => !available.has(key));
      const nextSelected = normalizeVisibleColumnKeys(
        uniqueKeys([...keys, ...preservedHidden]),
        uniqueKeys([...allColumnKeys, ...preservedHidden])
      );
      const nextKnown = uniqueKeys([...priorKnown, ...nextSelected]);
      const visibleNow = normalizeVisibleColumnKeys(keys, allColumnKeys);

      knownKeysRef.current = nextKnown;
      sessionSelectedRef.current = nextSelected;
      setVisibleColumnKeysState(visibleNow);
      writeVisibleColumnKeys(storageKey, {
        selectedKeys: nextSelected,
        knownKeys: nextKnown,
      });
    },
    [allColumnKeys, storageKey]
  );

  const effectiveVisibleKeys = useMemo(
    () => normalizeVisibleColumnKeys(visibleColumnKeys, allColumnKeys),
    [allColumnKeys, visibleColumnKeys]
  );

  return {
    visibleColumnKeys,
    setVisibleColumnKeys,
    effectiveVisibleKeys,
  };
}
