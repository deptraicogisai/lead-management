"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "lead-management-theme";

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

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return savedTheme === "light" || savedTheme === "dark" ? savedTheme : getPreferredTheme();
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  };

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      onClick={toggleTheme}
      suppressHydrationWarning
      className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition duration-200 hover:-translate-y-0.5 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
      aria-checked={isDark}
    >
      <span className="hidden text-sm font-semibold sm:inline">Theme</span>
      <span
        className={cn(
          "relative flex h-7 w-14 items-center rounded-full px-1 transition-colors duration-300",
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
            "absolute top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm transition-transform duration-300",
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
