"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import { cn } from "@/lib/utils";

export const TABLE_STICKY_HEADER_CLASS = "bg-slate-50 dark:bg-slate-800";

const DEFAULT_TABLE_CLASS =
  "min-w-max border-separate border-spacing-0 text-sm tabular-nums";

type ScrollableTableShellProps = {
  rowCount: number;
  thead: ReactNode;
  children: ReactNode;
  tfoot?: ReactNode;
  tableClassName?: string;
  className?: string;
  /** Extra classes for the body scroller (e.g. max-h + overflow-y-auto) */
  bodyClassName?: string;
  /** Keep body area from collapsing (e.g. while filtering current page). */
  bodyMinHeight?: number;
  scrollContainerRef?: Ref<HTMLDivElement>;
  showMobileHint?: boolean;
  overlay?: ReactNode;
  /** Stick header + top scrollbar under app chrome (window) or keep in flow */
  stickyHeader?: boolean;
  /**
   * Reuse the last measured column widths instead of remeasuring.
   * Use while client-side filtering/sorting so columns don't jump as rows reorder.
   */
  freezeColumnWidths?: boolean;
  /**
   * When this value changes (e.g. new page of rows), discard frozen widths and remasure.
   * Row reorder / filter on the same page should keep the same key.
   */
  columnLayoutKey?: string | number;
};

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  (ref as { current: T | null }).current = value;
}

function ensureColgroup(table: HTMLTableElement, widths: string[]) {
  let colgroup = table.querySelector("colgroup[data-scroll-sync]");
  if (!colgroup) {
    colgroup = document.createElement("colgroup");
    colgroup.setAttribute("data-scroll-sync", "true");
    table.insertBefore(colgroup, table.firstChild);
  }

  while (colgroup.children.length < widths.length) {
    colgroup.appendChild(document.createElement("col"));
  }
  while (colgroup.children.length > widths.length) {
    colgroup.lastChild?.remove();
  }

  widths.forEach((width, index) => {
    const col = colgroup.children[index] as HTMLElement;
    col.style.width = width;
    col.style.minWidth = width.endsWith("%") ? "" : width;
  });
}

function clearSyncColgroup(table: HTMLTableElement) {
  table.querySelector("colgroup[data-scroll-sync]")?.remove();
  table.style.width = "max-content";
  table.style.minWidth = "";
}

function readRowWidths(row: Element | null, widths: number[]) {
  if (!row) return;
  let columnIndex = 0;
  Array.from(row.children).forEach((cell) => {
    const element = cell as HTMLTableCellElement;
    const span = Math.max(1, element.colSpan || 1);
    if (span === 1) {
      widths[columnIndex] = Math.max(
        widths[columnIndex] ?? 0,
        element.getBoundingClientRect().width
      );
    }
    columnIndex += span;
  });
}

function measureColumnWidths(
  headerTable: HTMLTableElement,
  bodyTable: HTMLTableElement,
  footerTable: HTMLTableElement | null
) {
  clearSyncColgroup(headerTable);
  clearSyncColgroup(bodyTable);
  if (footerTable) clearSyncColgroup(footerTable);

  headerTable.style.transform = "";
  if (footerTable) footerTable.style.transform = "";

  const headerRow = headerTable.querySelector("thead tr");
  const bodyRows = Array.from(bodyTable.querySelectorAll("tbody tr"))
    .filter((row) =>
      Array.from(row.children).every((cell) => ((cell as HTMLTableCellElement).colSpan || 1) === 1)
    )
    .slice(0, 8);
  const footerRow = footerTable?.querySelector("tfoot tr") ?? null;

  const columnCount = Math.max(
    headerRow?.children.length ?? 0,
    ...bodyRows.map((row) => row.children.length),
    footerRow?.children.length ?? 0,
    0
  );
  if (columnCount === 0) return [] as number[];

  const widths: number[] = Array.from({ length: columnCount }, () => 0);
  readRowWidths(headerRow, widths);
  bodyRows.forEach((row) => readRowWidths(row, widths));
  readRowWidths(footerRow, widths);

  return widths.map((width) => Math.ceil(width));
}

