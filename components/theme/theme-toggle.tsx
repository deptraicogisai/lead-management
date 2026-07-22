"use client";

import { Moon, Sun } from "lucide-react";
import { flushSync } from "react-dom";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "lead-management-theme";
const THEME_TRANSITION_LOCK_CLASS = "theme-switching";

function getPreferredTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
}

function readStoredTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return savedTheme === "light" || savedTheme === "dark" ? savedTheme : getPreferredTheme();
}

/**
 * Disable CSS transitions for one frame so theme colors swap atomically.
 * Avoids muddy sidebar/body color morphing and width jank on chrome.
 */
function withThemeSwitchLock(apply: () => void) {
  const root = document.documentElement;
  root.classList.add(THEME_TRANSITION_LOCK_CLASS);
  apply();
  // Force style recalc while transitions are disabled, then unlock on next frames.
  void root.offsetWidth;
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      root.classList.remove(THEME_TRANSITION_LOCK_CLASS);
    });
  });
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";

    withThemeSwitchLock(() => {
      applyTheme(nextTheme);
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      flushSync(() => {
        setTheme(nextTheme);
      });
    });
  };

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      onClick={toggleTheme}
      data-theme-toggle=""
      suppressHydrationWarning
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-[background-color,border-color,color,transform] duration-200 hover:-translate-y-0.5 hover:bg-slate-50 active:scale-95 sm:h-auto sm:w-auto sm:gap-3 sm:px-3 sm:py-2 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
      aria-checked={isDark}
    >
      <span className="sm:hidden" suppressHydrationWarning>
        {isDark ? <Moon size={18} className="text-blue-500" /> : <Sun size={18} className="text-amber-500" />}
      </span>
      <span className="hidden text-sm font-semibold sm:inline">Theme</span>
      <span
        className={cn(
          "relative hidden h-7 w-14 items-center rounded-full px-1 transition-colors duration-300 sm:flex",
          isDark ? "bg-blue-500" : "bg-slate-300 dark:bg-slate-600"
        )}
      >
        <Sun
          size={14}
          className={cn(
            "absolute left-1.5 top-1/2 -translate-y-1/2 transition-colors duration-300",
            isDark ? "text-blue-100/80" : "text-amber-500"
          )}
        />
        <Moon
          size={14}
          className={cn(
            "absolute right-1.5 top-1/2 -translate-y-1/2 transition-colors duration-300",
            isDark ? "text-slate-50" : "text-slate-500"
          )}
        />
        <span
          className={cn(
            "absolute top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm transition-transform duration-300 ease-out",
            isDark ? "translate-x-7" : "translate-x-0"
          )}
          suppressHydrationWarning
        >
          {isDark ? <Moon size={12} className="text-blue-600" /> : <Sun size={12} className="text-amber-500" />}
        </span>
      </span>
    </button>
  );
}
