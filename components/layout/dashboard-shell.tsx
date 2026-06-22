"use client";

import type { ReactNode } from "react";
import { DashboardChrome } from "@/components/layout/dashboard-chrome";
import { Sidebar } from "@/components/layout/sidebar";
import { SidebarLayoutProvider, useSidebarLayout } from "@/components/layout/sidebar-layout-context";
import type { AuthSession } from "@/lib/auth";
import { cn } from "@/lib/utils";

function DashboardShellInner({ session, children }: { session: AuthSession; children: ReactNode }) {
  const { collapsed } = useSidebarLayout();

  return (
    <>
      <Sidebar />
      <main
        className={cn(
          "min-h-screen transition-[padding-left] duration-300 ease-in-out",
          collapsed ? "pl-[4.5rem]" : "pl-64"
        )}
      >
        <div className="p-4 md:p-6">
          <DashboardChrome session={session}>{children}</DashboardChrome>
        </div>
      </main>
    </>
  );
}

export function DashboardShell({ session, children }: { session: AuthSession; children: ReactNode }) {
  return (
    <SidebarLayoutProvider>
      <DashboardShellInner session={session}>{children}</DashboardShellInner>
    </SidebarLayoutProvider>
  );
}
