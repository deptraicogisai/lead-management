import { formatProductLabel } from "@/lib/integration-builder";
import { getMaxRangeOptions, isGeneralFilterRangeValid } from "@/lib/lead-field-value";

export { getMaxRangeOptions, isGeneralFilterRangeValid };

export type CampaignStatus = "Active" | "Paused" | "Disabled";
export type CampaignType = "Redirect" | "Silent";
export type DuplicateMethod = "Email" | "SSN + Email";
export type ScheduleAction = "Post" | "Do not post";

export type CampaignGeneralFilter = {
  fieldId: string;
  fieldName: string;
  description: string;
  dataTypeFilter: "Text" | "Range" | "Checkbox";
  enabled: boolean;
  minValue?: string;
  maxValue?: string;
  selectedValues?: string[];
  textValue?: string;
};

type CampaignGeneralFilterDoc = Omit<CampaignGeneralFilter, "minValue" | "maxValue" | "textValue" | "selectedValues"> & {
  minValue?: string | null;
  maxValue?: string | null;
  textValue?: string | null;
  selectedValues?: Array<string | null> | null;
};

export type CampaignScheduleRule = {
  id: string;
  active: boolean;
  action: ScheduleAction;
  scheduleMethod: "Days";
  days: string[];
  startHour: string;
  startMinute: string;
  endHour: string;
  endMinute: string;
  dailySoldLeadsLimit: number | null;
  dailyPostLeadsLimit: number | null;
};

export type CampaignDuplicatesSettings = {
  duplicateMethod: DuplicateMethod;
  duplicateSold: string;
  duplicatePosted: string;
};

export type CampaignRecord = {
  id: string;
  displayId: number;
  name: string;
  status: CampaignStatus;
  verticalId: string;
  productLabel: string;
  buyerId: string;
  buyerLabel: string;
  campaignType: CampaignType;
  timezone: string;
  minPrice: number;
  integrationId: string;
  integrationLabel: string;
  integrationSettings: {
    postUrl: string;
    postTimeout: number;
  };
  duplicates: CampaignDuplicatesSettings;
  generalFilters: CampaignGeneralFilter[];
  plDnplListIds: string[];
  copyPlDnplToOtherCampaigns: boolean;
  scheduleRules: CampaignScheduleRule[];
  inPingTree: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CampaignListRecord = Pick<
  CampaignRecord,
  | "id"
  | "displayId"
  | "name"
  | "status"
  | "productLabel"
  | "minPrice"
  | "integrationLabel"
  | "timezone"
  | "buyerLabel"
  | "campaignType"
  | "createdAt"
>;

export const CAMPAIGN_STATUS_OPTIONS: CampaignStatus[] = ["Active", "Paused", "Disabled"];
export const CAMPAIGN_TYPE_OPTIONS: CampaignType[] = ["Redirect", "Silent"];
export const DUPLICATE_METHOD_OPTIONS: DuplicateMethod[] = ["Email", "SSN + Email"];
export const SCHEDULE_DAY_OPTIONS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const SCHEDULE_ACTION_OPTIONS: ScheduleAction[] = ["Post", "Do not post"];

export const TIMEZONE_OPTIONS = [
  "New York (EST/EDT)",
  "Chicago (CST/CDT)",
  "Denver (MST/MDT)",
  "Los Angeles (PST/PDT)",
  "Phoenix (MST)",
  "Hanoi (ICT)",
  "UTC",
] as const;

export const DEFAULT_CAMPAIGN_TIMEZONE = TIMEZONE_OPTIONS[0];

const LEGACY_TIMEZONE_ALIASES: Record<string, (typeof TIMEZONE_OPTIONS)[number]> = {
  "EST/EDT": "New York (EST/EDT)",
};

export function resolveCampaignTimezone(timezone?: string | null) {
  const value = timezone?.trim();
  if (!value) return DEFAULT_CAMPAIGN_TIMEZONE;
  return LEGACY_TIMEZONE_ALIASES[value] ?? value;
}

export const DUPLICATE_PERIOD_OPTIONS = [
  "OFF",
  ...Array.from({ length: 10 }, (_, index) => {
    const day = index + 1;
    return day === 1 ? "1 day" : `${day} days`;
  }),
  "100 days",
  "120 days",
  "365 days",
];

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatCampaignDateTime(value?: Date | string | null) {
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

export function buildHourOptions() {
  return Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
}

export function buildMinuteOptions() {
  return Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, "0"));
}

export function defaultCampaignDuplicates(): CampaignDuplicatesSettings {
  return {
    duplicateMethod: "Email",
    duplicateSold: "OFF",
    duplicatePosted: "OFF",
  };
}

type RangeOptionLike = { value: string };

export function validateGeneralFilters(
  filters: CampaignGeneralFilter[],
  optionsByFieldName: Map<string, RangeOptionLike[]>
) {
  for (const filter of filters) {
    if (!filter.enabled || filter.dataTypeFilter !== "Range") continue;
    if (!filter.minValue || !filter.maxValue) continue;

    const options = optionsByFieldName.get(filter.fieldName) ?? [];
    if (!isGeneralFilterRangeValid(filter.minValue, filter.maxValue, options)) {
      return `${filter.description}: Max cannot be less than Min.`;
    }
  }

  return null;
}

