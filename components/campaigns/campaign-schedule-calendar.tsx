"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { resolveCampaignTimezone, type CampaignScheduleRule } from "@/lib/campaign";
import {
  formatCalendarHeading,
  formatScheduleActionLabel,
  formatScheduleCap,
  formatScheduleTimeRange,
  getMonthGridDates,
  getRulesForDate,
  getWeekDates,
  isSameCalendarDay,
  shiftCalendarDate,
  type ScheduleCalendarView,
  WEEKDAY_HEADERS,
} from "@/lib/campaign-schedule-calendar";
import { cn } from "@/lib/utils";

type CampaignScheduleCalendarProps = {
  rules: CampaignScheduleRule[];
  timezone: string;
};

function ScheduleRuleBlock({
  rule,
  timezone,
}: {
  rule: CampaignScheduleRule;
  timezone: string;
}) {
  return (
    <div className="space-y-0.5 text-[11px] leading-snug text-slate-700 dark:text-slate-200">
      <p className="font-semibold uppercase">
        {formatScheduleActionLabel(rule.action)} {formatScheduleTimeRange(rule)}
      </p>
      <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{resolveCampaignTimezone(timezone)}</p>
      <p>Sold cap: {formatScheduleCap(rule.dailySoldLeadsLimit)}</p>
      <p>Send cap: {formatScheduleCap(rule.dailyPostLeadsLimit)}</p>
    </div>
  );
}

function CalendarDayCell({
  date,
  rules,
  timezone,
  muted,
}: {
  date: Date;
  rules: CampaignScheduleRule[];
  timezone: string;
  muted?: boolean;
}) {
  const dayRules = getRulesForDate(rules, date);
  const hasRules = dayRules.length > 0;
  const isToday = isSameCalendarDay(date, new Date());

  return (
    <div
      className={cn(
        "min-h-[120px] border border-slate-200 p-2 dark:border-slate-700",
        hasRules ? "bg-emerald-50/90 dark:bg-emerald-500/10" : "bg-white dark:bg-slate-900",
        isToday &&
          "z-10 border-2 border-blue-600 bg-blue-50/70 shadow-[inset_0_0_0_1px_rgba(37,99,235,0.25)] dark:border-blue-400 dark:bg-blue-500/15",
        muted && "opacity-50"
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={cn(
            "text-sm font-semibold",
            isToday ? "text-blue-700 dark:text-blue-300" : "text-slate-700 dark:text-slate-200"
          )}
        >
          {date.getDate()}
        </span>
        {isToday ? (
          <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white dark:bg-blue-500">
            Today
          </span>
        ) : null}
      </div>

      <div className="space-y-2">
        {dayRules.map((rule) => (
          <ScheduleRuleBlock key={rule.id} rule={rule} timezone={timezone} />
        ))}
      </div>
    </div>
  );
}

export function CampaignScheduleCalendar({ rules, timezone }: CampaignScheduleCalendarProps) {
  const [view, setView] = useState<ScheduleCalendarView>("week");
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const heading = useMemo(() => formatCalendarHeading(currentDate, view), [currentDate, view]);

  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate]);
  const monthDates = useMemo(() => getMonthGridDates(currentDate), [currentDate]);
  const currentMonth = currentDate.getMonth();
  const today = new Date();

  const navigate = (direction: -1 | 0 | 1) => {
    setCurrentDate(shiftCalendarDate(currentDate, view, direction));
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            aria-label="Previous"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => navigate(0)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Current
          </button>
          <button
            type="button"
            onClick={() => navigate(1)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            aria-label="Next"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">{heading}</h3>

        <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-1 dark:border-slate-700">
          {(["day", "week", "month"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setView(option)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium capitalize",
                view === option
                  ? "bg-emerald-800 text-white"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {view === "day" ? (
        <div className="p-4">
          <CalendarDayCell date={currentDate} rules={rules} timezone={timezone} />
        </div>
      ) : null}

      {view === "week" ? (
        <div>
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {WEEKDAY_HEADERS.map((day, index) => {
              const columnDate = weekDates[index];
              const isToday = columnDate ? isSameCalendarDay(columnDate, today) : false;

              return (
                <div
                  key={day}
                  className={cn(
                    "border-r border-slate-200 px-2 py-2 last:border-r-0 dark:border-slate-700",
                    isToday && "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200"
                  )}
                >
                  {day}
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-7">
            {weekDates.map((date) => (
              <CalendarDayCell key={date.toISOString()} date={date} rules={rules} timezone={timezone} />
            ))}
          </div>
        </div>
      ) : null}

      {view === "month" ? (
        <div>
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {WEEKDAY_HEADERS.map((day, index) => {
              const isToday = index === today.getDay();

              return (
                <div
                  key={day}
                  className={cn(
                    "border-r border-slate-200 px-2 py-2 last:border-r-0 dark:border-slate-700",
                    isToday && "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200"
                  )}
                >
                  {day}
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-7">
            {monthDates.map((date) => (
              <CalendarDayCell
                key={date.toISOString()}
                date={date}
                rules={rules}
                timezone={timezone}
                muted={date.getMonth() !== currentMonth}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
