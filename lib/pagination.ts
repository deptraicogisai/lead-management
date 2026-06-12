export const PAGE_SIZE_OPTIONS = [10, 15, 50, 100, 500] as const;
export const REPORT_PAGE_SIZE_OPTIONS = [15, 50, 100, 500, 1000] as const;

export function resolvePageSizeOptions(pageSize: number, options: readonly number[]) {
  const merged = new Set([...options, pageSize]);
  return Array.from(merged).sort((left, right) => left - right);
}

export type PaginatedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export function parsePageParam(value: string | null | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function parsePageSizeParam(value: string | null | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, 100);
}

export function normalizeSearchParam(value: string | null | undefined) {
  return value?.trim() ?? "";
}

export type PaginationItem = number | "ellipsis";

export function getPaginationItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 0) return [];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis", totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [1, "ellipsis", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", totalPages];
}
