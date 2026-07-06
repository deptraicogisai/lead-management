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

export function formatDateTimeDisplay(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === "string" ? value : "";
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

export function formatDateRangeDisplay(from: Date, to: Date) {
  return `${formatDateTimeDisplay(from)} - ${formatDateTimeDisplay(to)}`;
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

export function buildDefaultLeadDetailsDateRange() {
  const range = resolveDateRangePreset("today");
  return toDateRangeStrings(range.from, range.to);
}

export function buildEmptySearchDateRange(): DateRangeStrings {
  return { from: "", to: "" };
}

export function buildDefaultListSearchDateRange(): DateRangeStrings {
  const today = new Date();
  return toDateRangeStrings(startOfDay(addMonths(today, -1)), endOfDay(today));
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
