"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  APP_TIME_ZONE_OPTIONS,
  DEFAULT_APP_TIME_ZONE,
  getTimezoneOptionLabel,
  isAppTimeZoneId,
  type AppTimeZoneId,
} from "@/lib/timezones";

export type SystemFontScale = "default" | "80" | "90" | "100" | "110" | "120";

export type SystemTimeZone = AppTimeZoneId;

export const DEFAULT_SYSTEM_TIME_ZONE: SystemTimeZone = DEFAULT_APP_TIME_ZONE;
export const SYSTEM_FONT_SCALE_STORAGE_KEY = "lead-management-font-scale";
export const SYSTEM_TIME_ZONE_STORAGE_KEY = "lead-management-time-zone";
export const SYSTEM_TEST_MODE_STORAGE_KEY = "lead-management-test-mode";

export const SYSTEM_FONT_SCALE_OPTIONS: Array<{ value: SystemFontScale; label: string }> = [
  { value: "default", label: "Default" },
  { value: "80", label: "80%" },
  { value: "90", label: "90%" },
  { value: "100", label: "100%" },
  { value: "110", label: "110%" },
  { value: "120", label: "120%" },
];

export const SYSTEM_TIME_ZONE_OPTIONS: Array<{
  value: SystemTimeZone;
  label: string;
  headerLabel: string;
}> = APP_TIME_ZONE_OPTIONS.map((option) => ({
  value: option.id,
  label: option.label,
  headerLabel: option.shortLabel,
}));

type SystemSettingsContextValue = {
  fontScale: SystemFontScale;
  timeZone: SystemTimeZone;
  testMode: boolean;
  testModeReady: boolean;
  isSavingTestMode: boolean;
  setFontScale: (scale: SystemFontScale) => void;
  setTimeZone: (timeZone: SystemTimeZone) => void;
  setTestMode: (enabled: boolean) => Promise<boolean>;
};

const SystemSettingsContext = createContext<SystemSettingsContextValue | null>(null);

function isFontScale(value: string | null): value is SystemFontScale {
  return SYSTEM_FONT_SCALE_OPTIONS.some((option) => option.value === value);
}

function isTimeZone(value: string | null): value is SystemTimeZone {
  return Boolean(value && isAppTimeZoneId(value));
}

