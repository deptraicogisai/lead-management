import type { CampaignType } from "@/lib/campaign";

/** Delay Scheduling options for Silent campaigns only. */
export const CAMPAIGN_DELAY_SCHEDULING_OPTIONS = [
  "Off",
  "1 minute",
  "3 minutes",
  "6 minutes",
  "10 minutes",
  "30 minutes",
  "1 hour",
  "2 hours",
  "6 hours",
  "1 day",
  "2 days",
  "3 days",
] as const;

export type CampaignDelayScheduling = (typeof CAMPAIGN_DELAY_SCHEDULING_OPTIONS)[number];

export const DEFAULT_CAMPAIGN_DELAY_SCHEDULING: CampaignDelayScheduling = "Off";

const DELAY_MS_BY_OPTION: Record<Exclude<CampaignDelayScheduling, "Off">, number> = {
  "1 minute": 60_000,
  "3 minutes": 3 * 60_000,
  "6 minutes": 6 * 60_000,
  "10 minutes": 10 * 60_000,
  "30 minutes": 30 * 60_000,
  "1 hour": 60 * 60_000,
  "2 hours": 2 * 60 * 60_000,
  "6 hours": 6 * 60 * 60_000,
  "1 day": 24 * 60 * 60_000,
  "2 days": 2 * 24 * 60 * 60_000,
  "3 days": 3 * 24 * 60 * 60_000,
};

export function isCampaignDelayScheduling(value: unknown): value is CampaignDelayScheduling {
  return (
    typeof value === "string" &&
    (CAMPAIGN_DELAY_SCHEDULING_OPTIONS as readonly string[]).includes(value)
  );
}

export function normalizeCampaignDelayScheduling(value: unknown): CampaignDelayScheduling {
  return isCampaignDelayScheduling(value) ? value : DEFAULT_CAMPAIGN_DELAY_SCHEDULING;
}

/** Delay in ms for Silent campaigns. Off / Redirect → 0 (post immediately). */
export function resolveCampaignDelayMs(
  delayScheduling: unknown,
  campaignType: CampaignType | string | null | undefined
): number {
  if (campaignType !== "Silent") return 0;
  const normalized = normalizeCampaignDelayScheduling(delayScheduling);
  if (normalized === "Off") return 0;
  return DELAY_MS_BY_OPTION[normalized] ?? 0;
}

export function computeDelayedPostAt(from: Date, delayMs: number): Date {
  return new Date(from.getTime() + delayMs);
}
