"use client";

import { GripVertical } from "lucide-react";
import {
  ReactNode,
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SortableColumnHeader } from "@/components/ui/sortable-column-header";
import { ScrollableTableShell } from "@/components/ui/scrollable-table-shell";
import { reorderIds } from "@/lib/reorder-fields";
import { filterRowsByQuery } from "@/lib/table-filter";
import { sortTableRows, type SortDirection, type TableSortState } from "@/lib/table-sort";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: keyof T | string;
  label: ReactNode;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  sortValue?: (row: T) => string | number | null | undefined;
  headerClassName?: string;
  className?: string;
  /** Minimum column width in pixels after layout measure. */
  minWidth?: number;
  /** Maximum column width in pixels after layout measure. */
  maxWidth?: number;
};

function isColumnSortable<T>(column: Column<T>) {
  if (column.sortable === false) return false;
  if (String(column.key) === "actions") return false;
  return true;
}

function hasEvenStripe(id: string) {
  let checksum = 0;

  for (let index = 0; index < id.length; index += 1) {
    checksum += id.charCodeAt(index);
  }

  return checksum % 2 === 0;
}

function getColumnSortValue<T>(row: T, column: Column<T>) {
  if (column.sortValue) {
    return column.sortValue(row);
  }

  const value = row[column.key as keyof T];
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

type DragSession = {
  rowId: string;
  pointerId: number;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  emptyMessage: string;
  selectedRowIds?: string[];
  onToggleRow?: (rowId: string) => void;
  onToggleAllRows?: (checked: boolean) => void;
  rowReorder?: {
    onReorder: (orderedIds: string[]) => void | Promise<void>;
    disabled?: boolean;
  };
  defaultSort?: TableSortState;
  /** Stick thead under the app chrome while the window scrolls (ScrollableTableShell only). */
  stickyHeader?: boolean;
  /**
   * Use the dual-table ScrollableTableShell (wide report tables + sticky header).
   * Set false for compact admin grids where a single table keeps columns aligned (no sticky).
   */
  scrollShell?: boolean;
  /** Client-side filter against the currently loaded rows (current page). */
  filterQuery?: string;
};

function resolveRowDropTarget(tbody: HTMLElement, clientY: number) {
  const rowElements = Array.from(tbody.querySelectorAll<HTMLElement>("[data-reorder-row-id]"));

  if (rowElements.length === 0) {
    return null;
  }

  for (const rowElement of rowElements) {
    const rect = rowElement.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;

    if (clientY < midpoint) {
      return rowElement.dataset.reorderRowId ?? null;
    }
  }

  return rowElements[rowElements.length - 1]?.dataset.reorderRowId ?? null;
}

function RowDropIndicator({ top }: { top: number }) {
  return (
    <div className="pointer-events-none absolute inset-x-2 z-20 flex items-center gap-2" style={{ top }}>
      <div className="h-0.5 flex-1 rounded-full bg-blue-500 dark:bg-blue-400" />
      <span className="rounded bg-blue-600 px-2 py-0.5 text-[11px] font-medium text-white shadow-sm dark:bg-blue-500">
        Drop here
      </span>
      <div className="h-0.5 flex-1 rounded-full bg-blue-500 dark:bg-blue-400" />
    </div>
  );
}

function renderCellContent<T>(row: T, column: Column<T>) {
  if (column.render) {
    return column.render(row);
  }

  const value = row[column.key as keyof T];
  return value === undefined || value === null ? "" : String(value);
}

const CHECKBOX_INPUT_CLASS =
  "m-0 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-500 dark:bg-slate-900";

const CHECKBOX_HEADER_CELL_CLASS =
  "relative w-14 border-b border-slate-200 px-3 py-2 sm:px-4 sm:py-2.5 dark:border-slate-600";

const CHECKBOX_BODY_CELL_CLASS =
  "relative w-14 border-b border-slate-100 px-3 py-2 sm:px-4 sm:py-2.5 dark:border-slate-700/80";

function CheckboxCell({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: () => void;
  ariaLabel: string;
}) {
  return (
    <label className="absolute inset-0 flex cursor-pointer items-center justify-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        aria-label={ariaLabel}
        className={CHECKBOX_INPUT_CLASS}
      />
    </label>
  );
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  emptyMessage,
  selectedRowIds = [],
  onToggleRow,
  onToggleAllRows,
  rowReorder,
  defaultSort,
  stickyHeader = true,
  scrollShell = true,
  filterQuery = "",
}: DataTableProps<T>) {
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Sticky thead inside overflow-x-auto breaks (header floats mid-table). Compact grids stay non-sticky.
  const dragOverRowIdRef = useRef<string | null>(null);
  const dropTargetRef = useRef<string | null>(null);
  const stableBodyHeightRef = useRef(0);

  const [dragSession, setDragSession] = useState<DragSession | null>(null);
  const [dragOverRowId, setDragOverRowId] = useState<string | null>(null);
  const [pointerPosition, setPointerPosition] = useState<{ x: number; y: number } | null>(null);
  const [dropIndicatorTop, setDropIndicatorTop] = useState<number | null>(null);
  const [sortState, setSortState] = useState<TableSortState | null>(defaultSort ?? null);
  const [bodyMinHeight, setBodyMinHeight] = useState(0);

  const deferredFilterQuery = useDeferredValue(filterQuery);
  const isFilterPending = deferredFilterQuery !== filterQuery;
  const isFiltering = Boolean(filterQuery.trim());

  const isSelectable = Boolean(onToggleRow);
  const isReorderable = Boolean(rowReorder) && !rowReorder?.disabled;
  const isSortable = !isReorderable;
  const isDragging = Boolean(dragSession);
  const draggedRowId = dragSession?.rowId ?? null;
  const draggedRow = useMemo(
    () => (draggedRowId ? rows.find((row) => row.id === draggedRowId) ?? null : null),
    [draggedRowId, rows]
  );
  const selectedIds = new Set(selectedRowIds);

  const displayRows = useMemo(() => {
    const filtered = filterRowsByQuery(rows, columns, deferredFilterQuery);

    if (!isSortable || !sortState) return filtered;

    const column = columns.find((item) => String(item.key) === sortState.key);
    if (!column || !isColumnSortable(column)) return filtered;

    return sortTableRows(filtered, (row) => getColumnSortValue(row, column), sortState.direction);
  }, [columns, deferredFilterQuery, isSortable, rows, sortState]);

  useLayoutEffect(() => {
    const body = scrollContainerRef.current;
    if (!body) return;

    if (!isFiltering) {
      stableBodyHeightRef.current = body.offsetHeight;
      setBodyMinHeight(0);
      return;
    }

    setBodyMinHeight(stableBodyHeightRef.current);
  }, [isFiltering, rows]);

  const allRowsSelected = displayRows.length > 0 && displayRows.every((row) => selectedIds.has(row.id));

  const handleSort = useCallback((columnKey: string) => {
    startTransition(() => {
      setSortState((current) => {
        if (current?.key === columnKey) {
          const nextDirection: SortDirection = current.direction === "asc" ? "desc" : "asc";
          return { key: columnKey, direction: nextDirection };
        }

        return { key: columnKey, direction: "asc" };
      });
    });
  }, []);

  const setDropTarget = useCallback((rowId: string | null) => {
    if (dragOverRowIdRef.current === rowId) return;
    dragOverRowIdRef.current = rowId;
    dropTargetRef.current = rowId;
    setDragOverRowId(rowId);
  }, []);

  const clearDragState = useCallback(() => {
    dragOverRowIdRef.current = null;
    dropTargetRef.current = null;
    setDragSession(null);
    setDragOverRowId(null);
    setPointerPosition(null);
    setDropIndicatorTop(null);
  }, []);

  const updateDropTargetFromPointer = useCallback(
    (clientY: number) => {
      const tbody = tbodyRef.current;
      if (!tbody) return;
      setDropTarget(resolveRowDropTarget(tbody, clientY));
    },
    [setDropTarget]
  );

  const startPointerDrag = (rowId: string, event: React.PointerEvent<HTMLDivElement>) => {
    if (!isReorderable || event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    setDragSession({
      rowId,
      pointerId: event.pointerId,
    });
    setPointerPosition({ x: event.clientX, y: event.clientY });
    updateDropTargetFromPointer(event.clientY);
  };

  useEffect(() => {
    if (!dragSession || !rowReorder) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== dragSession.pointerId) return;
      setPointerPosition({ x: event.clientX, y: event.clientY });
      updateDropTargetFromPointer(event.clientY);
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId !== dragSession.pointerId) return;

      const tbody = tbodyRef.current;
      const targetRowId =
        dropTargetRef.current ?? (tbody ? resolveRowDropTarget(tbody, event.clientY) : null);

      if (targetRowId && targetRowId !== dragSession.rowId) {
        const orderedIds = reorderIds(
          rows.map((row) => row.id),
          dragSession.rowId,
          targetRowId
        );
        void rowReorder.onReorder(orderedIds);
      }

      clearDragState();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [clearDragState, dragSession, rowReorder, rows, updateDropTargetFromPointer]);

  useEffect(() => {
    if (!dragSession) return;

    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;

    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";

    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
    };
  }, [dragSession]);

  useLayoutEffect(() => {
    if (!isDragging || !dragOverRowId || dragOverRowId === draggedRowId) {
      setDropIndicatorTop(null);
      return;
    }

    const container = scrollContainerRef.current;
    const tbody = tbodyRef.current;
    if (!container || !tbody) {
      setDropIndicatorTop(null);
      return;
    }

    const rowElement = tbody.querySelector<HTMLElement>(`[data-reorder-row-id="${dragOverRowId}"]`);
    if (!rowElement) {
      setDropIndicatorTop(null);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const rowRect = rowElement.getBoundingClientRect();
    setDropIndicatorTop(rowRect.top - containerRect.top + container.scrollTop - 2);
  }, [dragOverRowId, draggedRowId, displayRows, isDragging]);

  const columnWidthHints = useMemo(
    () =>
      columns.map((column) => ({
        min: column.minWidth,
        max: column.maxWidth,
      })),
    [columns]
  );

  const columnLayoutKey = useMemo(
    () =>
      `${columns.length}:${columns.map((column) => String(column.key)).join(",")}|${rows
        .map((row) => row.id)
        .slice()
        .sort()
        .join("|")}`,
    [columns, rows]
  );

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
        {emptyMessage}
      </div>
    );
  }

  const headerRow = (
    <tr>
      {isReorderable ? (
        <th className="w-10 border-b border-slate-200 px-2 py-2 text-left sm:py-3 dark:border-slate-600" aria-label="Reorder" />
      ) : null}
      {isSelectable ? (
        <th className={CHECKBOX_HEADER_CELL_CLASS}>
          <CheckboxCell
            checked={allRowsSelected}
            onChange={() => onToggleAllRows?.(!allRowsSelected)}
            ariaLabel="Select all rows"
          />
        </th>
      ) : null}
      {columns.map((column) => {
        const columnKey = String(column.key);
        const columnSortable = isSortable && isColumnSortable(column);
        const isActiveSort = sortState?.key === columnKey;

        return (
          <th
            key={columnKey}
            className={cn(
              "border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700 sm:px-4 sm:py-2.5 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100",
              column.headerClassName
            )}
          >
            {columnSortable ? (
              <SortableColumnHeader
                label={column.label}
                active={isActiveSort}
                direction={isActiveSort ? sortState?.direction : undefined}
                onClick={() => handleSort(columnKey)}
              />
            ) : (
              column.label
            )}
          </th>
        );
      })}
    </tr>
  );

  const bodyRows =
    displayRows.length === 0 ? (
      <tr>
        <td
          colSpan={columns.length + (isSelectable ? 1 : 0) + (isReorderable ? 1 : 0)}
          className="border-b border-slate-100 px-3 py-8 text-center text-sm text-slate-500 dark:border-slate-700/80 dark:text-slate-400"
        >
          {deferredFilterQuery.trim() ? "No matching rows on this page." : emptyMessage}
        </td>
      </tr>
    ) : (
      displayRows.map((row) => {
        const isRowDragging = draggedRowId === row.id;
        const isDropTarget = dragOverRowId === row.id && draggedRowId !== row.id;
        const isEvenRow = hasEvenStripe(row.id);

        return (
          <tr
            key={row.id}
            data-reorder-row-id={isReorderable ? row.id : undefined}
            className={cn(
              isEvenRow ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-800/70",
              !isDragging && "hover:bg-blue-50/50 dark:hover:bg-blue-400/10",
              isRowDragging && "opacity-40",
              isDropTarget &&
                "bg-blue-50 shadow-[inset_0_0_0_2px_rgb(147,197,253)] dark:bg-blue-500/10 dark:shadow-[inset_0_0_0_2px_rgb(96,165,250)]"
            )}
          >
            {isReorderable ? (
              <td className="border-b border-slate-100 px-2 py-2 align-top sm:py-3 dark:border-slate-700/80">
                <div
                  data-drag-handle
                  data-dragging={isRowDragging ? "true" : undefined}
                  title="Drag to move"
                  style={{ touchAction: "none" }}
                  onPointerDown={(event) => startPointerDrag(row.id, event)}
                  aria-label={`Drag to reorder ${row.id}`}
                  className={cn(
                    "flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-full border bg-white text-slate-500 shadow-sm transition-colors",
                    isRowDragging
                      ? "border-blue-400 bg-blue-50 text-blue-600 ring-2 ring-blue-100 dark:border-blue-400 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-400/30"
                      : "border-slate-300 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                  )}
                >
                  <GripVertical size={14} strokeWidth={2.25} className="pointer-events-none" />
                </div>
              </td>
            ) : null}
            {isSelectable ? (
              <td className={CHECKBOX_BODY_CELL_CLASS}>
                <CheckboxCell
                  checked={selectedIds.has(row.id)}
                  onChange={() => onToggleRow?.(row.id)}
                  ariaLabel={`Select row ${row.id}`}
                />
              </td>
            ) : null}
            {columns.map((column) => (
              <td
                key={String(column.key)}
                className={cn(
                  "border-b border-slate-100 px-3 py-2 align-middle text-slate-600 sm:px-4 sm:py-2.5 dark:border-slate-700/80 dark:text-slate-200",
                  column.className
                )}
              >
                {renderCellContent(row, column)}
              </td>
            ))}
          </tr>
        );
      })
    );

  const tableContent = (
    <div
      className={cn(
        "transition-opacity duration-150 ease-out",
        isFilterPending && "opacity-70"
      )}
    >
      {scrollShell ? (
        <ScrollableTableShell
          rowCount={rows.length}
          stickyHeader={stickyHeader}
          scrollContainerRef={scrollContainerRef}
          freezeColumnWidths
          columnLayoutKey={columnLayoutKey}
          columnWidthHints={columnWidthHints}
          bodyMinHeight={isFiltering ? bodyMinHeight : undefined}
          overlay={isDragging && dropIndicatorTop !== null ? <RowDropIndicator top={dropIndicatorTop} /> : null}
          thead={headerRow}
        >
          <tbody ref={tbodyRef}>{bodyRows}</tbody>
        </ScrollableTableShell>
      ) : (
        <div
          ref={scrollContainerRef}
          className="relative overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
        >
          {isDragging && dropIndicatorTop !== null ? <RowDropIndicator top={dropIndicatorTop} /> : null}
          <table className="w-full min-w-max border-separate border-spacing-0 text-sm tabular-nums">
            <thead className="bg-slate-50 dark:bg-slate-800">{headerRow}</thead>
            <tbody ref={tbodyRef}>{bodyRows}</tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <>
      {tableContent}

      {isDragging && pointerPosition && draggedRow ? (
        <div
          className="pointer-events-none fixed z-50 overflow-hidden rounded-xl border border-blue-400 bg-white shadow-xl dark:border-blue-400/70 dark:bg-slate-900"
          style={{
            left: pointerPosition.x + 8,
            top: pointerPosition.y + 8,
          }}
        >
          <table className="min-w-max text-sm">
            <tbody>
              <tr className="bg-white dark:bg-slate-900">
                {isReorderable ? (
                  <td className="border-b border-slate-100 px-2 py-3 align-top dark:border-slate-700/80">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-blue-400 bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
                      <GripVertical size={14} strokeWidth={2.25} />
                    </div>
                  </td>
                ) : null}
                {isSelectable ? <td className="w-14 border-b border-slate-100 px-4 py-3 dark:border-slate-700/80" /> : null}
                {columns.map((column) => (
                  <td
                    key={String(column.key)}
                    className="border-b border-slate-100 px-4 py-3 text-slate-600 dark:border-slate-700/80 dark:text-slate-200"
                  >
                    {renderCellContent(draggedRow, column)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