function readCachedTestMode() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SYSTEM_TEST_MODE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCachedTestMode(enabled: boolean) {
  try {
    window.localStorage.setItem(SYSTEM_TEST_MODE_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // Ignore storage errors (private mode, quota, etc.).
  }
}

export function getSystemFontScaleFactor(scale: SystemFontScale) {
  return scale === "default" ? 1 : Number(scale) / 100;
}

/**
 * Apply zoom on a `position: fixed` element without breaking layout.
 * Compensates width/height so the visual box stays the intended size while
 * typography and spacing inside scale with the font setting.
 */
export function getFixedElementFontScaleStyle(
  factor: number,
  layout: { width: string; height: string }
): { zoom: number; width: string; height: string } | undefined {
  if (factor === 1) return undefined;
  return {
    zoom: factor,
    width: `calc((${layout.width}) / ${factor})`,
    height: `calc((${layout.height}) / ${factor})`,
  };
}

export function resetSystemFontScale() {
  document.documentElement.style.fontSize = "";
  document.documentElement.style.removeProperty("--app-font-scale");
  delete document.documentElement.dataset.fontScale;
}

/** Persist scale token only — visual scale is applied on `.dashboard-font-scale`, not on `html`. */
function applyFontScale(scale: SystemFontScale) {
  const factor = getSystemFontScaleFactor(scale);
  // Keep root rem at browser default so login + settings drawer stay unaffected.
  document.documentElement.style.fontSize = "";
  document.documentElement.style.setProperty("--app-font-scale", String(factor));
  document.documentElement.dataset.fontScale = scale;
}

export function SystemSettingsProvider({ children }: { children: ReactNode }) {
  const [fontScale, setFontScaleState] = useState<SystemFontScale>(() => {
    if (typeof window === "undefined") return "default";
    const storedScale = window.localStorage.getItem(SYSTEM_FONT_SCALE_STORAGE_KEY);
    return isFontScale(storedScale) ? storedScale : "default";
  });
  const [timeZone, setTimeZoneState] = useState<SystemTimeZone>(() => {
    if (typeof window === "undefined") return DEFAULT_SYSTEM_TIME_ZONE;
    const storedTimeZone = window.localStorage.getItem(SYSTEM_TIME_ZONE_STORAGE_KEY);
    return isTimeZone(storedTimeZone) ? storedTimeZone : DEFAULT_SYSTEM_TIME_ZONE;
  });
  const [testMode, setTestModeState] = useState(() => readCachedTestMode());
  const [testModeReady, setTestModeReady] = useState(() => typeof window !== "undefined");
  const [isSavingTestMode, setIsSavingTestMode] = useState(false);

  useEffect(() => {
    applyFontScale(fontScale);
  }, [fontScale]);

  useEffect(() => {
    return () => {
      resetSystemFontScale();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadTestMode = async () => {
      try {
        const response = await fetch("/api/settings/system", { cache: "no-store" });
        if (!response.ok) {
          if (!cancelled) {
            setTestModeState(readCachedTestMode());
            setTestModeReady(true);
          }
          return;
        }
        const data = (await response.json()) as { testMode?: boolean };
        if (cancelled) return;
        const enabled = Boolean(data.testMode);
        setTestModeState(enabled);
        writeCachedTestMode(enabled);
        setTestModeReady(true);
      } catch {
        if (!cancelled) {
          setTestModeState(readCachedTestMode());
          setTestModeReady(true);
        }
      }
    };

    void loadTestMode();
    return () => {
      cancelled = true;
    };
  }, []);

  const setTestMode = useCallback(async (enabled: boolean) => {
    setIsSavingTestMode(true);
    const previous = testMode;
    setTestModeState(enabled);
    writeCachedTestMode(enabled);

    try {
      const response = await fetch("/api/settings/system", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testMode: enabled }),
      });
      if (!response.ok) {
        setTestModeState(previous);
        writeCachedTestMode(previous);
        return false;
      }
      const data = (await response.json()) as { testMode?: boolean };
      const next = Boolean(data.testMode);
      setTestModeState(next);
      writeCachedTestMode(next);
      return true;
    } catch {
      setTestModeState(previous);
      writeCachedTestMode(previous);
      return false;
    } finally {
      setIsSavingTestMode(false);
    }
  }, [testMode]);

  const value = useMemo<SystemSettingsContextValue>(
    () => ({
      fontScale,
      timeZone,
      testMode,
      testModeReady,
      isSavingTestMode,
      setFontScale: (scale) => {
        setFontScaleState(scale);
        applyFontScale(scale);
        window.localStorage.setItem(SYSTEM_FONT_SCALE_STORAGE_KEY, scale);
      },
      setTimeZone: (nextTimeZone) => {
        setTimeZoneState(nextTimeZone);
        window.localStorage.setItem(SYSTEM_TIME_ZONE_STORAGE_KEY, nextTimeZone);
      },
      setTestMode,
    }),
    [fontScale, timeZone, testMode, testModeReady, isSavingTestMode, setTestMode]
  );

  return <SystemSettingsContext.Provider value={value}>{children}</SystemSettingsContext.Provider>;
}

export function useSystemSettings() {
  const context = useContext(SystemSettingsContext);
  if (!context) {
    throw new Error("useSystemSettings must be used within SystemSettingsProvider.");
  }
  return context;
}

export function getSystemTimeZoneHeaderLabel(timeZone: SystemTimeZone) {
  return getTimezoneOptionLabel(timeZone, true);
}
