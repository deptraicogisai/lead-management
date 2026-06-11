export function reorderIds(ids: string[], fromId: string, toId: string) {
  const fromIndex = ids.indexOf(fromId);
  const toIndex = ids.indexOf(toId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return ids;
  }

  const next = [...ids];
  next.splice(fromIndex, 1);
  next.splice(toIndex, 0, fromId);
  return next;
}

export function reorderItemsByIds<T extends { id: string }>(items: T[], orderedIds: string[]) {
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const reordered = orderedIds.map((id) => itemMap.get(id)).filter((item): item is T => Boolean(item));

  if (reordered.length !== items.length) {
    return null;
  }

  return reordered;
}

export function validateReorderFieldIds(existingIds: string[], requestedIds: unknown) {
  if (!Array.isArray(requestedIds) || requestedIds.length === 0) {
    return { error: "fieldIds must be a non-empty array." };
  }

  if (!requestedIds.every((id) => typeof id === "string" && id.trim())) {
    return { error: "fieldIds must contain valid string ids." };
  }

  const normalized = requestedIds.map((id) => id.trim());
  if (new Set(normalized).size !== normalized.length) {
    return { error: "fieldIds must not contain duplicates." };
  }

  if (normalized.length !== existingIds.length) {
    return { error: "fieldIds must include every configured field." };
  }

  const existingSet = new Set(existingIds);
  if (!normalized.every((id) => existingSet.has(id))) {
    return { error: "fieldIds contain unknown field ids." };
  }

  return { value: normalized };
}

export function reorderDocumentsByIds<T extends { _id?: { toString(): string } }>(
  documents: T[],
  orderedIds: string[]
) {
  const documentMap = new Map(documents.map((document) => [document._id?.toString() ?? "", document]));
  const reordered = orderedIds.map((id) => documentMap.get(id)).filter((document): document is T => Boolean(document));

  if (reordered.length !== documents.length) {
    return null;
  }

  return reordered;
}