export function clearDisabledGeneralFilterValues(filter: CampaignGeneralFilter): CampaignGeneralFilter {
  if (filter.enabled) {
    return filter;
  }

  if (filter.dataTypeFilter === "Text") {
    return { ...filter, textValue: "" };
  }

  if (filter.dataTypeFilter === "Range") {
    return { ...filter, minValue: "", maxValue: "" };
  }

  if (filter.dataTypeFilter === "Checkbox") {
    return { ...filter, selectedValues: [] };
  }

  return filter;
}

export function normalizeGeneralFiltersForStorage(filters: CampaignGeneralFilter[]) {
  return filters.map(clearDisabledGeneralFilterValues);
}

export function buildGeneralFilterEnabledPatch(
  filter: CampaignGeneralFilter,
  enabled: boolean
): Partial<CampaignGeneralFilter> {
  if (enabled) {
    return { enabled: true };
  }

  return clearDisabledGeneralFilterValues({ ...filter, enabled: false });
}

export function defaultScheduleRule(): Omit<CampaignScheduleRule, "id"> {
  return {
    active: true,
    action: "Post",
    scheduleMethod: "Days",
    days: [...SCHEDULE_DAY_OPTIONS],
    startHour: "00",
    startMinute: "00",
    endHour: "23",
    endMinute: "59",
    dailySoldLeadsLimit: null,
    dailyPostLeadsLimit: 100,
  };
}

type ScheduleRuleTimeLike = Pick<
  CampaignScheduleRule,
  "startHour" | "startMinute" | "endHour" | "endMinute" | "days"
>;

function scheduleRuleTimeToMinutes(hour: string, minute: string) {
  return Number(hour) * 60 + Number(minute);
}

function scheduleTimeRangesOverlap(ruleA: ScheduleRuleTimeLike, ruleB: ScheduleRuleTimeLike) {
  const sharedDays = ruleA.days.filter((day) => ruleB.days.includes(day));
  if (sharedDays.length === 0) return false;

  const startA = scheduleRuleTimeToMinutes(ruleA.startHour, ruleA.startMinute);
  const endA = scheduleRuleTimeToMinutes(ruleA.endHour, ruleA.endMinute);
  const startB = scheduleRuleTimeToMinutes(ruleB.startHour, ruleB.startMinute);
  const endB = scheduleRuleTimeToMinutes(ruleB.endHour, ruleB.endMinute);

  return startA <= endB && startB <= endA;
}

export function findScheduleRuleOverlap(
  candidate: Omit<CampaignScheduleRule, "id"> & { id?: string },
  existingRules: CampaignScheduleRule[],
  excludeRuleId?: string | null
) {
  for (const rule of existingRules) {
    if (excludeRuleId && rule.id === excludeRuleId) continue;
    if (scheduleTimeRangesOverlap(candidate, rule)) {
      return rule;
    }
  }

  return null;
}

export function getScheduleRuleOverlapMessage(
  candidate: Omit<CampaignScheduleRule, "id">,
  overlapping: CampaignScheduleRule
) {
  const sharedDays = candidate.days.filter((day) => overlapping.days.includes(day));
  return `This schedule overlaps with an existing rule (${overlapping.action}, ${sharedDays.join(", ")}, ${overlapping.startHour}:${overlapping.startMinute} - ${overlapping.endHour}:${overlapping.endMinute}). Please adjust the days or time range.`;
}

export function validateScheduleRulesNoOverlap(rules: CampaignScheduleRule[]) {
  for (let index = 0; index < rules.length; index += 1) {
    const rule = rules[index];
    const overlap = findScheduleRuleOverlap(
      rule,
      rules.filter((_, otherIndex) => otherIndex !== index)
    );

    if (overlap) {
      return getScheduleRuleOverlapMessage(rule, overlap);
    }
  }

  return null;
}

