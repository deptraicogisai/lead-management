"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function getScrollParents(el: HTMLElement | null): Array<HTMLElement | Window> {
  const parents: Array<HTMLElement | Window> = [window];
  let node = el?.parentElement ?? null;

  while (node && node !== document.body && node !== document.documentElement) {
    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;
    if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
      parents.push(node);
    }
    node = node.parentElement;
  }

  return parents;
}

export function useTableStickyHeader(enabled: boolean, extraOffset = 0) {
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
      setStickyTop(Math.max(0, Math.ceil(extraOffset)));
      return;
    }

    const updateStickyTop = () => {
      setStickyTop(Math.ceil(chrome.getBoundingClientRect().height) + Math.max(0, Math.ceil(extraOffset)));
    };

    updateStickyTop();
    const observer = new ResizeObserver(updateStickyTop);
    observer.observe(chrome);
    window.addEventListener("resize", updateStickyTop);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateStickyTop);
    };
  }, [enabled, extraOffset]);

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

    const scrollParents = getScrollParents(sentinelRef.current);
    for (const parent of scrollParents) {
      parent.addEventListener("scroll", scheduleUpdate, { passive: true });
    }
    window.addEventListener("resize", scheduleUpdate);
    window.visualViewport?.addEventListener("resize", scheduleUpdate);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      for (const parent of scrollParents) {
        parent.removeEventListener("scroll", scheduleUpdate);
      }
      window.removeEventListener("resize", scheduleUpdate);
      window.visualViewport?.removeEventListener("resize", scheduleUpdate);
    };
  }, [enabled, stickyTop, updateHeaderIsStuck]);

  return { sentinelRef, stickyTop, headerIsStuck, updateHeaderIsStuck };
}
