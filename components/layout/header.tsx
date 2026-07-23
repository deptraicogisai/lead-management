"use client";

import { ChevronDown, Clock3, LogOut, Menu, Settings, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Breadcrumbs, MobilePageTitle } from "@/components/layout/breadcrumbs";
import { useBreadcrumbOverride } from "@/components/layout/breadcrumb-context";
import { useSidebarLayout } from "@/components/layout/sidebar-layout-context";
import {
  getSystemTimeZoneHeaderLabel,
  useSystemSettings,
} from "@/components/settings/system-settings-context";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import type { AuthSession } from "@/lib/auth";
import { buildBreadcrumbs } from "@/lib/breadcrumbs";
import { cn } from "@/lib/utils";

type HeaderProps = {
  session: AuthSession;
  onOpenSettings: () => void;
};

export function Header({ session, onOpenSettings }: HeaderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const overrideLabel = useBreadcrumbOverride();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const { mobileOpen, openMobileNav, closeMobileNav } = useSidebarLayout();
  const { timeZone } = useSystemSettings();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [clockNow, setClockNow] = useState(() => new Date());

  const { items } = useMemo(
    () =>
      buildBreadcrumbs(pathname, {
        searchParams,
        overrideLabel,
      }),
    [pathname, searchParams, overrideLabel]
  );

  const loginTime = useMemo(() => {
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone,
    }).format(new Date(session.loginAt));
  }, [session.loginAt, timeZone]);

  const systemClock = useMemo(() => {
    const zoneLabel = getSystemTimeZoneHeaderLabel(timeZone);
    const dateLabel = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(clockNow);
    const timeLabel = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).format(clockNow);

    return {
      zoneLabel,
      dateLabel,
      timeLabel,
      fullLabel: `${zoneLabel} - ${dateLabel}, ${timeLabel}`,
    };
  }, [clockNow, timeZone]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);

    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isMenuOpen]);

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  };

  const handleMenuToggle = () => {
    if (mobileOpen) {
      closeMobileNav();
      return;
    }

    openMobileNav();
  };

  return (
    <header
      className={cn(
        "mobile-app-header sticky top-0 z-30 mb-0 border-b border-slate-200/90 bg-white/95 backdrop-blur-md lg:mb-6 lg:rounded-2xl lg:border lg:shadow-sm dark:border-slate-700 dark:bg-slate-900/95"
      )}
    >
      <div className="flex items-center gap-1.5 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3 lg:px-6 lg:py-4">
        <button
          type="button"
          onClick={handleMenuToggle}
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-800 transition active:scale-95 lg:hidden dark:bg-slate-800 dark:text-slate-100"
          aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileOpen}
        >
          <Menu
            size={20}
            className={cn(
              "absolute transition-all duration-300",
              mobileOpen ? "rotate-90 scale-75 opacity-0" : "rotate-0 scale-100 opacity-100"
            )}
          />
          <X
            size={20}
            className={cn(
              "absolute transition-all duration-300",
              mobileOpen ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-75 opacity-0"
            )}
          />
        </button>

        <div className="min-w-0 flex-1">
          <div className="lg:hidden">
            <MobilePageTitle items={items} />
          </div>
          <div className="hidden lg:block">
            <Breadcrumbs items={items} />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <div
            className="hidden max-w-[32rem] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 lg:flex dark:border-slate-500 dark:bg-slate-800 dark:text-slate-200"
            title={systemClock.fullLabel}
          >
            <Clock3 size={15} className="shrink-0 text-blue-500" />
            <span className="truncate tabular-nums" suppressHydrationWarning>
              {systemClock.fullLabel}
            </span>
          </div>
          <ThemeToggle />
          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition duration-200 hover:-translate-y-0.5 hover:bg-slate-50 hover:text-blue-600 active:scale-95 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-blue-300"
            aria-label="Open system settings"
            title="Settings"
          >
            <Settings size={19} />
          </button>

          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setIsMenuOpen((current) => !current)}
              className="flex h-11 items-center gap-2 rounded-xl bg-slate-100 px-1.5 text-sm font-medium text-slate-700 transition active:scale-95 sm:px-3 dark:bg-slate-800 dark:text-slate-100"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                {session.initials}
              </span>
              <span className="hidden text-left md:block">
                <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{session.name}</span>
                <span className="block text-xs text-slate-600 dark:text-slate-300">{session.email}</span>
              </span>
              <ChevronDown size={16} className={cn("hidden transition sm:block", isMenuOpen && "rotate-180")} />
            </button>

            {isMenuOpen ? (
              <div className="animate-scale-in absolute right-0 top-[calc(100%+0.5rem)] z-40 w-[min(18rem,calc(100vw-1.5rem))] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-600 dark:bg-slate-900">
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{session.name}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{session.email}</p>
                  <div className="mt-3 grid gap-1 text-xs text-slate-600 dark:text-slate-300">
                    <p>Role: {session.role}</p>
                    <p>Signed in: {loginTime}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-600 transition active:bg-red-100 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <LogOut size={16} />
                  {isLoggingOut ? "Signing out..." : "Logout"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenSettings}
        className="flex w-full items-start gap-2.5 border-t border-slate-200/80 bg-slate-50/80 px-3 py-2 text-left transition active:bg-slate-100 lg:hidden dark:border-slate-700/80 dark:bg-slate-950/50 dark:active:bg-slate-800/80"
        aria-label="Open system time zone settings"
        title="Tap to change system time zone"
      >
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
          <Clock3 size={14} />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className="block text-xs font-semibold leading-4 text-slate-800 dark:text-slate-100"
            suppressHydrationWarning
          >
            {systemClock.zoneLabel}
          </span>
          <span
            className="mt-0.5 block text-[11px] leading-4 text-slate-600 tabular-nums dark:text-slate-300"
            suppressHydrationWarning
          >
            {systemClock.dateLabel}, {systemClock.timeLabel}
          </span>
        </span>
      </button>
    </header>
  );
}
