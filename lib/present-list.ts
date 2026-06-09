import { formatProductLabel } from "@/lib/integration-builder";

export type PresentListType = "PL" | "DNPL";

export type PresentListValueRecord = {
  id: string;
  value: string;
  createdAt: string;
  expirationDate: string | null;
};

export type PresentListRecord = {
  id: string;
  displayId: number;
  name: string;
  verticalId: string;
  productLabel: string;
  applyToField: string;
  listType: PresentListType;
  defaultExpirationPeriod: string;
  listSize: number;
  allowApiAccess: boolean;
  autoUpdateFrequency: string;
  createdAt: string;
  updatedAt: string;
  lastDownloadAt: string | null;
};

export const PRESENT_LIST_TYPE_OPTIONS: PresentListType[] = ["PL", "DNPL"];
export const PRESENT_LIST_EXPIRATION_OPTIONS = ["No expiration", "30 days", "60 days", "90 days", "180 days", "365 days"];

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatPresentListDateTime(value?: Date | string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const month = monthNames[date.getMonth()];
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${month} ${day} ${hours}:${minutes}:${seconds}`;
}

type PresentListDoc = {
  _id?: { toString(): string };
  displayId: number;
  name: string;
  verticalRef?: { toString(): string } | string;
  applyToField: string;
  listType: PresentListType;
  defaultExpirationPeriod: string;
  allowApiAccess?: boolean;
  autoUpdateFrequency?: string;
  values?: Array<{
    _id?: { toString(): string };
    value: string;
    createdAt?: Date | string;
    expirationDate?: Date | string | null;
  }>;
  lastDownloadAt?: Date | string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

export function toPresentListRecord(
  doc: PresentListDoc,
  context: {
    verticalNameById: Map<string, string>;
    verticalIndexById: Map<string, number>;
  }
): PresentListRecord {
  const verticalId =
    typeof doc.verticalRef === "string" ? doc.verticalRef : doc.verticalRef?.toString() ?? "";
  const verticalName = context.verticalNameById.get(verticalId) ?? "Unknown";
  const verticalIndex = context.verticalIndexById.get(verticalId) ?? 0;

  return {
    id: doc._id?.toString() ?? "",
    displayId: doc.displayId,
    name: doc.name,
    verticalId,
    productLabel: formatProductLabel(verticalName, verticalIndex),
    applyToField: doc.applyToField,
    listType: doc.listType,
    defaultExpirationPeriod: doc.defaultExpirationPeriod,
    listSize: doc.values?.length ?? 0,
    allowApiAccess: Boolean(doc.allowApiAccess),
    autoUpdateFrequency: doc.autoUpdateFrequency ?? "N/A",
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : "",
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : "",
    lastDownloadAt: doc.lastDownloadAt ? new Date(doc.lastDownloadAt).toISOString() : null,
  };
}

export function toPresentListValueRecord(value: {
  _id?: { toString(): string };
  value: string;
  createdAt?: Date | string;
  expirationDate?: Date | string | null;
}): PresentListValueRecord {
  return {
    id: value._id?.toString() ?? "",
    value: value.value,
    createdAt: value.createdAt ? new Date(value.createdAt).toISOString() : "",
    expirationDate: value.expirationDate ? new Date(value.expirationDate).toISOString() : null,
  };
}
