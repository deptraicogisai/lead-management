/** Remaining time until a Delay Posting scheduledPostAt. */

export function parseScheduledPostAt(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function getDelayPostingRemainingMs(
  scheduledPostAt: string | Date | null | undefined,
  now: Date = new Date()
): number | null {
  const due = parseScheduledPostAt(scheduledPostAt);
  if (!due) return null;
  return due.getTime() - now.getTime();
}

/** Compact countdown label, e.g. `2d 3h`, `45m 12s`, `8s`, `Due`. */
export function formatDelayPostingCountdown(
  scheduledPostAt: string | Date | null | undefined,
  now: Date = new Date()
): string | null {
  const remainingMs = getDelayPostingRemainingMs(scheduledPostAt, now);
  if (remainingMs == null) return null;
  if (remainingMs <= 0) return "Due";

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  return `${seconds}s`;
}

export function isDelayPostingStatus(status: string | null | undefined): boolean {
  return (status ?? "").trim().toLowerCase() === "delay posting";
}
