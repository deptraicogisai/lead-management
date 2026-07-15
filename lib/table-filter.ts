import type { Column } from "@/components/ui/data-table";

function cellSearchText<T>(row: T, column: Column<T>) {
  if (column.sortValue) {
    const value = column.sortValue(row);
    if (value == null) return "";
    return String(value);
  }

  const value = row[column.key as keyof T];
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => (item == null ? "" : String(item))).join(" ");
  }

  return "";
}

/** Client-side filter for the currently loaded table page. */
export function filterRowsByQuery<T>(rows: T[], columns: Column<T>[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return rows;

  const searchableColumns = columns.filter((column) => String(column.key) !== "actions");

  return rows.filter((row) =>
    searchableColumns.some((column) => cellSearchText(row, column).toLowerCase().includes(normalized))
  );
}

/** Generic object/row filter when column defs are not available. */
export function filterRecordsByQuery<T extends Record<string, unknown>>(
  rows: T[],
  query: string,
  fields?: Array<keyof T | ((row: T) => unknown)>
) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return rows;

  return rows.filter((row) => {
    const values =
      fields?.map((field) => (typeof field === "function" ? field(row) : row[field])) ?? Object.values(row);

    return values.some((value) => {
      if (value == null) return false;
      if (typeof value === "object") return false;
      return String(value).toLowerCase().includes(normalized);
    });
  });
}
