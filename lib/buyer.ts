import { formatDateTimeDisplay } from "@/lib/date-range";

export type BuyerStatus = "Active" | "Inactive" | "Disabled" | "Paused" | "Deleted";

export type BuyerListRecord = {
  id: string;
  displayId: number;
  name: string;
  email: string;
  label: string;
  createdAt: string;
  lastTrafficLabel: string;
  buyerType: string;
  personalManagerId: string;
  personalManagerName: string;
  status: BuyerStatus;
  integrationIds: string[];
  integrations: string[];
  allowedPublisherIds: string[];
  blockedPublisherIds: string[];
  plDnplListIds: string[];
  copyPlDnplToOtherBuyers: boolean;
  questionnaireStatus: "Pending" | "Completed";
  quality: string;
  prepaid: boolean;
};

export type BuyerCreatePayload = {
  name: string;
  email: string;
  status: "Active" | "Inactive";
};

export type BuyerUpdatePayload = {
  name: string;
  email: string;
  status: BuyerStatus;
  integrationIds?: string[];
  allowedPublisherIds?: string[];
  blockedPublisherIds?: string[];
  plDnplListIds?: string[];
  copyPlDnplToOtherBuyers?: boolean;
};

export function normalizeBuyerStatus(status?: string): BuyerStatus {
  if (status === "Active" || status === "Deleted") {
    return status;
  }

  if (status === "Disabled" || status === "Paused") {
    return "Inactive";
  }

  return "Inactive";
}

export const BUYER_STATUS_DETAIL_OPTIONS: BuyerStatus[] = ["Active", "Inactive", "Deleted"];

export const BUYER_LABEL_OPTIONS = ["-", "LMS Sync"] as const;
export const BUYER_TYPE_OPTIONS = ["-", "Custom", "Standard"] as const;
export const BUYER_MANAGER_OPTIONS = [
  { id: "1010", name: "Minh Tran" },
  { id: "1011", name: "John Smith" },
  { id: "1012", name: "Sarah Lee" },
] as const;

export function getManagerLabel(managerId: string, managerName: string) {
  if (!managerId || !managerName) return "";
  return `[${managerId}] ${managerName}`;
}

export function resolveManagerOption(managerId: string) {
  return BUYER_MANAGER_OPTIONS.find((manager) => manager.id === managerId) ?? null;
}

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatBuyerCreated(value?: Date | string | null) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return formatDateTimeDisplay(date);
}

export function formatLastTraffic(value?: Date | string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTrafficDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((startOfToday.getTime() - startOfTrafficDay.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "Today";
  if (diffDays <= 7) return "Recently";

  return `${monthNames[date.getMonth()]} ${date.getDate()}`;
}

export type BuyerDoc = {
  _id?: { toString(): string };
  displayId?: number | null;
  name?: string | null;
  company?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  buyerLabel?: string | null;
  buyerType?: string | null;
  personalManagerId?: string | null;
  personalManagerName?: string | null;
  prepaid?: boolean;
  lastTrafficAt?: Date | string | null;
  questionnaireStatus?: "Pending" | "Completed";
  quality?: string | null;
  status?: BuyerStatus;
  integrationRefs?: Array<{ toString(): string } | string> | null;
  allowedPublisherRefs?: Array<{ toString(): string } | string> | null;
  blockedPublisherRefs?: Array<{ toString(): string } | string> | null;
  plDnplListIds?: string[] | null;
  copyPlDnplToOtherBuyers?: boolean;
  createdAt?: Date | string;
};

export function resolveBuyerName(doc: BuyerDoc) {
  if (doc.name?.trim()) return doc.name.trim();
  if (doc.company?.trim()) return doc.company.trim();
  return `${doc.firstName ?? ""} ${doc.lastName ?? ""}`.trim() || "Unnamed Buyer";
}

export function resolvePublisherRefIds(
  refs?: Array<{ toString(): string } | string> | null
) {
  return (refs ?? []).map((ref) => (typeof ref === "string" ? ref : ref.toString()));
}

export function toBuyerListRecord(
  doc: BuyerDoc,
  integrationLabels: string[] = [],
  integrationIds: string[] = []
): BuyerListRecord {
  const status = normalizeBuyerStatus(doc.status);

  const resolvedIntegrationIds =
    integrationIds.length > 0
      ? integrationIds
      : (doc.integrationRefs ?? []).map((ref) => (typeof ref === "string" ? ref : ref.toString()));

  return {
    id: doc._id?.toString() ?? "",
    displayId: doc.displayId ?? 0,
    name: resolveBuyerName(doc),
    email: doc.email?.trim() ?? "",
    label: doc.buyerLabel?.trim() || "-",
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : "",
    lastTrafficLabel: formatLastTraffic(doc.lastTrafficAt),
    buyerType: doc.buyerType?.trim() || "-",
    personalManagerId: doc.personalManagerId ?? "",
    personalManagerName: doc.personalManagerName ?? "",
    status,
    integrationIds: resolvedIntegrationIds,
    integrations: integrationLabels,
    allowedPublisherIds: resolvePublisherRefIds(doc.allowedPublisherRefs),
    blockedPublisherIds: resolvePublisherRefIds(doc.blockedPublisherRefs),
    plDnplListIds: doc.plDnplListIds ?? [],
    copyPlDnplToOtherBuyers: Boolean(doc.copyPlDnplToOtherBuyers),
    questionnaireStatus: doc.questionnaireStatus ?? "Pending",
    quality: doc.quality?.trim() || "M",
    prepaid: Boolean(doc.prepaid),
  };
}
