export const PING_TREE_PROCESSING_TYPES = [
  "Main processing",
  "Exit Page",
  "Exit Offer List",
  "Silent",
] as const;

export type PingTreeProcessingType = (typeof PING_TREE_PROCESSING_TYPES)[number];

export const PING_TREE_POSTING_TYPES = ["Direct Post", "Ping Post"] as const;

export type PingTreePostingType = (typeof PING_TREE_POSTING_TYPES)[number];

export const PING_TREE_CONFIG_STATUSES = ["Active", "Disabled", "Deleted"] as const;

export type PingTreeConfigStatus = (typeof PING_TREE_CONFIG_STATUSES)[number];

export function isPingTreeProcessingType(value: unknown): value is PingTreeProcessingType {
  return typeof value === "string" && (PING_TREE_PROCESSING_TYPES as readonly string[]).includes(value);
}

export function isPingTreePostingType(value: unknown): value is PingTreePostingType {
  return typeof value === "string" && (PING_TREE_POSTING_TYPES as readonly string[]).includes(value);
}

export type PingTreeConfigRecord = {
  id: string;
  displayId: number | null;
  name: string;
  comment: string;
  processingType: PingTreeProcessingType;
  postingType: PingTreePostingType;
  verticalId: string;
  verticalName: string;
  productLabel: string;
  percent: number;
  status: PingTreeConfigStatus;
  createdAt: string;
  updatedAt: string;
};

type PingTreeConfigDoc = {
  _id?: { toString(): string };
  displayId?: number | null;
  name: string;
  comment?: string | null;
  processingType: string;
  postingType?: string | null;
  verticalRef?: { toString(): string } | string | null;
  percent?: number | null;
  status?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

export function normalizePingTreeConfigStatus(status?: string | null): PingTreeConfigStatus {
  if (status === "Deleted") return "Deleted";
  if (status === "Disabled" || status === "Inactive") return "Disabled";
  return "Active";
}

export function toPingTreeConfigRecord(
  doc: PingTreeConfigDoc,
  product: { verticalId: string; verticalName: string; productLabel: string }
): PingTreeConfigRecord {
  return {
    id: doc._id?.toString() ?? "",
    displayId: doc.displayId ?? null,
    name: doc.name,
    comment: doc.comment?.trim() || "",
    processingType: isPingTreeProcessingType(doc.processingType)
      ? doc.processingType
      : "Main processing",
    postingType: isPingTreePostingType(doc.postingType) ? doc.postingType : "Direct Post",
    verticalId: product.verticalId,
    verticalName: product.verticalName,
    productLabel: product.productLabel,
    percent: typeof doc.percent === "number" ? doc.percent : 0,
    status: normalizePingTreeConfigStatus(doc.status),
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : "",
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : "",
  };
}

/** Format a product label like "[1] Payday US" where index is 1-based by createdAt asc. */
export function formatPingTreeProductLabel(verticalName: string, verticalIndex: number) {
  if (!verticalIndex) return verticalName;
  return `[${verticalIndex}] ${verticalName}`;
}
