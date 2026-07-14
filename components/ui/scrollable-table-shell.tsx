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
import { useSyncedHorizontalScroll } from "@/lib/use-synced-horizontal-scroll";
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
  scrollContainerRef?: Ref<HTMLDivElement>;
  showMobileHint?: boolean;
  overlay?: ReactNode;
  /** Stick header + top scrollbar under app chrome (window) or keep in flow */
  stickyHeader?: boolean;
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
  // Measure against intrinsic content width (avoid stretched w-full columns).
  table.style.width = "max-content";
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

  const headerRow = headerTable.querySelector("thead tr");
  // Skip group/summary rows with colspan so they do not inflate measured widths.
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

export function ScrollableTableShell({
  rowCount: _rowCount,
  thead,
  children,
  tfoot,
  tableClassName,
  className,
  bodyClassName,
  scrollContainerRef,
  showMobileHint = false,
  overlay,
  stickyHeader = false,
}: ScrollableTableShellProps) {
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const footerScrollRef = useRef<HTMLDivElement>(null);
  const headerTableRef = useRef<HTMLTableElement>(null);
  const bodyTableRef = useRef<HTMLTableElement>(null);
  const footerTableRef = useRef<HTMLTableElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const syncingLayoutRef = useRef(false);
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

  // Header/footer use overflow scroll (hidden bar) — no transform, so stickyHeader keeps working.
  useSyncedHorizontalScroll(
    [headerScrollRef, topScrollRef, bodyScrollRef, footerScrollRef],
    `${hasHorizontalOverflow}:${Boolean(tfoot)}`
  );

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
      const widths = measureColumnWidths(headerTable, bodyTable, footerTable);
      if (widths.length === 0) return;

      const totalWidth = widths.reduce((sum, width) => sum + width, 0);
      const containerWidth = bodyScroll.clientWidth;
      const needsHorizontalScroll = totalWidth > containerWidth + 1;

      if (needsHorizontalScroll) {
        const pxWidths = widths.map((width) => `${width}px`);
        ensureColgroup(headerTable, pxWidths);
        ensureColgroup(bodyTable, pxWidths);
        if (footerTable) ensureColgroup(footerTable, pxWidths);
        // Measured total only — avoid scrollWidth feedback loops.
        const px = `${totalWidth}px`;
        headerTable.style.width = px;
        bodyTable.style.width = px;
        if (footerTable) footerTable.style.width = px;
        spacer.style.width = px;
        spacer.style.minWidth = px;
      } else {
        const pctWidths = widths.map((width) => `${((width / totalWidth) * 100).toFixed(4)}%`);
        ensureColgroup(headerTable, pctWidths);
        ensureColgroup(bodyTable, pctWidths);
        if (footerTable) ensureColgroup(footerTable, pctWidths);
        headerTable.style.width = "100%";
        bodyTable.style.width = "100%";
        if (footerTable) footerTable.style.width = "100%";
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

      const left = bodyScroll.scrollLeft;
      for (const target of [
        headerScrollRef.current,
        topScroll,
        bodyScroll,
        footerScrollRef.current,
      ]) {
        if (target && Math.abs(target.scrollLeft - left) > 0.5) {
          target.scrollLeft = left;
        }
      }
    } finally {
      requestAnimationFrame(() => {
        syncingLayoutRef.current = false;
      });
    }
  }, []);

  useLayoutEffect(() => {
    syncLayout();
  }, [children, thead, tfoot, syncLayout]);

  useEffect(() => {
    const bodyScroll = bodyScrollRef.current;
    if (!bodyScroll) return;

    const observer = new ResizeObserver(() => {
      if (syncingLayoutRef.current) return;
      syncLayout();
    });
    observer.observe(bodyScroll);

    window.addEventListener("resize", syncLayout);
    window.visualViewport?.addEventListener("resize", syncLayout);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncLayout);
      window.visualViewport?.removeEventListener("resize", syncLayout);
    };
  }, [syncLayout, tfoot]);

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
        // Do not use overflow-hidden here — it breaks position:sticky for stickyHeader lists.
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
          <div
            ref={headerScrollRef}
            className="table-scroll-hide-bar overflow-x-auto overflow-y-hidden overscroll-x-contain"
          >
            <table ref={headerTableRef} className={mergedTableClassName}>
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
          className={cn(
            "overscroll-x-contain",
            // Same scrollbar skin as the top bar so max-scroll / thumb size stay aligned.
            hasHorizontalOverflow ? "table-scroll-top overflow-x-auto" : "overflow-x-hidden",
            bodyClassName
          )}
        >
          <table ref={bodyTableRef} className={mergedTableClassName}>
            {children}
          </table>
        </div>

        {tfoot ? (
          <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
            <div
              ref={footerScrollRef}
              className="table-scroll-hide-bar overflow-x-auto overflow-y-hidden overscroll-x-contain"
            >
              <table ref={footerTableRef} className={mergedTableClassName}>
                {tfoot}
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
