export type SortDirection = "asc" | "desc";

export type TableSortState = {
  key: string;
  direction: SortDirection;
};

export function compareSortValues(
  left: string | number | null | undefined,
  right: string | number | null | undefined,
  direction: SortDirection
) {
  const multiplier = direction === "asc" ? 1 : -1;

  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;

  if (typeof left === "number" && typeof right === "number") {
    return (left - right) * multiplier;
  }

  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: "base",
  }) * multiplier;
}

export function sortTableRows<T>(
  rows: T[],
  getSortValue: (row: T) => string | number | null | undefined,
  direction: SortDirection
) {
  return [...rows].sort((left, right) => compareSortValues(getSortValue(left), getSortValue(right), direction));
}
