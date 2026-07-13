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
  "w-full border-separate border-spacing-0 text-sm tabular-nums";

type ScrollableTableShellProps = {
  rowCount: number;
  thead: ReactNode;
  children: ReactNode;
  tfoot?: ReactNode;
  tableClassName?: string;
  className?: string;
  scrollContainerRef?: Ref<HTMLDivElement>;
  showMobileHint?: boolean;
  overlay?: ReactNode;
  /** window = stick under app chrome; local = stick inside nearest scroll parent */
  stickyMode?: "window" | "local";
};

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  (ref as { current: T | null }).current = value;
}

function ensureColgroup(table: HTMLTableElement, widths: number[]) {
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
    col.style.width = `${width}px`;
    col.style.minWidth = `${width}px`;
  });
}

function clearSyncColgroup(table: HTMLTableElement) {
  table.querySelector("colgroup[data-scroll-sync]")?.remove();
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
  const bodyRows = Array.from(bodyTable.querySelectorAll("tbody tr")).slice(0, 8);
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
  scrollContainerRef,
  showMobileHint = true,
  overlay,
  stickyMode = "window",
}: ScrollableTableShellProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const footerScrollRef = useRef<HTMLDivElement>(null);
  const headerTableRef = useRef<HTMLTableElement>(null);
  const bodyTableRef = useRef<HTMLTableElement>(null);
  const footerTableRef = useRef<HTMLTableElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);
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

  const syncScrollLeft = useCallback((source: HTMLDivElement) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    const left = source.scrollLeft;
    for (const target of [
      headerScrollRef.current,
      topScrollRef.current,
      bodyScrollRef.current,
      footerScrollRef.current,
    ]) {
      if (target && target !== source) {
        target.scrollLeft = left;
      }
    }
    syncingRef.current = false;
  }, []);

  const syncLayout = useCallback(() => {
    const headerTable = headerTableRef.current;
    const bodyTable = bodyTableRef.current;
    const footerTable = footerTableRef.current;
    const bodyScroll = bodyScrollRef.current;
    const spacer = spacerRef.current;
    if (!headerTable || !bodyTable || !bodyScroll || !spacer) return;

    const widths = measureColumnWidths(headerTable, bodyTable, footerTable);
    if (widths.length === 0) return;

    const totalWidth = widths.reduce((sum, width) => sum + width, 0);
    const containerWidth = bodyScroll.clientWidth;
    const needsHorizontalScroll = totalWidth > containerWidth + 1;

    if (needsHorizontalScroll) {
      ensureColgroup(headerTable, widths);
      ensureColgroup(bodyTable, widths);
      if (footerTable) ensureColgroup(footerTable, widths);
      headerTable.style.width = `${totalWidth}px`;
      bodyTable.style.width = `${totalWidth}px`;
      if (footerTable) footerTable.style.width = `${totalWidth}px`;
      spacer.style.width = `${totalWidth}px`;
    } else {
      clearSyncColgroup(headerTable);
      clearSyncColgroup(bodyTable);
      if (footerTable) clearSyncColgroup(footerTable);
      headerTable.style.width = "100%";
      bodyTable.style.width = "100%";
      if (footerTable) footerTable.style.width = "100%";
      spacer.style.width = "100%";
    }

    setHasHorizontalOverflow(needsHorizontalScroll);
  }, []);

  useLayoutEffect(() => {
    syncLayout();
  }, [children, thead, tfoot, syncLayout]);

  useEffect(() => {
    const bodyScroll = bodyScrollRef.current;
    const headerTable = headerTableRef.current;
    const bodyTable = bodyTableRef.current;
    const footerTable = footerTableRef.current;
    if (!bodyScroll) return;

    const observer = new ResizeObserver(() => syncLayout());
    observer.observe(bodyScroll);
    if (headerTable) observer.observe(headerTable);
    if (bodyTable) observer.observe(bodyTable);
    if (footerTable) observer.observe(footerTable);

    window.addEventListener("resize", syncLayout);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncLayout);
    };
  }, [syncLayout, tfoot]);

  useEffect(() => {
    if (stickyMode !== "window") {
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
  }, [stickyMode]);

  return (
    <div
      ref={shellRef}
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
          className="sticky z-20 border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
          style={{ top: stickyTop }}
        >
          <div
            ref={headerScrollRef}
            className="table-scroll-hide-bar overflow-x-auto overflow-y-hidden overscroll-x-contain"
            onScroll={(event) => syncScrollLeft(event.currentTarget)}
          >
            <table ref={headerTableRef} className={mergedTableClassName}>
              {thead}
            </table>
          </div>

          <div
            ref={topScrollRef}
            className={cn(
              "table-scroll-thin overflow-x-auto overflow-y-hidden",
              hasHorizontalOverflow ? "block" : "hidden"
            )}
            onScroll={(event) => syncScrollLeft(event.currentTarget)}
            aria-hidden={!hasHorizontalOverflow}
          >
            <div ref={spacerRef} className="h-px" />
          </div>
        </div>

        <div
          ref={setBodyNode}
          className={cn(
            "overscroll-x-contain",
            hasHorizontalOverflow ? "table-scroll-thin overflow-x-auto" : "overflow-x-hidden"
          )}
          onScroll={(event) => syncScrollLeft(event.currentTarget)}
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
              onScroll={(event) => syncScrollLeft(event.currentTarget)}
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
