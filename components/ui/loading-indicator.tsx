"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export const LOADING_PHASE_FETCHING = "Fetching Data...";
export const LOADING_PHASE_LOADING = "Loading Data...";

const DEFAULT_LOADING_PHASES = [LOADING_PHASE_FETCHING, LOADING_PHASE_LOADING] as const;

export function useStagedLoadingMessage(customMessage?: string, delayMs = 1400) {
  const phases = useMemo(
    () => (customMessage ? [LOADING_PHASE_FETCHING, customMessage] : [...DEFAULT_LOADING_PHASES]),
    [customMessage]
  );
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    setPhaseIndex(0);
    if (phases.length <= 1) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setPhaseIndex(1);
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [phases, delayMs]);

  return phases[Math.min(phaseIndex, phases.length - 1)] ?? LOADING_PHASE_LOADING;
}

type LoadingIndicatorProps = {
  message?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  showDots?: boolean;
  showProgressBar?: boolean;
  stagedMessage?: boolean;
};

const iconSizes = {
  sm: "h-5 w-5",
  md: "h-9 w-9",
  lg: "h-11 w-11",
} as const;

type SpinnerIconProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function SpinnerIcon({ size = "md", className }: SpinnerIconProps) {
  return (
    <div
      className={cn("relative flex shrink-0 items-center justify-center", iconSizes[size], className)}
      role="presentation"
    >
      <span className="absolute inset-0 rounded-full border-2 border-slate-200 dark:border-slate-700" />
      <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-600 border-r-blue-500 animate-loading-spin dark:border-t-emerald-400 dark:border-r-blue-400" />
      <span className="absolute inset-[26%] rounded-full bg-gradient-to-br from-emerald-500/15 to-blue-500/15 animate-loading-pulse-soft" />
    </div>
  );
}

function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      <span className="loading-dot h-1.5 w-1.5 rounded-full bg-emerald-500/80 dark:bg-emerald-400/80" />
      <span className="loading-dot h-1.5 w-1.5 rounded-full bg-blue-500/80 dark:bg-blue-400/80" />
      <span className="loading-dot h-1.5 w-1.5 rounded-full bg-emerald-500/80 dark:bg-emerald-400/80" />
    </span>
  );
}

export function LoadingProgressBar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "loading-progress-track h-2 w-full overflow-hidden rounded-full border border-slate-200/80 bg-slate-100 dark:border-slate-600 dark:bg-slate-800",
        className
      )}
      aria-hidden="true"
    >
      <div className="loading-progress-bar h-full rounded-full" />
    </div>
  );
}

export function LoadingIndicator({
  message,
  size = "md",
  className,
  showDots = true,
  showProgressBar = true,
  stagedMessage = true,
}: LoadingIndicatorProps) {
  const displayMessage = useStagedLoadingMessage(stagedMessage ? message : undefined);
  const resolvedMessage = stagedMessage ? displayMessage : message;

  return (
    <div
      className={cn("flex w-full min-w-[220px] animate-loading-enter flex-col items-center justify-center gap-3", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <SpinnerIcon size={size} />
      {showProgressBar ? <LoadingProgressBar className="max-w-xs" /> : null}
      {resolvedMessage ? (
        <div className="flex w-full flex-col items-center gap-2">
          <p
            key={resolvedMessage}
            className="animate-loading-message text-center text-sm font-semibold tracking-tight text-slate-700 dark:text-slate-200"
          >
            {resolvedMessage}
          </p>
          {showDots ? <LoadingDots /> : null}
        </div>
      ) : null}
      <span className="sr-only">{resolvedMessage ?? "Loading"}</span>
    </div>
  );
}

type InlineLoadingProps = {
  message?: string;
  size?: "sm" | "md";
  className?: string;
  showProgressBar?: boolean;
  stagedMessage?: boolean;
};

export function InlineLoading({
  message,
  size = "md",
  className,
  showProgressBar = true,
  stagedMessage = true,
}: InlineLoadingProps) {
  const displayMessage = useStagedLoadingMessage(stagedMessage ? message : undefined);
  const resolvedMessage = stagedMessage ? displayMessage : message;

  return (
    <div
      className={cn("flex w-full min-w-[240px] animate-loading-enter flex-col gap-2.5", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {showProgressBar ? <LoadingProgressBar /> : null}
      <div className="flex items-center gap-3">
        <SpinnerIcon size={size} />
        {resolvedMessage ? (
          <p
            key={resolvedMessage}
            className="animate-loading-message text-sm font-semibold text-slate-700 dark:text-slate-200"
          >
            {resolvedMessage}
          </p>
        ) : null}
      </div>
      <span className="sr-only">{resolvedMessage ?? "Loading"}</span>
    </div>
  );
}

/**
 * Vertical space that keeps a loader visually centered in the viewport, below the
 * dashboard header/breadcrumb chrome. Used as the default for full-page loaders.
 */
export const PAGE_LOADING_MIN_HEIGHT = "min-h-[calc(100dvh-13rem)]";

type SectionLoadingProps = {
  message?: string;
  minHeightClassName?: string;
  className?: string;
};

export function SectionLoading({
  message,
  minHeightClassName = PAGE_LOADING_MIN_HEIGHT,
  className,
}: SectionLoadingProps) {
  return (
    <div className={cn("flex items-center justify-center px-4 py-10", minHeightClassName, className)}>
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white px-6 py-6 shadow-md dark:border-slate-700 dark:bg-slate-900">
        <LoadingIndicator message={message} size="lg" />
      </div>
    </div>
  );
}

type LoadingOverlayProps = {
  message?: string;
};

export function LoadingOverlay({ message }: LoadingOverlayProps) {
  return (
    <div className="absolute inset-0 z-10 flex animate-loading-enter items-center justify-center rounded-2xl bg-white/85 backdrop-blur-[4px] dark:bg-slate-900/85">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200/90 bg-white px-8 py-7 shadow-xl shadow-slate-900/10 dark:border-slate-700/90 dark:bg-slate-900 dark:shadow-black/30">
        <LoadingIndicator message={message} size="md" />
      </div>
    </div>
  );
}
