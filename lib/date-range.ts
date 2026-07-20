export type DateRangePreset =
  | "today"
  | "yesterday"
  | "this-week"
  | "last-week"
  | "this-month"
  | "last-month"
  | "last-3-months"
  | "last-6-months"
  | "custom";

export type DateRangeStrings = {
  from: string;
  to: string;
};

const PRESET_LABELS: Record<DateRangePreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "this-week": "This Week",
  "last-week": "Last Week",
  "this-month": "This Month",
  "last-month": "Last Month",
  "last-3-months": "Last 3 months",
  "last-6-months": "Last 6 months",
  custom: "Custom Range",
};

export const DATE_RANGE_PRESETS: DateRangePreset[] = [
  "today",
  "yesterday",
  "this-week",
  "last-week",
  "this-month",
  "last-month",
  "last-3-months",
  "last-6-months",
  "custom",
];

export function getDateRangePresetLabel(preset: DateRangePreset) {
  return PRESET_LABELS[preset];
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export function startOfWeek(date: Date) {
  const result = startOfDay(date);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

export function endOfWeek(date: Date) {
  const result = startOfWeek(date);
  result.setDate(result.getDate() + 6);
  return endOfDay(result);
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfMonth(date: Date) {
  return endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

export function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function addMonths(date: Date, months: number) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export function toDateTimeLocalValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function parseDateTimeValue(value: string): Date | null {
  if (!value?.trim()) return null;

  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseWallClockParts(value: string) {
  const match = value
    .trim()
    .match(
      /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?$/
    );
  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
    millisecond: Number((match[7] ?? "0").padEnd(3, "0")),
  };
}

export function hasExplicitTimeZone(value: string) {
  return /(?:Z|[+-]\d{2}:\d{2})$/i.test(value.trim());
}

export function toTimeZoneWallClockDate(value: Date | string, timeZone: string) {
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) return null;

  const parts = getDateTimeParts(instant, timeZone);
  return new Date(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
    instant.getMilliseconds()
  );
}

export type ZonedDateTimeParts = {
  dayLabel: string;
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
};

/** Wall-clock parts of an absolute instant in a target IANA timezone (for schedule matching). */
export function getZonedDateTimeParts(instant: Date, timeZone: string): ZonedDateTimeParts | null {
  if (Number.isNaN(instant.getTime())) return null;

  const lookup = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value])
  );

  // Some runtimes can emit "24" for midnight; normalize to 00.
  let hour = Number(lookup.hour ?? 0);
  if (hour === 24) hour = 0;
  const pad = (value: number) => String(value).padStart(2, "0");

  return {
    dayLabel: lookup.weekday ?? "Mon",
    year: lookup.year ?? "1970",
    month: (lookup.month ?? "01").padStart(2, "0"),
    day: (lookup.day ?? "01").padStart(2, "0"),
    hour: pad(hour),
    minute: (lookup.minute ?? "00").padStart(2, "0"),
    second: (lookup.second ?? "00").padStart(2, "0"),
  };
}

/**
 * Calendar-day bounds for `instant` in `timeZone`.
 * `endExclusive` is the next local midnight (use with `$lt`, not `$lte`).
 */
export function getZonedDayRange(instant: Date, timeZone: string) {
  const parts = getZonedDateTimeParts(instant, timeZone);
  if (!parts) return null;

  const start = zonedDateTimeToUtc(
    `${parts.year}-${parts.month}-${parts.day}T00:00:00.000`,
    timeZone
  );
  if (!start) return null;

  const nextCivilDay = addDays(
    new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day)),
    1
  );
  const pad = (value: number) => String(value).padStart(2, "0");
  const endExclusive = zonedDateTimeToUtc(
    `${nextCivilDay.getFullYear()}-${pad(nextCivilDay.getMonth() + 1)}-${pad(nextCivilDay.getDate())}T00:00:00.000`,
    timeZone
  );
  if (!endExclusive) return null;

  return { start, endExclusive };
}

/** Convert a timezone-local wall clock value to its UTC instant. */
export function zonedDateTimeToUtc(value: Date | string, timeZone: string) {
  const parts =
    typeof value === "string"
      ? parseWallClockParts(value)
      : {
          year: value.getFullYear(),
          month: value.getMonth() + 1,
          day: value.getDate(),
          hour: value.getHours(),
          minute: value.getMinutes(),
          second: value.getSeconds(),
          millisecond: value.getMilliseconds(),
        };
  if (!parts) return null;

  const expectedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond
  );
  let candidate = new Date(expectedAsUtc);

  // Two passes handle DST offset changes around the candidate instant.
  for (let pass = 0; pass < 2; pass += 1) {
    const actualWallClock = toTimeZoneWallClockDate(candidate, timeZone);
    if (!actualWallClock) return null;
    const actualAsUtc = Date.UTC(
      actualWallClock.getFullYear(),
      actualWallClock.getMonth(),
      actualWallClock.getDate(),
      actualWallClock.getHours(),
      actualWallClock.getMinutes(),
      actualWallClock.getSeconds(),
      actualWallClock.getMilliseconds()
    );
    candidate = new Date(candidate.getTime() + expectedAsUtc - actualAsUtc);
  }

  return candidate;
}

