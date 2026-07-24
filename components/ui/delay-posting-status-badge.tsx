"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  formatDelayPostingCountdown,
  getDelayPostingRemainingMs,
  isDelayPostingStatus,
} from "@/lib/delay-posting-countdown";
import { cn } from "@/lib/utils";

type DelayPostingStatusBadgeProps = {
  status: string;
  scheduledPostAt?: string | null;
  /** Fired once when countdown reaches Due (so parent can refresh). */
  onDue?: () => void;
  className?: string;
};

export function DelayPostingStatusBadge({
  status,
  scheduledPostAt,
  onDue,
  className,
}: DelayPostingStatusBadgeProps) {
  const showCountdown = isDelayPostingStatus(status) && Boolean(scheduledPostAt);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [dueNotified, setDueNotified] = useState(false);

  useEffect(() => {
    if (!showCountdown) return;

    setNowMs(Date.now());
    setDueNotified(false);

    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1_000);

    return () => window.clearInterval(timer);
  }, [showCountdown, scheduledPostAt]);

  useEffect(() => {
    if (!showCountdown || !onDue || dueNotified) return;
    const remaining = getDelayPostingRemainingMs(scheduledPostAt, new Date(nowMs));
    if (remaining != null && remaining <= 0) {
      setDueNotified(true);
      onDue();
    }
  }, [showCountdown, scheduledPostAt, nowMs, onDue, dueNotified]);

  if (!status.trim() || status.trim() === "—") {
    return <span className="text-slate-500 dark:text-slate-300">—</span>;
  }

  const countdown = showCountdown
    ? formatDelayPostingCountdown(scheduledPostAt, new Date(nowMs))
    : null;

  return (
    <span className={cn("inline-flex max-w-full flex-wrap items-center gap-1.5", className)}>
      <StatusBadge status={status} />
      {countdown ? (
        <span
          title={
            scheduledPostAt
              ? `Scheduled post at ${new Date(scheduledPostAt).toLocaleString()}`
              : undefined
          }
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums leading-none",
            countdown === "Due"
              ? "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-200"
              : "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200"
          )}
        >
          {countdown === "Due" ? "Due" : `in ${countdown}`}
        </span>
      ) : null}
    </span>
  );
}