type CampaignDoc = {
  _id?: { toString(): string };
  displayId: number;
  name: string;
  status: CampaignStatus;
  verticalRef?: { toString(): string } | string;
  buyerRef?: { toString(): string } | string;
  integrationRef?: { toString(): string } | string | null;
  integrationSettings?: {
    postUrl?: string | null;
    postTimeout?: number | null;
    postTimeoutMs?: number | null;
  } | null;
  campaignType: CampaignType;
  timezone: string;
  minPrice: number;
  duplicates?: CampaignDuplicatesSettings;
  generalFilters?: CampaignGeneralFilterDoc[] | null;
  plDnplListIds?: string[];
  copyPlDnplToOtherCampaigns?: boolean;
  scheduleRules?: Array<
    Omit<CampaignScheduleRule, "id" | "dailySoldLeadsLimit" | "dailyPostLeadsLimit"> & {
      _id?: { toString(): string };
      dailySoldLeadsLimit?: number | null;
      dailyPostLeadsLimit?: number | null;
    }
  >;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

export function toCampaignRecord(
  doc: CampaignDoc,
  context: {
    verticalNameById: Map<string, string>;
    verticalIndexById: Map<string, number>;
    buyerLabelById: Map<string, string>;
    integrationLabelById: Map<string, string>;
    pingTreeCampaignIds: Set<string>;
  }
): CampaignRecord {
  const verticalId =
    typeof doc.verticalRef === "string" ? doc.verticalRef : doc.verticalRef?.toString() ?? "";
  const buyerId = typeof doc.buyerRef === "string" ? doc.buyerRef : doc.buyerRef?.toString() ?? "";
  const integrationId =
    typeof doc.integrationRef === "string"
      ? doc.integrationRef
      : doc.integrationRef?.toString() ?? "";
  const verticalName = context.verticalNameById.get(verticalId) ?? "Unknown";
  const verticalIndex = context.verticalIndexById.get(verticalId) ?? 0;

  return {
    id: doc._id?.toString() ?? "",
    displayId: doc.displayId,
    name: doc.name,
    status: doc.status,
    verticalId,
    productLabel: formatProductLabel(verticalName, verticalIndex),
    buyerId,
    buyerLabel: context.buyerLabelById.get(buyerId) ?? "Unknown",
    campaignType: doc.campaignType,
    timezone: resolveCampaignTimezone(doc.timezone),
    minPrice: doc.minPrice,
    integrationId,
    integrationLabel: integrationId ? context.integrationLabelById.get(integrationId) ?? "-" : "-",
    integrationSettings: {
      postUrl: doc.integrationSettings?.postUrl?.trim() ?? "",
      postTimeout: (() => {
        const settings = doc.integrationSettings;
        if (settings?.postTimeout != null && Number.isFinite(Number(settings.postTimeout))) {
          return Number(settings.postTimeout);
        }
        if (settings?.postTimeoutMs != null && Number.isFinite(Number(settings.postTimeoutMs))) {
          return Math.round(Number(settings.postTimeoutMs) / 1000);
        }
        return 90;
      })(),
    },
    duplicates: doc.duplicates ?? defaultCampaignDuplicates(),
    generalFilters: Array.isArray(doc.generalFilters)
      ? doc.generalFilters.map((filter) => ({
          fieldId: filter.fieldId,
          fieldName: filter.fieldName,
          description: filter.description,
          dataTypeFilter: filter.dataTypeFilter,
          enabled: Boolean(filter.enabled),
          minValue: filter.minValue ?? undefined,
          maxValue: filter.maxValue ?? undefined,
          textValue: filter.textValue ?? undefined,
          selectedValues: Array.isArray(filter.selectedValues)
            ? filter.selectedValues.filter((value): value is string => typeof value === "string")
            : [],
        }))
      : [],
    plDnplListIds: doc.plDnplListIds ?? [],
    copyPlDnplToOtherCampaigns: Boolean(doc.copyPlDnplToOtherCampaigns),
    scheduleRules: (doc.scheduleRules ?? []).map((rule) => ({
      id: rule._id?.toString() ?? "",
      active: Boolean(rule.active),
      action: rule.action,
      scheduleMethod: rule.scheduleMethod,
      days: rule.days ?? [],
      startHour: rule.startHour ?? "00",
      startMinute: rule.startMinute ?? "00",
      endHour: rule.endHour ?? "23",
      endMinute: rule.endMinute ?? "59",
      dailySoldLeadsLimit: rule.dailySoldLeadsLimit ?? null,
      dailyPostLeadsLimit: rule.dailyPostLeadsLimit ?? null,
    })),
    inPingTree: context.pingTreeCampaignIds.has(doc._id?.toString() ?? ""),
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : "",
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : "",
  };
}

export function toCampaignListRecord(record: CampaignRecord): CampaignListRecord {
  return {
    id: record.id,
    displayId: record.displayId,
    name: record.name,
    status: record.status,
    productLabel: record.productLabel,
    minPrice: record.minPrice,
    integrationLabel: record.integrationLabel,
    timezone: record.timezone,
    buyerLabel: record.buyerLabel,
    campaignType: record.campaignType,
    createdAt: record.createdAt,
  };
}

type VerticalFieldLike = {
  id?: string;
  _id?: { toString(): string };
  fieldName: string;
  description: string;
  dataTypeFilter?: string | null;
};

export function buildGeneralFiltersFromVerticalFields(fields: VerticalFieldLike[]): CampaignGeneralFilter[] {
  const allowed = new Set(["Text", "Range", "Checkbox"]);

  return fields
    .filter((field) => field.dataTypeFilter && allowed.has(field.dataTypeFilter))
    .map((field) => ({
      fieldId: field.id ?? field._id?.toString() ?? field.fieldName,
      fieldName: field.fieldName,
      description: field.description,
      dataTypeFilter: field.dataTypeFilter as "Text" | "Range" | "Checkbox",
      enabled: false,
      minValue: "",
      maxValue: "",
      selectedValues: [],
      textValue: "",
    }));
}
