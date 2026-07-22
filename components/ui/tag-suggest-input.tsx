"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Hash, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/form-controls";
import {
  filterPublisherTagSuggestions,
  normalizePublisherTag,
  shouldShowPublisherTagSuggestions,
} from "@/lib/publisher-tag";
import { cn } from "@/lib/utils";

type TagSuggestInputProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

function renderTagMatch(tag: string, query: string): ReactNode {
  const normalizedQuery = normalizePublisherTag(query);
  const lowerTag = tag.toLowerCase();
  const lowerQuery = normalizedQuery.toLowerCase();
  const matchIndex = lowerTag.indexOf(lowerQuery);

  if (!normalizedQuery || matchIndex === -1) {
    return tag;
  }

  const before = tag.slice(0, matchIndex);
  const match = tag.slice(matchIndex, matchIndex + normalizedQuery.length);
  const after = tag.slice(matchIndex + normalizedQuery.length);

  return (
    <>
      {before}
      <span className="font-semibold text-emerald-700 dark:text-emerald-300">{match}</span>
      {after}
    </>
  );
}

export function TagSuggestInput({
  id,
  value,
  onChange,
  suggestions,
  placeholder = "Type a tag",
  disabled = false,
  className,
}: TagSuggestInputProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  const canSuggest = shouldShowPublisherTagSuggestions(value);

  const filteredSuggestions = useMemo(
    () => filterPublisherTagSuggestions(suggestions, value),
    [suggestions, value]
  );

  const showDropdown = focused && open && canSuggest && filteredSuggestions.length > 0;

  const updateMenuPosition = () => {
    const input = inputRef.current;
    if (!input) return;

    const rect = input.getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
    });
  };

  useEffect(() => {
    if (!showDropdown) {
      setMenuPosition(null);
      return;
    }

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [showDropdown, value, filteredSuggestions.length]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
      setFocused(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectSuggestion = (tag: string) => {
    onChange(tag);
    setOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightIndex((current) => (current + 1) % filteredSuggestions.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightIndex(
        (current) => (current - 1 + filteredSuggestions.length) % filteredSuggestions.length
      );
      return;
    }

    if (event.key === "Enter") {
      const selected = filteredSuggestions[highlightIndex];
      if (selected) {
        event.preventDefault();
        selectSuggestion(selected);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative min-w-0">
      <Input
        ref={inputRef}
        id={id}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className={className}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setHighlightIndex(0);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          setFocused(true);
          setOpen(true);
          setHighlightIndex(0);
        }}
        onBlur={() => {
          window.setTimeout(() => {
            if (!menuRef.current?.contains(document.activeElement)) {
              setFocused(false);
              setOpen(false);
            }
          }, 120);
        }}
      />

      {showDropdown && menuPosition && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              style={{
                position: "fixed",
                top: menuPosition.top,
                left: menuPosition.left,
                width: menuPosition.width,
              }}
              className="z-[120] overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xl shadow-slate-300/25 ring-1 ring-slate-900/5 dark:border-slate-600 dark:bg-slate-900 dark:shadow-black/40 dark:ring-white/10"
            >
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/90 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/80">
                <Sparkles size={14} className="text-emerald-600 dark:text-emerald-400" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                  Matching tags
                </span>
                <span className="ml-auto rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  {filteredSuggestions.length}
                </span>
              </div>

              <div className="max-h-52 overflow-y-auto p-1.5">
                {filteredSuggestions.map((tag, index) => {
                  const isActive = index === highlightIndex;

                  return (
                    <button
                      key={tag}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        selectSuggestion(tag);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition",
                        isActive
                          ? "bg-emerald-50 text-slate-900 ring-1 ring-emerald-200/80 dark:bg-emerald-500/15 dark:text-slate-100 dark:ring-emerald-500/30"
                          : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/80"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
                          isActive
                            ? "border-emerald-200 bg-white text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                            : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-300"
                        )}
                      >
                        <Hash size={14} />
                      </span>
                      <span className="min-w-0 truncate font-medium">{renderTagMatch(tag, value)}</span>
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
