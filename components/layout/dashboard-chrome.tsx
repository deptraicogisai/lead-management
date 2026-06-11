"use client";

import { Suspense, type ReactNode } from "react";
import { BreadcrumbProvider } from "@/components/layout/breadcrumb-context";
import { Header } from "@/components/layout/header";
import { ToastProvider } from "@/components/ui/toast-provider";
import type { AuthSession } from "@/lib/auth";

type DashboardChromeProps = {
  session: AuthSession;
  children: ReactNode;
};

function HeaderFallback() {
  return (
    <header className="sticky top-0 z-10 mb-6 rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="h-5 w-64 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
    </header>
  );
}

export function DashboardChrome({ session, children }: DashboardChromeProps) {
  return (
    <BreadcrumbProvider>
      <Suspense fallback={<HeaderFallback />}>
        <Header session={session} />
      </Suspense>
      {children}
      <ToastProvider />
    </BreadcrumbProvider>
  );
}
