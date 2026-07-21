"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useTableStickyHeader(enabled: boolean) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const stickyTopRef = useRef(0);
  const [stickyTop, setStickyTop] = useState(0);
  const [headerIsStuck, setHeaderIsStuck] = useState(false);

  stickyTopRef.current = stickyTop;

  const updateHeaderIsStuck = useCallback(() => {
    if (!enabled) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const stuck = sentinel.getBoundingClientRect().bottom <= stickyTopRef.current + 0.5;
    setHeaderIsStuck((current) => (current === stuck ? current : stuck));
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setStickyTop(0);
      return;
    }

    const chrome = document.querySelector<HTMLElement>(".mobile-app-header");
    if (!chrome) {
      setStickyTop(0);
      return;
    }

    const updateStickyTop = () => {
      setStickyTop(Math.ceil(chrome.getBoundingClientRect().height));
    };

    updateStickyTop();
    const observer = new ResizeObserver(updateStickyTop);
    observer.observe(chrome);
    window.addEventListener("resize", updateStickyTop);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateStickyTop);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setHeaderIsStuck(false);
      return;
    }

    let frame = 0;
    const scheduleUpdate = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        updateHeaderIsStuck();
      });
    };

    scheduleUpdate();
    window.addEventListener("scroll", scheduleUpdate, { passive: true, capture: true });
    window.addEventListener("resize", scheduleUpdate);
    window.visualViewport?.addEventListener("resize", scheduleUpdate);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleUpdate, { capture: true });
      window.removeEventListener("resize", scheduleUpdate);
      window.visualViewport?.removeEventListener("resize", scheduleUpdate);
    };
  }, [enabled, stickyTop, updateHeaderIsStuck]);

  return { sentinelRef, stickyTop, headerIsStuck, updateHeaderIsStuck };
}
