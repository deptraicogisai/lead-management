export type PublisherLeadFieldColumn = {
  fieldName: string;
  label: string;
};

export type PublisherLeadDetailsRow = {
  id: string;
  displayCode: string;
  qualityDots: boolean[];
  postedAt: string;
  createdAt: string;
  statusLabel: "Accepted" | "Reject";
  tier: number;
  publisherLabel: string;
  redirectLabel: string;
  publisherPayout: string;
  adm: string;
  ttl: string;
  ref: string;
  agn: string;
  productLabel: string;
  channelLabel: string;
  userAgent: string;
  validationErrors: string[];
  rawPayload: Record<string, unknown>;
};

export type PublisherLeadDetailsFilters = {
  leadId: string;
  dateFrom: string;
  dateTo: string;
  productId: string;
  method: string;
  status: string;
  publisherId: string;
  publisherChannel: string;
  publisherSource: string;
  publisherTags: string;
  redirectStatus: string;
  tableSearch: string;
};

export const defaultPublisherLeadDetailsFilters: PublisherLeadDetailsFilters = {
  leadId: "",
  dateFrom: "",
  dateTo: "",
  productId: "",
  method: "All",
  status: "All",
  publisherId: "",
  publisherChannel: "",
  publisherSource: "",
  publisherTags: "",
  redirectStatus: "All",
  tableSearch: "",
};

export function formatPublisherLeadTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;
}

export function formatPublisherLeadDateRangeLabel(from: string, to: string) {
  const formatPart = (value: string) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");

    return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;
  };

  const start = formatPart(from);
  const end = formatPart(to);
  if (start && end) return `${start} - ${end}`;
  return start || end || "";
}

export function buildPublisherLeadDisplayCode(id: string) {
  const suffix = id.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
  return `W_${suffix || "LEAD"}`;
}

export function buildQualityDots(validationStatus: "success" | "fail") {
  if (validationStatus === "success") {
    return [true, true, true, false];
  }

  return [false, true, false, false];
}

function formatIndexedLabel(name: string, index?: number) {
  if (!index) return name;
  return `[${index}] ${name}`;
}

function readPayloadString(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }

  return "";
}

function readPayloadMoney(payload: Record<string, unknown>, keys: string[]) {
  const raw = readPayloadString(payload, keys);
  if (!raw) return "—";
  const parsed = Number(raw);
  if (Number.isFinite(parsed)) return `$${parsed.toFixed(2)}`;
  return raw.startsWith("$") ? raw : `$${raw}`;
}

export function formatPayloadFieldValue(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return "—";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

type VerticalFieldDoc = {
  fieldName: string;
  description?: string;
};

type VerticalDoc = {
  _id?: { toString(): string };
  fields?: VerticalFieldDoc[];
};

export function normalizeLeadPayload(doc: Record<string, unknown>): Record<string, unknown> {
  const payload = doc.payload;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }

  if (typeof doc.rawData === "string" && doc.rawData.trim()) {
    try {
      const parsed = JSON.parse(doc.rawData) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }

  return {};
}

export function buildPublisherLeadFieldColumns(productId: string, verticals: VerticalDoc[]) {
  const columns: PublisherLeadFieldColumn[] = [];
  const seen = new Set<string>();

  const appendFields = (fields: VerticalFieldDoc[] | undefined) => {
    for (const field of fields ?? []) {
      const fieldName = field.fieldName?.trim();
      if (!fieldName || seen.has(fieldName)) {
        continue;
      }

      seen.add(fieldName);
      columns.push({
        fieldName,
        label: field.description?.trim() || fieldName,
      });
    }
  };

  if (productId) {
    const vertical = verticals.find((item) => item._id?.toString() === productId);
    appendFields(vertical?.fields);
    return columns;
  }

  for (const vertical of verticals) {
    appendFields(vertical.fields);
  }

  return columns;
}

export function buildPublisherLeadFieldColumnsFromLeads(
  leads: Array<{ verticalRef?: string; payload: Record<string, unknown> }>,
  verticals: VerticalDoc[],
  productId: string
) {
  if (productId) {
    return buildPublisherLeadFieldColumns(productId, verticals);
  }

  const labelByFieldName = new Map<string, string>();
  for (const vertical of verticals) {
    for (const field of vertical.fields ?? []) {
      const fieldName = field.fieldName?.trim();
      if (!fieldName) continue;
      if (!labelByFieldName.has(fieldName)) {
        labelByFieldName.set(fieldName, field.description?.trim() || fieldName);
      }
    }
  }

  const columns: PublisherLeadFieldColumn[] = [];
  const seen = new Set<string>();

  for (const lead of leads) {
    for (const fieldName of Object.keys(lead.payload ?? {})) {
      if (!fieldName || seen.has(fieldName)) continue;
      seen.add(fieldName);
      columns.push({
        fieldName,
        label: labelByFieldName.get(fieldName) ?? fieldName,
      });
    }
  }

  return columns;
}

export function mapLeadDocToPublisherRow(input: {
  id: string;
  validationStatus: "success" | "fail";
  postedAt: string;
  createdAt: string;
  userAgent?: string;
  validationErrors?: string[];
  payload: Record<string, unknown>;
  publisherName: string;
  publisherIndex: number;
  verticalName: string;
  verticalIndex: number;
  mappingLabel?: string;
}): PublisherLeadDetailsRow {
  const payload = input.payload ?? {};
  const channelName =
    readPayloadString(payload, ["channel", "publisher_channel", "publisherChannel"]) || "Organic";
  const channelId = readPayloadString(payload, ["channel_id", "channelId"]) || "2";

  return {
    id: input.id,
    displayCode: buildPublisherLeadDisplayCode(input.id),
    qualityDots: buildQualityDots(input.validationStatus),
    postedAt: input.postedAt,
    createdAt: input.createdAt,
    statusLabel: input.validationStatus === "success" ? "Accepted" : "Reject",
    tier: 0,
    publisherLabel: input.publisherIndex
      ? `[${input.publisherIndex}] ${input.publisherName}`
      : input.publisherName,
    redirectLabel: input.mappingLabel || "—",
    publisherPayout: readPayloadMoney(payload, ["price", "payout", "publisher_payout", "amount"]),
    adm: readPayloadMoney(payload, ["adm", "admin_fee"]),
    ttl: readPayloadMoney(payload, ["ttl", "total"]),
    ref: readPayloadMoney(payload, ["ref", "referral"]),
    agn: readPayloadMoney(payload, ["agn", "agent"]),
    productLabel: formatIndexedLabel(input.verticalName, input.verticalIndex),
    channelLabel: `[${channelId}] ${channelName}`,
    userAgent: input.userAgent?.trim() || "Unknown",
    validationErrors: input.validationErrors ?? [],
    rawPayload: payload,
  };
}
