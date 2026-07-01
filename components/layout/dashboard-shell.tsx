"use client";

import type { ReactNode } from "react";
import { DashboardChrome } from "@/components/layout/dashboard-chrome";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { Sidebar } from "@/components/layout/sidebar";
import { SidebarLayoutProvider, useSidebarLayout } from "@/components/layout/sidebar-layout-context";
import type { AuthSession } from "@/lib/auth";
import { cn } from "@/lib/utils";

function DashboardShellInner({ session, children }: { session: AuthSession; children: ReactNode }) {
  const { collapsed } = useSidebarLayout();

  return (
    <div className="min-h-[100dvh] bg-slate-100 dark:bg-slate-950">
      <Sidebar />
      <MobileNavDrawer />

      <main
        className={cn(
          "min-h-[100dvh] transition-[padding-left] duration-300 ease-in-out",
          collapsed ? "lg:pl-[4.5rem]" : "lg:pl-64"
        )}
      >
        <div className="mobile-app-shell">
          <DashboardChrome session={session}>{children}</DashboardChrome>
        </div>
      </main>
    </div>
  );
}

export function DashboardShell({ session, children }: { session: AuthSession; children: ReactNode }) {
  return (
    <SidebarLayoutProvider>
      <DashboardShellInner session={session}>{children}</DashboardShellInner>
    </SidebarLayoutProvider>
  );
}
