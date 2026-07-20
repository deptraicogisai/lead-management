"use client";

import { useCallback, useState, type ReactNode } from "react";
import { DashboardChrome } from "@/components/layout/dashboard-chrome";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { Sidebar } from "@/components/layout/sidebar";
import { SidebarLayoutProvider, useSidebarLayout } from "@/components/layout/sidebar-layout-context";
import {
  getSystemFontScaleFactor,
  SystemSettingsProvider,
  useSystemSettings,
} from "@/components/settings/system-settings-context";
import { SystemSettingsDrawer } from "@/components/settings/system-settings-drawer";
import type { AuthSession } from "@/lib/auth";
import { cn } from "@/lib/utils";

function DashboardScaledShell({ session, children }: { session: AuthSession; children: ReactNode }) {
  const { collapsed } = useSidebarLayout();
  const { fontScale } = useSystemSettings();
  const fontScaleFactor = getSystemFontScaleFactor(fontScale);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  return (
    <>
      {/* Font scale only wraps dashboard chrome — not the settings drawer. */}
      <div
        className="dashboard-font-scale min-h-[100dvh] bg-slate-100 dark:bg-slate-950"
        style={fontScaleFactor === 1 ? undefined : { zoom: fontScaleFactor }}
        suppressHydrationWarning
      >
        <Sidebar />
        <MobileNavDrawer />

        <main
          className={cn(
            "min-h-[100dvh] transition-[padding-left] duration-300 ease-in-out",
            collapsed ? "lg:pl-[4.5rem]" : "lg:pl-64"
          )}
        >
          <div className="mobile-app-shell">
            <DashboardChrome session={session} onOpenSettings={openSettings}>
              {children}
            </DashboardChrome>
          </div>
        </main>
      </div>

      <SystemSettingsDrawer open={settingsOpen} onClose={closeSettings} />
    </>
  );
}

export function DashboardShell({ session, children }: { session: AuthSession; children: ReactNode }) {
  return (
    <SystemSettingsProvider>
      <SidebarLayoutProvider>
        <DashboardScaledShell session={session}>{children}</DashboardScaledShell>
      </SidebarLayoutProvider>
    </SystemSettingsProvider>
  );
}
