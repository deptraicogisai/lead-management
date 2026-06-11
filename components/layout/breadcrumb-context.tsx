"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type BreadcrumbContextValue = {
  overrideLabel: string | null;
  setOverrideLabel: (label: string | null) => void;
};

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [overrideLabel, setOverrideLabel] = useState<string | null>(null);

  useEffect(() => {
    setOverrideLabel(null);
  }, [pathname]);

  const value = useMemo(
    () => ({
      overrideLabel,
      setOverrideLabel,
    }),
    [overrideLabel]
  );

  return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>;
}

export function useBreadcrumbOverride() {
  return useContext(BreadcrumbContext)?.overrideLabel ?? null;
}

export function useBreadcrumbLabel(label: string | null | undefined) {
  const context = useContext(BreadcrumbContext);

  useEffect(() => {
    if (!context) return undefined;

    const trimmed = label?.trim();
    context.setOverrideLabel(trimmed || null);
    return () => context.setOverrideLabel(null);
  }, [context, label]);
}
