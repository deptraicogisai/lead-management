"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CancelButton, PrimaryButton } from "@/components/ui/form-controls";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { useSystemSettings } from "@/components/settings/system-settings-context";
import {
  DATE_RANGE_PRESETS,
  endOfDay,
  formatDateRangeDisplay,
  getCalendarDays,
  getDateRangePresetLabel,
  getMonthLabel,
  isDateInRange,
  isSameDay,
  hasExplicitTimeZone,
  parseDateTimeInTimeZone,
  parseDateTimeValue,
  resolveDateRangePresetInTimeZone,
  startOfDay,
  toTimeZoneDateRangeStrings,
  toTimeZoneWallClockDate,
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

function parsePickerWallClock(value: string, timeZone: string) {
  if (!value.trim()) return null;

  // Explicit UTC/offset values are converted into the selected zone's wall clock.
  if (hasExplicitTimeZone(value)) {
    const instant = parseDateTimeValue(value);
    return instant ? toTimeZoneWallClockDate(instant, timeZone) : null;
  }

  // Timezone-less values are already civil wall-clock fields for the selected zone.
  const match = value
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?$/);
  if (!match) return null;

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] ?? 0),
    Number((match[7] ?? "0").padEnd(3, "0"))
  );
}

function buildDraft(
  value: DateRangeStrings,
  timeZone: string,
  preset: DateRangePreset = "today"
): DraftRange {
  const parsedFrom = parsePickerWallClock(value.from, timeZone);
  const parsedTo = parsePickerWallClock(value.to, timeZone);
  const parsed =
    parsedFrom && parsedTo
      ? { from: parsedFrom, to: parsedTo }
      : resolveDateRangePresetInTimeZone("today", timeZone);
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
        <DropdownSelect
          value={String(date.getHours())}
          options={Array.from({ length: 24 }, (_, hour) => ({
            value: String(hour),
            label: String(hour),
          }))}
          onChange={(value) => updatePart("hours", value)}
          size="compact"
          className="w-[4.25rem]"
        />
        <span className="text-xs text-slate-400">:</span>
        <DropdownSelect
          value={String(date.getMinutes())}
          options={Array.from({ length: 60 }, (_, minute) => ({
            value: String(minute),
            label: String(minute).padStart(2, "0"),
          }))}
          onChange={(value) => updatePart("minutes", value)}
          size="compact"
          className="w-[4.25rem]"
        />
        <span className="text-xs text-slate-400">:</span>
        <DropdownSelect
          value={String(date.getSeconds())}
          options={Array.from({ length: 60 }, (_, second) => ({
            value: String(second),
            label: String(second).padStart(2, "0"),
          }))}
          onChange={(value) => updatePart("seconds", value)}
          size="compact"
          className="w-[4.25rem]"
        />
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
  const { timeZone } = useSystemSettings();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftRange>(() => buildDraft(value, timeZone, "today"));
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const previousTimeZoneRef = useRef(timeZone);

  const parsedValue = useMemo(() => {
    const from = parseDateTimeInTimeZone(value.from, timeZone);
    const to = parseDateTimeInTimeZone(value.to, timeZone);
    return from && to ? { from, to } : null;
  }, [timeZone, value]);
  const displayLabel = parsedValue
    ? formatDateRangeDisplay(parsedValue.from, parsedValue.to, timeZone)
    : "Select date range";

  const rightMonth = useMemo(
    () => new Date(draft.leftMonth.getFullYear(), draft.leftMonth.getMonth() + 1, 1),
    [draft.leftMonth]
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
      setDraft(buildDraft(value, timeZone, draft.preset));
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [draft.preset, timeZone, value]);

  useEffect(() => {
    const previousTimeZone = previousTimeZoneRef.current;
    previousTimeZoneRef.current = timeZone;
    if (!value.from || !value.to) return;

    const fromWallClock = parsePickerWallClock(value.from, previousTimeZone);
    const toWallClock = parsePickerWallClock(value.to, previousTimeZone);
    if (!fromWallClock || !toWallClock) return;

    const normalized = toTimeZoneDateRangeStrings(fromWallClock, toWallClock, timeZone);
    if (normalized.from !== value.from || normalized.to !== value.to) {
      onChange(normalized);
    }
  }, [onChange, timeZone, value]);

  useEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }

    const updateMenuPosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const isCompact = viewportWidth < 640;
      const menuWidth = isCompact ? viewportWidth - 24 : Math.min(760, viewportWidth - 32);
      const left = Math.min(Math.max(rect.left, 12), viewportWidth - menuWidth - 12);

      setMenuPosition({
        top: rect.bottom + 4,
        left,
        width: menuWidth,
      });
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open]);

  const openPicker = () => {
    setDraft(buildDraft(value, timeZone, draft.preset));
    setOpen(true);
  };

  const applyPreset = (preset: DateRangePreset) => {
    const range = resolveDateRangePresetInTimeZone(preset, timeZone);
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
    onChange(toTimeZoneDateRangeStrings(draft.from, draft.to, timeZone));
    setOpen(false);
  };

  const handleCancel = () => {
    setDraft(buildDraft(value, timeZone, draft.preset));
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        onClick={openPicker}
        className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25"
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
        <span className="truncate">{displayLabel}</span>
      </button>

      {open && menuPosition && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              style={{
                position: "fixed",
                top: menuPosition.top,
                left: menuPosition.left,
                width: menuPosition.width,
              }}
              className="z-[100] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            >
          <div className="flex flex-col md:flex-row">
            <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50 p-2 md:w-40 md:flex-col md:overflow-x-visible md:border-b-0 md:border-r dark:border-slate-700 dark:bg-slate-900/70">
              {DATE_RANGE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={cn(
                    "shrink-0 rounded-lg px-3 py-2 text-left text-sm transition md:mb-1 md:block md:w-full",
                    draft.preset === preset
                      ? "bg-sky-600 font-medium text-white"
                      : "text-slate-700 hover:bg-white dark:text-slate-200 dark:hover:bg-slate-800"
                  )}
                >
                  {getDateRangePresetLabel(preset)}
                </button>
              ))}
            </div>

            <div className="min-w-0 flex-1 p-3 sm:p-4">
              <div className="mb-4 flex items-center justify-between gap-2 sm:gap-3">
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

                <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-6">
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
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

              <div className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2 sm:gap-6 dark:border-slate-700">
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

          <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 dark:border-slate-700 dark:bg-slate-900/70">
            <p className="truncate text-xs text-slate-600 dark:text-slate-300">
              {formatDateRangeDisplay(draft.from, draft.to)}
            </p>
            <div className="flex items-center justify-end gap-2">
              <CancelButton type="button" onClick={handleCancel} />
              <PrimaryButton type="button" onClick={handleApply}>
                Apply
              </PrimaryButton>

            </div>
          </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
