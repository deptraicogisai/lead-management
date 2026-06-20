export const sortNewestFirst = { createdAt: -1 } as const;

export const sortNewestDisplayIdFirst = { displayId: -1, createdAt: -1 } as const;

export function resolveNewestFirstDisplayId(totalItems: number, skip: number, index: number) {
  void totalItems;
  return skip + index + 1;
}
