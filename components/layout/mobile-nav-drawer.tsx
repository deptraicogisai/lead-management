"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import { SidebarNavContent } from "@/components/layout/sidebar-nav-content";
import { useSidebarLayout } from "@/components/layout/sidebar-layout-context";
import {
  getFixedElementFontScaleStyle,
  getSystemFontScaleFactor,
  useSystemSettings,
} from "@/components/settings/system-settings-context";
import { cn } from "@/lib/utils";

export function MobileNavDrawer() {
  const pathname = usePathname();
  const { mobileOpen, mobileNavShown, closeMobileNav } = useSidebarLayout();
  const { fontScale } = useSystemSettings();
  const fontScaleFactor = getSystemFontScaleFactor(fontScale);
  const panelRef = useRef<HTMLElement>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const panelScaleStyle = getFixedElementFontScaleStyle(fontScaleFactor, {
    width: "min(88vw, 20rem)",
    height: "100dvh",
  });

  useEffect(() => {
    closeMobileNav();
  }, [pathname, closeMobileNav]);

  useEffect(() => {
    if (!mobileNavShown) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMobileNav();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileNavShown, closeMobileNav]);

  if (!mobileNavShown) {
    return null;
  }

  const handleTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
    touchStartYRef.current = event.touches[0]?.clientY ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    const startX = touchStartXRef.current;
    const startY = touchStartYRef.current;
    const endX = event.changedTouches[0]?.clientX;
    const endY = event.changedTouches[0]?.clientY;

    if (startX == null || endX == null || startY == null || endY == null) {
      return;
    }

    const deltaX = startX - endX;
    const deltaY = Math.abs(endY - startY);

    if (deltaX > 72 && deltaY < 48) {
      closeMobileNav();
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  return (
    <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
      <button
        type="button"
        aria-label="Close navigation"
        className={cn(
          "mobile-nav-backdrop absolute inset-0 bg-slate-950/55 backdrop-blur-[3px]",
          mobileOpen ? "mobile-nav-backdrop-open" : "mobile-nav-backdrop-closed"
        )}
        onClick={closeMobileNav}
      />

      <aside
        ref={panelRef}
        style={panelScaleStyle}
        className={cn(
          "mobile-nav-panel absolute left-0 top-0 flex flex-col border-r border-slate-200/80 bg-white shadow-2xl shadow-slate-900/20 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40",
          fontScaleFactor === 1 && "h-[100dvh] w-[min(88vw,20rem)]",
          mobileOpen ? "mobile-nav-panel-open" : "mobile-nav-panel-closed"
        )}
      >
        <div
          className="mobile-safe-top shrink-0 border-b border-slate-200 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-900 px-4 pb-4 pt-3 text-white dark:border-slate-700"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-lg font-bold backdrop-blur-sm">
                  S
                </span>
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold">Lead Management</p>
                  <p className="truncate text-xs text-blue-100/80">Admin Console</p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={closeMobileNav}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white transition active:scale-95 active:bg-white/20"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="mobile-nav-scroll min-h-0 flex-1 px-3 py-3">
          <SidebarNavContent isMobile onNavigate={closeMobileNav} />
        </div>

        <div className="mobile-safe-bottom shrink-0 border-t border-slate-200 px-4 py-2 text-center text-[10px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Tap outside to close
        </div>
      </aside>
    </div>
  );
}
