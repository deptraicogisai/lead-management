import type { CampaignScheduleRule } from "@/lib/campaign";

const JS_DAY_TO_ABBREV = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export type ScheduleCalendarView = "day" | "week" | "month";

export function getDayAbbrev(date: Date) {
  return JS_DAY_TO_ABBREV[date.getDay()];
}

export function formatScheduleCap(value: number | null) {
  return value === null ? "∞" : String(value);
}

export function formatScheduleTimeRange(rule: CampaignScheduleRule) {
  return `${rule.startHour}:${rule.startMinute} - ${rule.endHour}:${rule.endMinute}`;
}

export function formatScheduleActionLabel(action: CampaignScheduleRule["action"]) {
  return action === "Post" ? "POST" : "DO NOT POST";
}

export function getRulesForDate(rules: CampaignScheduleRule[], date: Date) {
  const abbrev = getDayAbbrev(date);
  return rules.filter((rule) => rule.active && rule.days.includes(abbrev));
}

export function formatCalendarHeading(date: Date, view: ScheduleCalendarView) {
  if (view === "day") {
    return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }

  return `${MONTH_NAMES[date.getMonth()]}, ${date.getFullYear()}`;
}

export function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfDay(next);
}

export function startOfWeek(date: Date) {
  const next = startOfDay(date);
  next.setDate(next.getDate() - next.getDay());
  return next;
}

export function startOfMonth(date: Date) {
  return startOfDay(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function getWeekDates(date: Date) {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function getMonthGridDates(date: Date) {
  const first = startOfMonth(date);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

export function shiftCalendarDate(date: Date, view: ScheduleCalendarView, direction: -1 | 0 | 1) {
  if (direction === 0) {
    return startOfDay(new Date());
  }

  const next = new Date(date);
  if (view === "day") {
    next.setDate(next.getDate() + direction);
  } else if (view === "week") {
    next.setDate(next.getDate() + direction * 7);
  } else {
    next.setMonth(next.getMonth() + direction);
  }

  return startOfDay(next);
}

export const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