export function parseDateTimeInTimeZone(value: string, timeZone: string) {
  if (!value?.trim()) return null;
  if (hasExplicitTimeZone(value)) return parseDateTimeValue(value);
  return zonedDateTimeToUtc(value, timeZone);
}

export function toTimeZoneDateRangeStrings(
  from: Date,
  to: Date,
  timeZone: string
): DateRangeStrings {
  const fromUtc = zonedDateTimeToUtc(from, timeZone);
  const toUtc = zonedDateTimeToUtc(to, timeZone);
  return {
    from: fromUtc?.toISOString() ?? "",
    to: toUtc?.toISOString() ?? "",
  };
}

function getDateTimeParts(date: Date, timeZone?: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function formatDateTimeDisplay(value: Date | string, timeZone?: string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === "string" ? value : "";
  }

  const parts = getDateTimeParts(date, timeZone);

  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export function formatDateDisplay(value: Date | string, timeZone?: string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    if (typeof value === "string") {
      const slashDate = value.trim().match(/^(\d{2}\/\d{2}\/\d{4})/);
      if (slashDate) return slashDate[1];
      return value;
    }
    return "";
  }

  const parts = getDateTimeParts(date, timeZone);

  return `${parts.day}/${parts.month}/${parts.year}`;
}

export function formatDateRangeDisplay(from: Date, to: Date, timeZone?: string) {
  return `${formatDateTimeDisplay(from, timeZone)} - ${formatDateTimeDisplay(to, timeZone)}`;
}

export function buildTodayDateTimeRange(): DateRangeStrings {
  const now = new Date();
  return {
    from: toDateTimeLocalValue(startOfDay(now)),
    to: toDateTimeLocalValue(endOfDay(now)),
  };
}

export function resolveDateRangePreset(preset: DateRangePreset, reference = new Date()) {
  const today = startOfDay(reference);

  switch (preset) {
    case "today":
      return { from: startOfDay(today), to: endOfDay(today) };
    case "yesterday": {
      const day = addDays(today, -1);
      return { from: startOfDay(day), to: endOfDay(day) };
    }
    case "this-week":
      return { from: startOfWeek(today), to: endOfDay(today) };
    case "last-week": {
      const lastWeekEnd = addDays(startOfWeek(today), -1);
      const lastWeekStart = startOfWeek(lastWeekEnd);
      return { from: lastWeekStart, to: endOfDay(lastWeekEnd) };
    }
    case "this-month":
      return { from: startOfMonth(today), to: endOfDay(today) };
    case "last-month": {
      const lastMonth = addMonths(today, -1);
      return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
    }
    case "last-3-months":
      return { from: startOfDay(addMonths(today, -3)), to: endOfDay(today) };
    case "last-6-months":
      return { from: startOfDay(addMonths(today, -6)), to: endOfDay(today) };
    case "custom":
    default:
      return { from: startOfDay(today), to: endOfDay(today) };
  }
}

export function resolveDateRangePresetInTimeZone(
  preset: DateRangePreset,
  timeZone: string,
  reference = new Date()
) {
  const wallClockReference = toTimeZoneWallClockDate(reference, timeZone) ?? reference;
  return resolveDateRangePreset(preset, wallClockReference);
}

export function toDateRangeStrings(from: Date, to: Date): DateRangeStrings {
  return {
    from: toDateTimeLocalValue(from),
    to: toDateTimeLocalValue(to),
  };
}

export function parseDateRangeStrings(value: DateRangeStrings) {
  const from = parseDateTimeValue(value.from);
  const to = parseDateTimeValue(value.to);
  if (!from || !to) return null;
  return { from, to };
}

export function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function isDateInRange(date: Date, from: Date, to: Date) {
  const time = date.getTime();
  return time >= from.getTime() && time <= to.getTime();
}

export function getMonthLabel(year: number, month: number) {
  return new Date(year, month, 1).toLocaleString("en-US", { month: "short", year: "numeric" });
}

export function buildDefaultLeadDetailsDateRange(timeZone: string) {
  const range = resolveDateRangePresetInTimeZone("today", timeZone);
  return toTimeZoneDateRangeStrings(range.from, range.to, timeZone);
}

export function buildEmptySearchDateRange(): DateRangeStrings {
  return { from: "", to: "" };
}

export function buildDefaultListSearchDateRange(timeZone: string): DateRangeStrings {
  const wallClockNow = toTimeZoneWallClockDate(new Date(), timeZone) ?? new Date();
  return toTimeZoneDateRangeStrings(
    startOfDay(addMonths(wallClockNow, -1)),
    endOfDay(wallClockNow),
    timeZone
  );
}

export const buildDefaultSearchDateRange = buildDefaultLeadDetailsDateRange;

export function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<Date | null> = [];

  for (let index = 0; index < startOffset; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}
