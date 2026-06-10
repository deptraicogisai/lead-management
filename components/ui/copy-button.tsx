"use client";

import { useState, type MouseEvent } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

type CopyButtonProps = {
  text: string;
  label?: string;
  className?: string;
  iconSize?: number;
};

export function CopyButton({ text, label = "Copy", className, iconSize = 14 }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard may be unavailable in some contexts.
    }
  };

  return (
    <button
      type="button"
      onClick={(event) => void handleCopy(event)}
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied!" : label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-300 p-1.5 text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800",
        copied && "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300",
        className
      )}
    >
      {copied ? <Check size={iconSize} /> : <Copy size={iconSize} />}
    </button>
  );
}

type CopyableValueProps = {
  value: string;
  copyLabel?: string;
  className?: string;
  codeClassName?: string;
};

export function CopyableValue({ value, copyLabel, className, codeClassName }: CopyableValueProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <code className={cn("rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800 dark:text-slate-100", codeClassName)}>
        {value}
      </code>
      <CopyButton text={value} label={copyLabel ?? `Copy ${value}`} />
    </span>
  );
}
