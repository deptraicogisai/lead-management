import { ReactNode } from "react";

export type Column<T> = {
  key: keyof T | string;
  label: ReactNode;
  render?: (row: T) => ReactNode;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  emptyMessage: string;
  selectedRowIds?: string[];
  onToggleRow?: (rowId: string) => void;
  onToggleAllRows?: (checked: boolean) => void;
};

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  emptyMessage,
  selectedRowIds = [],
  onToggleRow,
  onToggleAllRows,
}: DataTableProps<T>) {
  const isSelectable = Boolean(onToggleRow);
  const selectedIds = new Set(selectedRowIds);
  const allRowsSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.id));

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="max-h-[420px] overflow-auto overflow-x-auto">
        <table className="min-w-max w-full border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800">
            <tr>
              {isSelectable ? (
                <th className="w-14 border-b border-slate-200 px-4 py-3 text-left dark:border-slate-600">
                  <input
                    type="checkbox"
                    checked={allRowsSelected}
                    onChange={(event) => onToggleAllRows?.(event.target.checked)}
                    aria-label="Select all rows"
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-500 dark:bg-slate-900"
                  />
                </th>
              ) : null}
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-100"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.id}
                className={`transition-colors duration-200 hover:bg-blue-50/50 dark:hover:bg-blue-400/10 ${index % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-800/70"}`}
              >
                {isSelectable ? (
                  <td className="border-b border-slate-100 px-4 py-3 align-top dark:border-slate-700/80">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(row.id)}
                      onChange={() => onToggleRow?.(row.id)}
                      aria-label={`Select row ${row.id}`}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-500 dark:bg-slate-900"
                    />
                  </td>
                ) : null}
                {columns.map((column) => (
                  <td
                    key={String(column.key)}
                    className="border-b border-slate-100 px-4 py-3 text-slate-600 transition-colors duration-200 dark:border-slate-700/80 dark:text-slate-200"
                  >
                    {column.render
                      ? column.render(row)
                      : (() => {
                          const value = row[column.key as keyof T];
                          return value === undefined || value === null ? "" : String(value);
                        })()}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
