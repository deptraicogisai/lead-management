/**
 * Shared IANA timezone catalog for US-market display and schedule evaluation.
 * Persist the `id` (IANA name). Use `label` only in UI selects.
 */

export type AppTimeZoneId =
  | "America/New_York"
  | "America/Chicago"
  | "America/Denver"
  | "America/Phoenix"
  | "America/Los_Angeles"
  | "America/Anchorage"
  | "Pacific/Honolulu"
  | "America/Puerto_Rico"
  | "UTC";

export type AppTimeZoneOption = {
  id: AppTimeZoneId;
  /** Full select label with abbreviation + UTC offset. */
  label: string;
  /** Compact label for headers / dense UI. */
  shortLabel: string;
};

export const DEFAULT_APP_TIME_ZONE: AppTimeZoneId = "America/New_York";

export const APP_TIME_ZONE_OPTIONS: AppTimeZoneOption[] = [
  {
    id: "America/New_York",
    label: "America/New_York (EST/EDT, UTC-5/UTC-4)",
    shortLabel: "America/New_York (EST/EDT)",
  },
  {
    id: "America/Chicago",
    label: "America/Chicago (CST/CDT, UTC-6/UTC-5)",
    shortLabel: "America/Chicago (CST/CDT)",
  },
  {
    id: "America/Denver",
    label: "America/Denver (MST/MDT, UTC-7/UTC-6)",
    shortLabel: "America/Denver (MST/MDT)",
  },
  {
    id: "America/Phoenix",
    label: "America/Phoenix (MST, UTC-7)",
    shortLabel: "America/Phoenix (MST)",
  },
  {
    id: "America/Los_Angeles",
    label: "America/Los_Angeles (PST/PDT, UTC-8/UTC-7)",
    shortLabel: "America/Los_Angeles (PST/PDT)",
  },
  {
    id: "America/Anchorage",
    label: "America/Anchorage (AKST/AKDT, UTC-9/UTC-8)",
    shortLabel: "America/Anchorage (AKST/AKDT)",
  },
  {
    id: "Pacific/Honolulu",
    label: "Pacific/Honolulu (HST, UTC-10)",
    shortLabel: "Pacific/Honolulu (HST)",
  },
  {
    id: "America/Puerto_Rico",
    label: "America/Puerto_Rico (AST, UTC-4)",
    shortLabel: "America/Puerto_Rico (AST)",
  },
  {
    id: "UTC",
    label: "Etc/UTC (UTC+0)",
    shortLabel: "Etc/UTC",
  },
];

/** Select values = IANA ids (compatible with existing TIMEZONE_OPTIONS usage). */
export const TIMEZONE_OPTIONS = APP_TIME_ZONE_OPTIONS.map((option) => option.id);

export const DEFAULT_CAMPAIGN_TIMEZONE = DEFAULT_APP_TIME_ZONE;

const OPTION_BY_ID = new Map(APP_TIME_ZONE_OPTIONS.map((option) => [option.id, option]));

/** Map legacy UI labels / aliases → IANA id. */
const LEGACY_TIMEZONE_ALIASES: Record<string, string> = {
  "EST/EDT": "America/New_York",
  "New York (EST/EDT)": "America/New_York",
  "America/New_York (EST/EDT, UTC-5/UTC-4)": "America/New_York",
  "America/New_York (EST/EDT)": "America/New_York",
  "Chicago (CST/CDT)": "America/Chicago",
  "America/Chicago (CST/CDT, UTC-6/UTC-5)": "America/Chicago",
  "America/Chicago (CST/CDT)": "America/Chicago",
  "Denver (MST/MDT)": "America/Denver",
  "America/Denver (MST/MDT, UTC-7/UTC-6)": "America/Denver",
  "America/Denver (MST/MDT)": "America/Denver",
  "Phoenix (MST)": "America/Phoenix",
  "America/Phoenix (MST, UTC-7)": "America/Phoenix",
  "America/Phoenix (MST)": "America/Phoenix",
  "Los Angeles (PST/PDT)": "America/Los_Angeles",
  "America/Los_Angeles (PST/PDT, UTC-8/UTC-7)": "America/Los_Angeles",
  "America/Los_Angeles (PST/PDT)": "America/Los_Angeles",
  "America/Anchorage (AKST/AKDT, UTC-9/UTC-8)": "America/Anchorage",
  "America/Anchorage (AKST/AKDT)": "America/Anchorage",
  "Pacific/Honolulu (HST, UTC-10)": "Pacific/Honolulu",
  "Pacific/Honolulu (HST)": "Pacific/Honolulu",
  "America/Puerto_Rico (AST, UTC-4)": "America/Puerto_Rico",
  "America/Puerto_Rico (AST)": "America/Puerto_Rico",
  "Etc/UTC (UTC+0)": "UTC",
  "Etc/UTC": "UTC",
  // Kept for historical campaign/mapping records only (not shown in US picker).
  "Hanoi (ICT)": "Asia/Ho_Chi_Minh",
};

export function isAppTimeZoneId(value: string): value is AppTimeZoneId {
  return OPTION_BY_ID.has(value as AppTimeZoneId);
}

export function resolveAppTimeZone(timezone?: string | null): string {
  const value = timezone?.trim();
  if (!value) return DEFAULT_APP_TIME_ZONE;
  if (isAppTimeZoneId(value)) return value;
  return LEGACY_TIMEZONE_ALIASES[value] ?? value;
}

/** @deprecated Prefer resolveAppTimeZone — kept for campaign imports. */
export function resolveCampaignTimezone(timezone?: string | null) {
  return resolveAppTimeZone(timezone);
}

export function getTimezoneOptionLabel(timezone?: string | null, compact = false) {
  const resolved = resolveAppTimeZone(timezone);
  const option = OPTION_BY_ID.get(resolved as AppTimeZoneId);
  if (!option) return resolved;
  return compact ? option.shortLabel : option.label;
}

/** Resolve to a value that exists in the timezone select (legacy / unknown → default). */
export function resolveSelectableTimeZone(timezone?: string | null): AppTimeZoneId {
  const resolved = resolveAppTimeZone(timezone);
  return isAppTimeZoneId(resolved) ? resolved : DEFAULT_APP_TIME_ZONE;
}

/**
 * Resolve any stored timezone label/id to a real IANA zone for Intl / schedule math.
 */
export function resolveIanaTimeZone(timezone?: string | null): string {
  const resolved = resolveAppTimeZone(timezone);
  if (resolved === "UTC" || resolved === "Etc/UTC") return "UTC";
  if (resolved.includes("/")) return resolved;
  return "UTC";
}
