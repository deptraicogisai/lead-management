"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { SidebarNavContent } from "@/components/layout/sidebar-nav-content";
import { useSidebarLayout } from "@/components/layout/sidebar-layout-context";
import { SidebarTooltip } from "@/components/layout/sidebar-tooltip";
import {
  getFixedElementFontScaleStyle,
  getSystemFontScaleFactor,
  useSystemSettings,
} from "@/components/settings/system-settings-context";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const { collapsed, toggleCollapsed } = useSidebarLayout();
  const { fontScale } = useSystemSettings();
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");
  const navCollapsed = collapsed && isLargeScreen;
  const fontScaleFactor = getSystemFontScaleFactor(fontScale);
  const layoutWidth = navCollapsed ? "4.5rem" : "16rem";
  const scaleStyle = getFixedElementFontScaleStyle(fontScaleFactor, {
    width: layoutWidth,
    height: "100dvh",
  });

  return (
    <aside
      style={scaleStyle}
      className={cn(
        "fixed left-0 top-0 z-20 hidden flex-col overflow-hidden border-r border-slate-200 bg-white py-5 shadow-sm transition-[width,padding] duration-300 ease-in-out lg:flex dark:border-slate-700 dark:bg-slate-900",
        fontScaleFactor === 1 && "h-screen",
        fontScaleFactor === 1 && (navCollapsed ? "w-[4.5rem] px-2" : "w-64 px-3"),
        fontScaleFactor !== 1 && (navCollapsed ? "px-2" : "px-3")
      )}
    >
      <div className={cn("mb-5 shrink-0", navCollapsed ? "px-0" : "px-1")}>
        {navCollapsed ? (
          <div className="flex justify-center">
            <SidebarTooltip label="Expand sidebar">
              <button
                type="button"
                onClick={toggleCollapsed}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition duration-200 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <PanelLeftOpen size={18} />
              </button>
            </SidebarTooltip>
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
              S
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold leading-tight text-slate-900 dark:text-slate-100">
                SaaS Admin
              </h1>
              <p className="truncate text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Lead Management
              </p>
            </div>
            <SidebarTooltip label="Collapse sidebar" className="shrink-0">
              <button
                type="button"
                onClick={toggleCollapsed}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition duration-200 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <PanelLeftClose size={18} />
              </button>
            </SidebarTooltip>
          </div>
        )}
      </div>

      <SidebarNavContent collapsed={navCollapsed} />
    </aside>
  );
}