/**
 * Dual-table shell with one horizontal scroll source of truth (body).
 * Header/footer do NOT scroll independently — they follow via translateX.
 * Top scrollbar mirrors body.scrollLeft for usability.
 */
export function ScrollableTableShell({
  rowCount: _rowCount,
  thead,
  children,
  tfoot,
  tableClassName,
  className,
  bodyClassName,
  bodyMinHeight,
  scrollContainerRef,
  showMobileHint = false,
  overlay,
  stickyHeader = false,
  freezeColumnWidths = false,
  columnLayoutKey,
}: ScrollableTableShellProps) {
  const topScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const headerClipRef = useRef<HTMLDivElement>(null);
  const footerClipRef = useRef<HTMLDivElement>(null);
  const headerTableRef = useRef<HTMLTableElement>(null);
  const bodyTableRef = useRef<HTMLTableElement>(null);
  const footerTableRef = useRef<HTMLTableElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const syncingLayoutRef = useRef(false);
  const syncingScrollRef = useRef(false);
  const scrollLeftRef = useRef(0);
  const frozenWidthsRef = useRef<number[] | null>(null);
  const [hasHorizontalOverflow, setHasHorizontalOverflow] = useState(false);
  const [stickyTop, setStickyTop] = useState(0);

  const mergedTableClassName = cn(DEFAULT_TABLE_CLASS, tableClassName);

  const setBodyNode = useCallback(
    (node: HTMLDivElement | null) => {
      bodyScrollRef.current = node;
      assignRef(scrollContainerRef, node);
    },
    [scrollContainerRef]
  );

  const applyScrollLeft = useCallback((left: number) => {
    const next = Math.max(0, left);
    scrollLeftRef.current = next;

    const bodyScroll = bodyScrollRef.current;
    const topScroll = topScrollRef.current;
    const headerTable = headerTableRef.current;
    const footerTable = footerTableRef.current;

    if (bodyScroll && Math.abs(bodyScroll.scrollLeft - next) > 0.5) {
      bodyScroll.scrollLeft = next;
    }
    if (topScroll && Math.abs(topScroll.scrollLeft - next) > 0.5) {
      topScroll.scrollLeft = next;
    }
    if (headerTable) {
      headerTable.style.transform = next > 0 ? `translate3d(${-next}px, 0, 0)` : "";
    }
    if (footerTable) {
      footerTable.style.transform = next > 0 ? `translate3d(${-next}px, 0, 0)` : "";
    }
  }, []);

  const syncLayout = useCallback(() => {
    if (syncingLayoutRef.current) return;

    const headerTable = headerTableRef.current;
    const bodyTable = bodyTableRef.current;
    const footerTable = footerTableRef.current;
    const bodyScroll = bodyScrollRef.current;
    const topScroll = topScrollRef.current;
    const spacer = spacerRef.current;
    if (!headerTable || !bodyTable || !bodyScroll || !topScroll || !spacer) return;

    syncingLayoutRef.current = true;
    try {
      const preservedLeft = scrollLeftRef.current || bodyScroll.scrollLeft;
      const frozen = freezeColumnWidths ? frozenWidthsRef.current : null;
      const widths =
        frozen && frozen.length > 0
          ? frozen
          : measureColumnWidths(headerTable, bodyTable, footerTable);
      if (widths.length === 0) return;

      if (!freezeColumnWidths || !frozenWidthsRef.current?.length) {
        frozenWidthsRef.current = widths;
      }

      const measuredTotal = widths.reduce((sum, width) => sum + width, 0);
      const containerWidth = bodyScroll.clientWidth;
      const needsHorizontalScroll = measuredTotal > containerWidth + 1;

      if (needsHorizontalScroll) {
        const pxWidths = widths.map((width) => `${width}px`);
        ensureColgroup(headerTable, pxWidths);
        ensureColgroup(bodyTable, pxWidths);
        if (footerTable) ensureColgroup(footerTable, pxWidths);

        // Lock all tables + top spacer to the same pixel width (body is truth).
        headerTable.style.width = `${measuredTotal}px`;
        headerTable.style.minWidth = `${measuredTotal}px`;
        bodyTable.style.width = `${measuredTotal}px`;
        bodyTable.style.minWidth = `${measuredTotal}px`;
        if (footerTable) {
          footerTable.style.width = `${measuredTotal}px`;
          footerTable.style.minWidth = `${measuredTotal}px`;
        }

        const syncedWidth = Math.max(
          measuredTotal,
          bodyTable.scrollWidth,
          headerTable.scrollWidth,
          footerTable?.scrollWidth ?? 0
        );
        const syncedPx = `${syncedWidth}px`;
        headerTable.style.width = syncedPx;
        headerTable.style.minWidth = syncedPx;
        bodyTable.style.width = syncedPx;
        bodyTable.style.minWidth = syncedPx;
        if (footerTable) {
          footerTable.style.width = syncedPx;
          footerTable.style.minWidth = syncedPx;
        }
        spacer.style.width = syncedPx;
        spacer.style.minWidth = syncedPx;
      } else {
        const pctWidths = widths.map((width) => `${((width / measuredTotal) * 100).toFixed(4)}%`);
        ensureColgroup(headerTable, pctWidths);
        ensureColgroup(bodyTable, pctWidths);
        if (footerTable) ensureColgroup(footerTable, pctWidths);
        headerTable.style.width = "100%";
        headerTable.style.minWidth = "";
        bodyTable.style.width = "100%";
        bodyTable.style.minWidth = "";
        if (footerTable) {
          footerTable.style.width = "100%";
          footerTable.style.minWidth = "";
        }
        spacer.style.width = "100%";
        spacer.style.minWidth = "";
      }

      topScroll.style.height = needsHorizontalScroll ? "14px" : "0px";
      topScroll.style.borderBottomWidth = needsHorizontalScroll ? "1px" : "0px";
      topScroll.style.opacity = needsHorizontalScroll ? "1" : "0";
      topScroll.style.pointerEvents = needsHorizontalScroll ? "auto" : "none";

      setHasHorizontalOverflow((current) =>
        current === needsHorizontalScroll ? current : needsHorizontalScroll
      );

      // Re-apply shared scroll after width changes (clamp automatically via browser).
      applyScrollLeft(needsHorizontalScroll ? preservedLeft : 0);
    } finally {
      requestAnimationFrame(() => {
        syncingLayoutRef.current = false;
      });
    }
  }, [applyScrollLeft, freezeColumnWidths]);

  const previousLayoutKeyRef = useRef(columnLayoutKey);

  useLayoutEffect(() => {
    if (previousLayoutKeyRef.current !== columnLayoutKey) {
      frozenWidthsRef.current = null;
      previousLayoutKeyRef.current = columnLayoutKey;
    }
    syncLayout();
  }, [children, thead, tfoot, freezeColumnWidths, columnLayoutKey, syncLayout]);

  useEffect(() => {
    const bodyScroll = bodyScrollRef.current;
    const topScroll = topScrollRef.current;
    const headerClip = headerClipRef.current;
    const footerClip = footerClipRef.current;
    if (!bodyScroll || !topScroll) return;

    const onBodyScroll = () => {
      if (syncingScrollRef.current || syncingLayoutRef.current) return;
      syncingScrollRef.current = true;
      applyScrollLeft(bodyScroll.scrollLeft);
      requestAnimationFrame(() => {
        syncingScrollRef.current = false;
      });
    };

    const onTopScroll = () => {
      if (syncingScrollRef.current || syncingLayoutRef.current) return;
      syncingScrollRef.current = true;
      applyScrollLeft(topScroll.scrollLeft);
      requestAnimationFrame(() => {
        syncingScrollRef.current = false;
      });
    };

    const forwardWheel = (event: WheelEvent) => {
      const mostlyHorizontal =
        Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.shiftKey;
      if (!mostlyHorizontal) return;
      event.preventDefault();
      const delta = event.shiftKey && event.deltaX === 0 ? event.deltaY : event.deltaX;
      applyScrollLeft(bodyScroll.scrollLeft + delta);
    };

    bodyScroll.addEventListener("scroll", onBodyScroll, { passive: true });
    topScroll.addEventListener("scroll", onTopScroll, { passive: true });
    headerClip?.addEventListener("wheel", forwardWheel, { passive: false });
    footerClip?.addEventListener("wheel", forwardWheel, { passive: false });

    const observer = new ResizeObserver(() => {
      // Avoid remeasure thrash while column widths are frozen (e.g. page filter).
      if (syncingLayoutRef.current || freezeColumnWidths) return;
      syncLayout();
    });
    observer.observe(bodyScroll);
    if (bodyTableRef.current) observer.observe(bodyTableRef.current);
    if (headerClip) observer.observe(headerClip);

    window.addEventListener("resize", syncLayout);
    window.visualViewport?.addEventListener("resize", syncLayout);

    return () => {
      bodyScroll.removeEventListener("scroll", onBodyScroll);
      topScroll.removeEventListener("scroll", onTopScroll);
      headerClip?.removeEventListener("wheel", forwardWheel);
      footerClip?.removeEventListener("wheel", forwardWheel);
      observer.disconnect();
      window.removeEventListener("resize", syncLayout);
      window.visualViewport?.removeEventListener("resize", syncLayout);
    };
  }, [applyScrollLeft, freezeColumnWidths, syncLayout, tfoot]);

  useEffect(() => {
    if (!stickyHeader) {
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
  }, [stickyHeader]);

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900",
        className
      )}
    >
      {showMobileHint ? (
        <p className="border-b border-slate-200 px-3 py-2 text-xs text-slate-500 sm:hidden dark:border-slate-700 dark:text-slate-400">
          Swipe horizontally to see more columns
        </p>
      ) : null}

      <div className="relative">
        {overlay}

        <div
          className={cn(
            "border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800",
            stickyHeader &&
              "sticky z-20 shadow-[0_1px_0_0_rgb(226_232_240)] dark:shadow-[0_1px_0_0_rgb(51_65_85)]"
          )}
          style={stickyHeader ? { top: stickyTop } : undefined}
        >
          {/* Header is clipped + translated — never an independent H-scroller. */}
          <div ref={headerClipRef} className="overflow-hidden">
            <table ref={headerTableRef} className={cn(mergedTableClassName, "will-change-transform")}>
              <thead className="bg-slate-50 dark:bg-slate-800">{thead}</thead>
            </table>
          </div>

          <div
            ref={topScrollRef}
            className="table-scroll-top shrink-0 overflow-x-auto overflow-y-hidden overscroll-x-contain border-b border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
            style={{ height: 0, borderBottomWidth: 0, opacity: 0 }}
            aria-hidden={!hasHorizontalOverflow}
          >
            <div ref={spacerRef} className="h-px" />
          </div>
        </div>

        <div
          ref={setBodyNode}
          className={cn("table-scroll-top overflow-x-auto overscroll-x-contain", bodyClassName)}
          style={bodyMinHeight && bodyMinHeight > 0 ? { minHeight: bodyMinHeight } : undefined}
        >
          <table ref={bodyTableRef} className={mergedTableClassName}>
            {children}
          </table>
        </div>

        {tfoot ? (
          <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
            <div ref={footerClipRef} className="overflow-hidden">
              <table ref={footerTableRef} className={cn(mergedTableClassName, "will-change-transform")}>
                {tfoot}
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
