"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "dashboard-sidebar-collapsed";
const MOBILE_NAV_CLOSE_MS = 300;

type SidebarLayoutContextValue = {
  collapsed: boolean;
  toggleCollapsed: () => void;
  mobileOpen: boolean;
  mobileNavShown: boolean;
  openMobileNav: () => void;
  closeMobileNav: () => void;
  toggleMobileNav: () => void;
};

const SidebarLayoutContext = createContext<SidebarLayoutContextValue | null>(null);

function readCollapsedPreference() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(STORAGE_KEY) === "true";
}

export function SidebarLayoutProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileNavShown, setMobileNavShown] = useState(false);

  useEffect(() => {
    setCollapsed(readCollapsedPreference());
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    if (!mobileNavShown) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileNavShown]);

  useEffect(() => {
    if (mobileOpen || !mobileNavShown) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setMobileNavShown(false);
    }, MOBILE_NAV_CLOSE_MS);

    return () => window.clearTimeout(timer);
  }, [mobileOpen, mobileNavShown]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => !current);
  }, []);

  const openMobileNav = useCallback(() => {
    setMobileNavShown(true);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setMobileOpen(true);
      });
    });
  }, []);

  const closeMobileNav = useCallback(() => {
    setMobileOpen(false);
  }, []);

  const toggleMobileNav = useCallback(() => {
    setMobileOpen((current) => {
      if (current) {
        return false;
      }

      setMobileNavShown(true);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setMobileOpen(true);
        });
      });
      return false;
    });
  }, []);

  return (
    <SidebarLayoutContext.Provider
      value={{
        collapsed,
        toggleCollapsed,
        mobileOpen,
        mobileNavShown,
        openMobileNav,
        closeMobileNav,
        toggleMobileNav,
      }}
    >
      {children}
    </SidebarLayoutContext.Provider>
  );
}

export function useSidebarLayout() {
  const context = useContext(SidebarLayoutContext);

  if (!context) {
    throw new Error("useSidebarLayout must be used within SidebarLayoutProvider");
  }

  return context;
}
