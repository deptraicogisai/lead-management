"use client";

import { useEffect } from "react";
import { resetSystemFontScale } from "@/components/settings/system-settings-context";

/** Ensures System Font Size never affects the login screen. */
export function LoginFontScaleGuard() {
  useEffect(() => {
    resetSystemFontScale();
  }, []);

  return null;
}
