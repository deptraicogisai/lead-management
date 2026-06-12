"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type LoadingIndicatorProps = {
  message?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const iconSizes = {
  sm: "h-5 w-5",
  md: "h-8 w-8",
  lg: "h-10 w-10",
} as const;

type SpinnerIconProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function SpinnerIcon({ size = "md", className }: SpinnerIconProps) {
  return (
    <div className={cn("relative flex shrink-0 items-center justify-center", iconSizes[size], className)}>
      <span className="absolute inset-0 animate-ping rounded-full bg-blue-400/20 dark:bg-blue-400/15" />
      <Loader2 className={cn("relative h-full w-full animate-spin text-blue-600 dark:text-blue-400")} />
    </div>
  );
}

export function LoadingIndicator({ message, size = "md", className }: LoadingIndicatorProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-3", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <SpinnerIcon size={size} />
      {message ? <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{message}</p> : null}
      <span className="sr-only">{message ?? "Loading"}</span>
    </div>
  );
}

type LoadingOverlayProps = {
  message?: string;
};

export function LoadingOverlay({ message = "Loading data..." }: LoadingOverlayProps) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/75 backdrop-blur-[2px] dark:bg-slate-900/75">
      <LoadingIndicator message={message} size="md" />
    </div>
  );
}
