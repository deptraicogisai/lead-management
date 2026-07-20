"use client";

import { Clock3, Settings, Type, X } from "lucide-react";
import { useEffect } from "react";
import { DataCleanupSettingsPage } from "@/components/settings/data-cleanup-settings-page";
import {
  SYSTEM_FONT_SCALE_OPTIONS,
  useSystemSettings,
  type SystemFontScale,
  type SystemTimeZone,
} from "@/components/settings/system-settings-context";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { TimezoneSelect } from "@/components/ui/timezone-select";
import { cn } from "@/lib/utils";

type SystemSettingsDrawerProps = {
  open: boolean;
  onClose: () => void;
};

const DRAWER_WIDTH_PX = 400;
/** Slightly larger than dashboard default (body 13px), independent of System Font Size. */
const DRAWER_FONT_ZOOM = 1.08;

export function SystemSettingsDrawer({ open, onClose }: SystemSettingsDrawerProps) {
  const { fontScale, timeZone, setFontScale, setTimeZone } = useSystemSettings();

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  return (
    <>
      <button
        type="button"
        aria-label="Close settings"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[1px] transition-opacity duration-300",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="System settings"
        data-font-scale-stable=""
        style={{
          width: `min(${DRAWER_WIDTH_PX}px, calc(100vw - 16px))`,
          zoom: DRAWER_FONT_ZOOM,
        }}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex flex-col border-l border-slate-200 bg-slate-50 shadow-2xl transition-transform duration-300 ease-out dark:border-slate-700 dark:bg-slate-950",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
              <Settings size={20} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Settings</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Display preferences and database cleanup.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="Close settings"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <label
              htmlFor="system-font-size"
              className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100"
            >
              <Type size={17} className="text-blue-500" />
              Font Size
            </label>
            <DropdownSelect
              id="system-font-size"
              value={fontScale}
              options={SYSTEM_FONT_SCALE_OPTIONS}
              onChange={(value) => setFontScale(value as SystemFontScale)}
              className="dark:bg-slate-950"
              disablePortal
            />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <label
              htmlFor="system-time-zone"
              className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100"
            >
              <Clock3 size={17} className="text-blue-500" />
              System Time Zone
            </label>
            <TimezoneSelect
              id="system-time-zone"
              value={timeZone}
              onChange={(value) => setTimeZone(value as SystemTimeZone)}
              className="dark:bg-slate-950"
              disablePortal
            />
            <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Stored timestamps remain UTC. Lead, report and log times are converted only for
              display. Default: America/New_York (EST/EDT).
            </p>
          </section>

          <DataCleanupSettingsPage enabled={open} variant="drawer" />
        </div>
      </aside>
    </>
  );
}
