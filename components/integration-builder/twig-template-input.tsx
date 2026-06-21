"use client";

import { useMemo, useRef, useState, type InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/form-controls";
import {
  buildTwigTemplateSuggestions,
  filterTwigTemplateSuggestions,
  getTwigTemplateSuggestionQuery,
  shouldShowTwigTemplateSuggestions,
  type ArrayMappingTemplateSlug,
  type BuildTwigTemplateSuggestionsOptions,
  type IntegrationConfigTemplateField,
  type TwigTemplateSuggestion,
} from "@/lib/twig-template";
import { cn } from "@/lib/utils";

type TwigTemplateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  leadFieldNames: string[];
  integrationConfigFields?: IntegrationConfigTemplateField[];
  arrayMappingSlugs?: ArrayMappingTemplateSlug[];
  includeResponseSuggestions?: boolean;
};

const GROUP_LABELS: Record<TwigTemplateSuggestion["group"], string> = {
  "lead-system": "Lead (system)",
  "lead-payload": "Lead (payload)",
  "config-field": "Integration Config",
  "mapped-slug": "Array Mapping",
  "response-field": "Response",
  "campaign": "Campaign",
};

export function TwigTemplateInput({
  value,
  onChange,
  leadFieldNames,
  integrationConfigFields = [],
  arrayMappingSlugs = [],
  includeResponseSuggestions = false,
  className,
  placeholder,
  ...inputProps
}: TwigTemplateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [cursor, setCursor] = useState(0);
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const allSuggestions = useMemo(
    () =>
      buildTwigTemplateSuggestions(leadFieldNames, integrationConfigFields, arrayMappingSlugs, {
        includeResponse: includeResponseSuggestions,
      } satisfies BuildTwigTemplateSuggestionsOptions),
    [leadFieldNames, integrationConfigFields, arrayMappingSlugs, includeResponseSuggestions]
  );

  const suggestionQuery = useMemo(
    () => getTwigTemplateSuggestionQuery(value, cursor),
    [value, cursor]
  );

  const canSuggest = useMemo(
    () => focused && shouldShowTwigTemplateSuggestions(value, cursor),
    [focused, value, cursor]
  );

  const filteredSuggestions = useMemo(() => {
    if (!canSuggest) return [];

    const partial = suggestionQuery?.partial ?? "";
    return filterTwigTemplateSuggestions(allSuggestions, partial).slice(0, 16);
  }, [canSuggest, suggestionQuery, allSuggestions]);

  const showDropdown = open && canSuggest && filteredSuggestions.length > 0;

  const usesTemplateSyntax = value.includes("{{");

  const syncCursor = () => {
    const position = inputRef.current?.selectionStart ?? value.length;
    setCursor(position);
  };

  const insertToken = (token: string) => {
    const query = getTwigTemplateSuggestionQuery(value, cursor);
    if (!query) {
      onChange(token);
      return;
    }

    const nextValue = `${value.slice(0, query.replaceStart)}${token}${value.slice(query.replaceEnd)}`;
    onChange(nextValue);
    setOpen(false);

    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      const nextCursor = query.replaceStart + token.length;
      input.focus();
      input.setSelectionRange(nextCursor, nextCursor);
      setCursor(nextCursor);
    });
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
      setHighlightIndex((current) => (current - 1 + filteredSuggestions.length) % filteredSuggestions.length);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const selected = filteredSuggestions[highlightIndex];
      if (selected) insertToken(selected.token);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className="relative min-w-0">
      <Input
        {...inputProps}
        ref={inputRef}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          const nextCursor = event.target.selectionStart ?? event.target.value.length;
          setCursor(nextCursor);
          setOpen(true);
          setHighlightIndex(0);
        }}
        onKeyDown={(event) => {
          handleKeyDown(event);
          inputProps.onKeyDown?.(event);
        }}
        onKeyUp={(event) => {
          syncCursor();
          inputProps.onKeyUp?.(event);
        }}
        onClick={(event) => {
          syncCursor();
          inputProps.onClick?.(event);
        }}
        onFocus={(event) => {
          syncCursor();
          setFocused(true);
          setOpen(true);
          setHighlightIndex(0);
          inputProps.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          window.setTimeout(() => setOpen(false), 120);
          inputProps.onBlur?.(event);
        }}
        placeholder={placeholder}
        className={cn(usesTemplateSyntax && "font-mono text-[13px]", className)}
        spellCheck={false}
        autoComplete="off"
      />

      {showDropdown && suggestionQuery ? (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-900"
        >
          {filteredSuggestions.map((suggestion, index) => {
            const isActive = index === highlightIndex;

            return (
              <button
                key={suggestion.token}
                type="button"
                role="option"
                aria-selected={isActive}
                onMouseDown={(event) => {
                  event.preventDefault();
                  insertToken(suggestion.token);
                }}
                className={cn(
                  "flex w-full flex-col gap-0.5 px-3 py-2 text-left transition",
                  isActive ? "bg-blue-50 dark:bg-blue-500/15" : "hover:bg-slate-50 dark:hover:bg-slate-800"
                )}
              >
                <span className="font-mono text-xs text-slate-800 dark:text-slate-100">{suggestion.token}</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {GROUP_LABELS[suggestion.group]} · {suggestion.description}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
