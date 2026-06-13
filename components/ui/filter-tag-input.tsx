"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type FilterTagInputProps = {
  id?: string;
  values: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  blockedValues?: string[];
};

function normalizeTag(value: string) {
  return value.trim();
}

export function FilterTagInput({
  id,
  values,
  onChange,
  disabled = false,
  placeholder = "Type a value and press Enter",
  className,
  blockedValues = [],
}: FilterTagInputProps) {
  const [draft, setDraft] = useState("");

  const addTag = (raw: string) => {
    const next = normalizeTag(raw);
    if (!next) return;

    const exists = values.some((value) => value.toLowerCase() === next.toLowerCase());
    if (exists) {
      setDraft("");
      return;
    }

    const blocked = blockedValues.some((value) => value.toLowerCase() === next.toLowerCase());
    if (blocked) {
      setDraft("");
      return;
    }

    onChange([...values, next]);
    setDraft("");
  };

  const removeTag = (tag: string) => {
    onChange(values.filter((value) => value !== tag));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addTag(draft);
      return;
    }

    if (event.key === "Backspace" && !draft && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };

  return (
    <div
      className={cn(
        "flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-600 dark:bg-slate-800",
        disabled && "cursor-not-allowed opacity-60",
        className
      )}
    >
      {values.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200"
        >
          {tag}
          {!disabled ? (
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="rounded p-0.5 hover:bg-emerald-200/80 dark:hover:bg-emerald-500/30"
              aria-label={`Remove ${tag}`}
            >
              <X size={12} />
            </button>
          ) : null}
        </span>
      ))}

      <input
        id={id}
        type="text"
        value={draft}
        disabled={disabled}
        placeholder={values.length === 0 ? placeholder : "Add another..."}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (draft.trim()) addTag(draft);
        }}
        className="min-w-[8rem] flex-1 border-0 bg-transparent px-1 py-1 text-sm text-slate-800 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed dark:text-slate-100 dark:placeholder:text-slate-500"
      />
    </div>
  );
}

export function FilterTagBadges({ values, className }: { values: string[]; className?: string }) {
  if (values.length === 0) return null;

  return (
    <div className={cn("mt-1.5 flex flex-wrap gap-1.5", className)}>
      {values.map((tag) => (
        <span
          key={tag}
          className="inline-flex rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}
