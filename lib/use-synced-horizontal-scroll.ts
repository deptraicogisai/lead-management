"use client";

import { useEffect, type RefObject } from "react";

/**
 * Keep horizontal scroll positions identical across overflow-x containers.
 * Absolute scrollLeft — not ratio — so table columns stay locked.
 */
export function useSyncedHorizontalScroll(
  refs: Array<RefObject<HTMLElement | null>>,
  remountKey: string | number | boolean = true
) {
  useEffect(() => {
    const nodes = refs
      .map((ref) => ref.current)
      .filter((node): node is HTMLElement => Boolean(node));

    if (nodes.length < 2) return;

    let syncing = false;
    let unlockFrame: number | null = null;
    let lastScrollLeft = 0;

    const applyScrollLeft = (left: number, source?: HTMLElement) => {
      const nextLeft = Math.max(0, left);
      lastScrollLeft = nextLeft;
      for (const node of nodes) {
        if (node === source) continue;
        if (Math.abs(node.scrollLeft - nextLeft) > 0.5) {
          node.scrollLeft = nextLeft;
        }
      }
    };

    const syncFrom = (source: HTMLElement) => {
      if (syncing) return;
      syncing = true;
      applyScrollLeft(source.scrollLeft, source);

      if (unlockFrame != null) cancelAnimationFrame(unlockFrame);
      unlockFrame = requestAnimationFrame(() => {
        unlockFrame = requestAnimationFrame(() => {
          syncing = false;
          unlockFrame = null;
        });
      });
    };

    const realign = () => {
      syncing = true;
      const dominant = nodes.reduce((best, node) =>
        node.scrollLeft > best.scrollLeft ? node : best
      );
      const preferred = lastScrollLeft > 0.5 ? lastScrollLeft : dominant.scrollLeft;
      applyScrollLeft(preferred);
      requestAnimationFrame(() => {
        syncing = false;
      });
    };

    const cleanups = nodes.map((node) => {
      const onScroll = () => syncFrom(node);
      node.addEventListener("scroll", onScroll, { passive: true });
      return () => node.removeEventListener("scroll", onScroll);
    });

    window.addEventListener("resize", realign);
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", realign);
    viewport?.addEventListener("scroll", realign);

    const resizeObserver = new ResizeObserver(() => realign());
    for (const node of nodes) {
      resizeObserver.observe(node);
      if (node.firstElementChild) resizeObserver.observe(node.firstElementChild);
    }

    realign();

    return () => {
      for (const cleanup of cleanups) cleanup();
      window.removeEventListener("resize", realign);
      viewport?.removeEventListener("resize", realign);
      viewport?.removeEventListener("scroll", realign);
      resizeObserver.disconnect();
      if (unlockFrame != null) cancelAnimationFrame(unlockFrame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remountKey]);
}
