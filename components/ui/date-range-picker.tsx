"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DATE_RANGE_PRESETS,
  endOfDay,
  formatDateRangeDisplay,
  getCalendarDays,
  getDateRangePresetLabel,
  getMonthLabel,
  isDateInRange,
  isSameDay,
  parseDateRangeStrings,
  parseDateTimeValue,
  resolveDateRangePreset,
  startOfDay,
  toDateRangeStrings,
  type DateRangePreset,
  type DateRangeStrings,
} from "@/lib/date-range";
import { cn } from "@/lib/utils";

type DateRangePickerProps = {
  id?: string;
  value: DateRangeStrings;
  onChange: (value: DateRangeStrings) => void;
  className?: string;
};

type DraftRange = {
  preset: DateRangePreset;
  from: Date;
  to: Date;
  leftMonth: Date;
};

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function buildDraft(value: DateRangeStrings, preset: DateRangePreset = "today"): DraftRange {
  const parsed = parseDateRangeStrings(value) ?? resolveDateRangePreset("today");
  return {
    preset,
    from: parsed.from,
    to: parsed.to,
    leftMonth: new Date(parsed.from.getFullYear(), parsed.from.getMonth(), 1),
  };
}

function TimeSelects({
  label,
  date,
  onChange,
}: {
  label: string;
  date: Date;
  onChange: (next: Date) => void;
}) {
  const updatePart = (part: "hours" | "minutes" | "seconds", raw: string) => {
    const next = new Date(date);
    const value = Number.parseInt(raw, 10);
    if (Number.isNaN(value)) return;
    if (part === "hours") next.setHours(value);
    if (part === "minutes") next.setMinutes(value);
    if (part === "seconds") next.setSeconds(value);
    onChange(next);
  };

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <div className="flex items-center gap-1">
        <select
          value={date.getHours()}
          onChange={(event) => updatePart("hours", event.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
        >
          {Array.from({ length: 24 }, (_, hour) => (
            <option key={hour} value={hour}>
              {hour}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-400">:</span>
        <select
          value={date.getMinutes()}
          onChange={(event) => updatePart("minutes", event.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
        >
          {Array.from({ length: 60 }, (_, minute) => (
            <option key={minute} value={minute}>
              {String(minute).padStart(2, "0")}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-400">:</span>
        <select
          value={date.getSeconds()}
          onChange={(event) => updatePart("seconds", event.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
        >
          {Array.from({ length: 60 }, (_, second) => (
            <option key={second} value={second}>
              {String(second).padStart(2, "0")}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function MonthGrid({
  monthDate,
  rangeFrom,
  rangeTo,
  onSelectDay,
}: {
  monthDate: Date;
  rangeFrom: Date;
  rangeTo: Date;
  onSelectDay: (day: Date) => void;
}) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const days = getCalendarDays(year, month);
  const rangeStart = rangeFrom.getTime() <= rangeTo.getTime() ? rangeFrom : rangeTo;
  const rangeEnd = rangeFrom.getTime() <= rangeTo.getTime() ? rangeTo : rangeFrom;

  return (
    <div>
      <div className="mb-2 grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-1 text-center text-[11px] font-medium text-slate-400">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} className="h-8" />;
          }

          const selectedStart = isSameDay(day, rangeStart);
          const selectedEnd = isSameDay(day, rangeEnd);
          const inRange = isDateInRange(day, rangeStart, rangeEnd);

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDay(day)}
              className={cn(
                "h-8 rounded-md text-xs font-medium transition",
                inRange && "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
                (selectedStart || selectedEnd) &&
                  "bg-sky-600 text-white hover:bg-sky-600 dark:bg-sky-500 dark:text-white"
              )}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DateRangePicker({ id, value, onChange, className }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftRange>(() => buildDraft(value, "today"));
  const containerRef = useRef<HTMLDivElement | null>(null);

  const parsedValue = useMemo(() => parseDateRangeStrings(value), [value]);
  const displayLabel = parsedValue
    ? formatDateRangeDisplay(parsedValue.from, parsedValue.to)
    : "Select date range";

  const rightMonth = useMemo(
    () => new Date(draft.leftMonth.getFullYear(), draft.leftMonth.getMonth() + 1, 1),
    [draft.leftMonth]
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setDraft(buildDraft(value, draft.preset));
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [draft.preset, value]);

  const openPicker = () => {
    setDraft(buildDraft(value, draft.preset));
    setOpen(true);
  };

  const applyPreset = (preset: DateRangePreset) => {
    const range = resolveDateRangePreset(preset);
    setDraft({
      preset,
      from: range.from,
      to: range.to,
      leftMonth: new Date(range.from.getFullYear(), range.from.getMonth(), 1),
    });
  };

  const selectDay = (day: Date) => {
    setDraft((current) => {
      const clicked = startOfDay(day);

      if (current.preset !== "custom") {
        return {
          preset: "custom",
          from: startOfDay(day),
          to: endOfDay(day),
          leftMonth: current.leftMonth,
        };
      }

      const fromDay = startOfDay(current.from);
      const toDay = startOfDay(current.to);
      const singleDaySelection = isSameDay(fromDay, toDay);

      if (singleDaySelection) {
        if (isSameDay(clicked, fromDay)) {
          return current;
        }

        if (clicked.getTime() < fromDay.getTime()) {
          return {
            ...current,
            preset: "custom",
            from: startOfDay(day),
            to: endOfDay(current.from),
          };
        }

        return {
          ...current,
          preset: "custom",
          to: endOfDay(day),
        };
      }

      return {
        ...current,
        preset: "custom",
        from: startOfDay(day),
        to: endOfDay(day),
      };
    });
  };

  const handleApply = () => {
    onChange(toDateRangeStrings(draft.from, draft.to));
    setOpen(false);
  };

  const handleCancel = () => {
    setDraft(buildDraft(value, draft.preset));
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        id={id}
        type="button"
        onClick={openPicker}
        className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25"
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
        <span className="truncate">{displayLabel}</span>
      </button>

      {open ? (
        <div className="absolute left-0 z-30 mt-2 w-[min(760px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <div className="flex">
            <div className="w-40 shrink-0 border-r border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900/70">
              {DATE_RANGE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={cn(
                    "mb-1 block w-full rounded-lg px-3 py-2 text-left text-sm transition",
                    draft.preset === preset
                      ? "bg-sky-600 font-medium text-white"
                      : "text-slate-700 hover:bg-white dark:text-slate-200 dark:hover:bg-slate-800"
                  )}
                >
                  {getDateRangePresetLabel(preset)}
                </button>
              ))}
            </div>

            <div className="min-w-0 flex-1 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      leftMonth: new Date(current.leftMonth.getFullYear(), current.leftMonth.getMonth() - 1, 1),
                    }))
                  }
                  className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <div className="grid flex-1 grid-cols-2 gap-6">
                  <p className="text-center text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {getMonthLabel(draft.leftMonth.getFullYear(), draft.leftMonth.getMonth())}
                  </p>
                  <p className="text-center text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {getMonthLabel(rightMonth.getFullYear(), rightMonth.getMonth())}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      leftMonth: new Date(current.leftMonth.getFullYear(), current.leftMonth.getMonth() + 1, 1),
                    }))
                  }
                  className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <MonthGrid
                  monthDate={draft.leftMonth}
                  rangeFrom={draft.from}
                  rangeTo={draft.to}
                  onSelectDay={selectDay}
                />
                <MonthGrid
                  monthDate={rightMonth}
                  rangeFrom={draft.from}
                  rangeTo={draft.to}
                  onSelectDay={selectDay}
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-6 border-t border-slate-200 pt-4 dark:border-slate-700">
                <TimeSelects
                  label="Start Time"
                  date={draft.from}
                  onChange={(from) => setDraft((current) => ({ ...current, preset: "custom", from }))}
                />
                <TimeSelects
                  label="End Time"
                  date={draft.to}
                  onChange={(to) => setDraft((current) => ({ ...current, preset: "custom", to }))}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70">
            <p className="truncate text-xs text-slate-600 dark:text-slate-300">
              {formatDateRangeDisplay(draft.from, draft.to)}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
