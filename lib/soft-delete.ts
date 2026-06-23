export const DELETED_STATUS = "Deleted" as const;

export function isDeletedStatus(status?: string | null) {
  return status === DELETED_STATUS;
}

export function excludeDeletedStatusFilter() {
  return { status: { $ne: DELETED_STATUS } };
}

export function buildMongoStatusFilter(statusFilter?: string | null) {
  const value = statusFilter?.trim() ?? "";

  if (!value || value === "All") {
    return excludeDeletedStatusFilter();
  }

  return { status: value };
}

/** Include Deleted in dropdown when the record is already deleted so the select maps to the current value. */
export function resolveEditableStatusOptions<T extends string>(
  editableOptions: readonly T[],
  currentStatus: string,
  deletedStatus: string = DELETED_STATUS
): T[] {
  if (currentStatus === deletedStatus && !editableOptions.includes(deletedStatus as T)) {
    return [...editableOptions, deletedStatus as T];
  }

  return [...editableOptions];
}

export function matchesListStatusFilter(rowStatus: string, statusFilter: string) {
  if (statusFilter === "All") {
    return !isDeletedStatus(rowStatus);
  }

  return rowStatus === statusFilter;
}

export function mergeMongoFilters(...filters: Array<Record<string, unknown>>) {
  const active = filters.filter((filter) => Object.keys(filter).length > 0);

  if (active.length === 0) {
    return {};
  }

  if (active.length === 1) {
    return active[0];
  }

  return { $and: active };
}

export function softDeleteUpdate() {
  return { status: DELETED_STATUS };
}
