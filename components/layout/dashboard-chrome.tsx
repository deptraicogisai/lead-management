"use client";

import { Suspense, type ReactNode } from "react";
import { BreadcrumbProvider } from "@/components/layout/breadcrumb-context";
import { Header } from "@/components/layout/header";
import { ToastProvider } from "@/components/ui/toast-provider";
import type { AuthSession } from "@/lib/auth";

type DashboardChromeProps = {
  session: AuthSession;
  children: ReactNode;
  onOpenSettings: () => void;
};

function HeaderFallback() {
  return (
    <header className="mobile-app-header sticky top-0 z-30 mb-0 border-b border-slate-200 bg-white px-3 py-3 lg:mb-6 lg:rounded-2xl lg:border lg:px-6 lg:py-4 lg:shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="h-6 w-40 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
    </header>
  );
}

export function DashboardChrome({ session, children, onOpenSettings }: DashboardChromeProps) {
  return (
    <BreadcrumbProvider>
      <Suspense fallback={<HeaderFallback />}>
        <Header session={session} onOpenSettings={onOpenSettings} />
      </Suspense>
      <div className="mobile-page-content">{children}</div>
      <ToastProvider />
    </BreadcrumbProvider>
  );
}
