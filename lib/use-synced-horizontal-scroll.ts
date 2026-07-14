"use client";

import { useEffect, type RefObject } from "react";

function maxScrollLeft(node: HTMLElement) {
  return Math.max(0, node.scrollWidth - node.clientWidth);
}

/**
 * Keep multiple overflow-x containers visually aligned.
 * Uses scroll ratio so zoom / sub-pixel width differences stay in sync.
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
    let lastRatio = 0;

    const applyRatio = (ratio: number, source?: HTMLElement) => {
      const clamped = Math.min(1, Math.max(0, ratio));
      lastRatio = clamped;
      for (const node of nodes) {
        if (node === source) continue;
        const max = maxScrollLeft(node);
        const next = clamped * max;
        if (Math.abs(node.scrollLeft - next) > 0.5) {
          node.scrollLeft = next;
        }
      }
    };

    const syncFrom = (source: HTMLElement) => {
      if (syncing) return;
      syncing = true;

      const max = maxScrollLeft(source);
      const ratio = max > 0 ? source.scrollLeft / max : 0;
      applyRatio(ratio, source);

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
      applyRatio(lastRatio);
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

    return () => {
      for (const cleanup of cleanups) cleanup();
      window.removeEventListener("resize", realign);
      viewport?.removeEventListener("resize", realign);
      viewport?.removeEventListener("scroll", realign);
      resizeObserver.disconnect();
      if (unlockFrame != null) cancelAnimationFrame(unlockFrame);
    };
    // refs are stable; remountKey controls when to rebind (e.g. overflow toggled)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remountKey]);
}
