"use client";

import Link from "next/link";
import { ChevronDown, ChevronLeft, LogOut } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { AuthSession } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/sellers": "Publisher List",
  "/verticals": "Vertical",
  "/verticals/fields": "Vertical Fields",
  "/buyers": "Buyers",
  "/campaigns": "Campaigns",
  "/ping-tree-settings": "Ping Tree Settings",
  "/present-lists": "Present & Do Not Present Lists",
  "/integration-builder": "Integration Builder",
  "/api-config": "API Configuration",
  "/reports/publisher/performance-summary": "Publisher Performance Summary",
  "/reports/publisher/lead-details": "Publisher Lead Details",
  "/reports/buyer/performance-summary": "Buyer Performance Summary",
  "/reports/buyer/lead-details": "Buyer Lead Details",
};

type HeaderProps = {
  session: AuthSession;
};

export function Header({ session }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const backLink = useMemo(() => {
    if (/^\/buyers\/[^/]+$/.test(pathname)) return { href: "/buyers", label: "Buyers" };
    if (/^\/campaigns\/[^/]+$/.test(pathname)) return { href: "/campaigns", label: "Campaigns" };
    if (/^\/present-lists\/[^/]+$/.test(pathname)) return { href: "/present-lists", label: "Present Lists" };
    if (/^\/integration-builder\/[^/]+$/.test(pathname)) return { href: "/integration-builder", label: "Integration Builder" };
    return null;
  }, [pathname]);

  const title = pathname.startsWith("/api-config/") && pathname.endsWith("/field-configuration")
    ? "Field Configuration"
    : pathname.startsWith("/campaigns/")
      ? "Campaign Setup"
      : pathname.startsWith("/present-lists/")
        ? "Present List Detail"
        : pageTitles[pathname] ?? "Dashboard";
  const loginTime = useMemo(() => {
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(session.loginAt));
  }, [session.loginAt]);

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

  return (
    <header className="sticky top-0 z-10 mb-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex min-w-0 items-center gap-3">
        {backLink ? (
          <Link
            href={backLink.href}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-blue-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-blue-300 dark:hover:bg-slate-800"
          >
            <ChevronLeft size={16} />
            {backLink.label}
          </Link>
        ) : null}
        <h2 className="truncate text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{title}</h2>
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />

        <div className="relative">
        <button
          type="button"
          onClick={() => setIsMenuOpen((current) => !current)}
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition duration-200 hover:-translate-y-0.5 hover:bg-slate-100 active:translate-y-0 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100">
            {session.initials}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{session.name}</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">{session.email}</span>
          </span>
          <ChevronDown size={16} className={isMenuOpen ? "rotate-180 transition" : "transition"} />
        </button>

        {isMenuOpen ? (
          <div className="animate-scale-in absolute right-0 top-[calc(100%+0.75rem)] w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-600 dark:bg-slate-900">
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{session.name}</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{session.email}</p>
              <div className="mt-3 grid gap-1 text-xs text-slate-500 dark:text-slate-400">
                <p>Role: {session.role}</p>
                <p>Signed in: {loginTime}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-600 transition duration-200 hover:-translate-y-0.5 hover:bg-red-100 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <LogOut size={16} />
              {isLoggingOut ? "Signing out..." : "Logout"}
            </button>
          </div>
        ) : null}
        </div>
      </div>
    </header>
  );
}
