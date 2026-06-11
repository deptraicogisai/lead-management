import {
  buildGeneralFiltersFromVerticalFields,
  defaultCampaignDuplicates,
  isGeneralFilterRangeValid,
  resolveCampaignTimezone,
  SCHEDULE_DAY_OPTIONS,
  type CampaignDuplicatesSettings,
  type CampaignGeneralFilter,
  type CampaignScheduleRule,
} from "@/lib/campaign";
import type { MappingFieldDoc } from "@/lib/mapping-field-api";

export type MappingIntakeSettingsRecord = {
  timezone: string;
  duplicates: CampaignDuplicatesSettings;
  generalFilters: CampaignGeneralFilter[];
  scheduleRules: CampaignScheduleRule[];
};

type MappingIntakeDoc = {
  timezone?: string | null;
  duplicates?: CampaignDuplicatesSettings | null;
  generalFilters?: Array<
    Omit<CampaignGeneralFilter, "minValue" | "maxValue" | "textValue" | "selectedValues"> & {
      minValue?: string | null;
      maxValue?: string | null;
      textValue?: string | null;
      selectedValues?: Array<string | null> | null;
    }
  > | null;
  scheduleRules?: Array<
    Omit<CampaignScheduleRule, "id" | "dailySoldLeadsLimit" | "dailyPostLeadsLimit"> & {
      _id?: { toString(): string };
      dailySoldLeadsLimit?: number | null;
      dailyPostLeadsLimit?: number | null;
    }
  > | null;
};

type FieldOptionLike = { value: string; label?: string };

function formatPayloadValueForMessage(value: unknown) {
  if (value === undefined || value === null || (typeof value === "string" && !value.trim())) {
    return "(empty)";
  }
  return String(value);
}

function buildAllowedCheckboxValues(selectedValues: string[], options: FieldOptionLike[]) {
  const allowed = new Set<string>();

  for (const selected of selectedValues) {
    const normalizedSelected = selected.trim().toLowerCase();
    if (!normalizedSelected) continue;

    allowed.add(normalizedSelected);

    const matchedOption = options.find(
      (option) =>
        option.value.trim().toLowerCase() === normalizedSelected ||
        option.label?.trim().toLowerCase() === normalizedSelected
    );

    if (matchedOption?.value) {
      allowed.add(matchedOption.value.trim().toLowerCase());
    }
    if (matchedOption?.label) {
      allowed.add(matchedOption.label.trim().toLowerCase());
    }
  }

  return allowed;
}

const TIMEZONE_IANA_MAP: Record<string, string> = {
  "New York (EST/EDT)": "America/New_York",
  "Chicago (CST/CDT)": "America/Chicago",
  "Denver (MST/MDT)": "America/Denver",
  "Los Angeles (PST/PDT)": "America/Los_Angeles",
  "Phoenix (MST)": "America/Phoenix",
  "Hanoi (ICT)": "Asia/Ho_Chi_Minh",
  UTC: "UTC",
};

export function buildGeneralFiltersFromMappingFields(fields: MappingFieldDoc[]): CampaignGeneralFilter[] {
  return buildGeneralFiltersFromVerticalFields(
    fields.map((field) => ({
      id: field._id?.toString(),
      fieldName: field.fieldName,
      description: field.description,
      dataTypeFilter: field.dataTypeFilter,
    }))
  );
}

export function syncGeneralFiltersWithFields(
  existing: CampaignGeneralFilter[],
  fields: MappingFieldDoc[]
): CampaignGeneralFilter[] {
  const built = buildGeneralFiltersFromMappingFields(fields);
  const existingByFieldName = new Map(existing.map((filter) => [filter.fieldName, filter]));

  return built.map((filter) => {
    const previous = existingByFieldName.get(filter.fieldName);
    if (!previous) return filter;

    return {
      ...filter,
      enabled: previous.enabled,
      minValue: previous.minValue,
      maxValue: previous.maxValue,
      textValue: previous.textValue,
      selectedValues: previous.selectedValues,
    };
  });
}

export function toMappingIntakeSettings(
  doc: MappingIntakeDoc,
  mappingFields: MappingFieldDoc[]
): MappingIntakeSettingsRecord {
  const existingFilters = Array.isArray(doc.generalFilters)
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
    : [];

  return {
    timezone: resolveCampaignTimezone(doc.timezone),
    duplicates: doc.duplicates ?? defaultCampaignDuplicates(),
    generalFilters: syncGeneralFiltersWithFields(existingFilters, mappingFields),
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
  };
}

function normalizeComparableValue(value: unknown) {
  if (typeof value === "string") return value.trim().toLowerCase();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim().toLowerCase();
  return "";
}

function getRangeOptionOrder(value: string, options: FieldOptionLike[]) {
  const index = options.findIndex((option) => option.value === value);
  if (index >= 0) return index;

  const numeric = Number(value);
  return Number.isNaN(numeric) ? null : numeric;
}

function isValueInRange(value: unknown, minValue: string, maxValue: string, options: FieldOptionLike[]) {
  const comparable = normalizeComparableValue(value);
  if (!comparable) return false;

  const minOrder = getRangeOptionOrder(minValue, options);
  const maxOrder = getRangeOptionOrder(maxValue, options);
  const valueOrder = getRangeOptionOrder(comparable, options);

  if (minOrder !== null && maxOrder !== null && valueOrder !== null) {
    return valueOrder >= minOrder && valueOrder <= maxOrder;
  }

  return comparable.localeCompare(minValue, undefined, { numeric: true }) >= 0
    && comparable.localeCompare(maxValue, undefined, { numeric: true }) <= 0;
}

export function evaluateGeneralFiltersForPayload(
  payload: Record<string, unknown>,
  filters: CampaignGeneralFilter[],
  optionsByFieldName: Map<string, FieldOptionLike[]>
) {
  const reasons: string[] = [];

  for (const filter of filters) {
    if (!filter.enabled) continue;

    const value = payload[filter.fieldName];
    const label = filter.description?.trim() || filter.fieldName;
    const options = optionsByFieldName.get(filter.fieldName) ?? [];

    if (filter.dataTypeFilter === "Text" && filter.textValue?.trim()) {
      if (normalizeComparableValue(value) !== normalizeComparableValue(filter.textValue)) {
        reasons.push(
          `${label} filter rejected. Expected "${filter.textValue.trim()}", received ${formatPayloadValueForMessage(value)}.`
        );
      }
      continue;
    }

    if (filter.dataTypeFilter === "Checkbox" && (filter.selectedValues?.length ?? 0) > 0) {
      const comparable = normalizeComparableValue(value);
      if (!comparable) {
        reasons.push(`${label} is required.`);
        continue;
      }

      const allowed = buildAllowedCheckboxValues(filter.selectedValues ?? [], options);
      if (!allowed.has(comparable)) {
        reasons.push(
          `${label} filter rejected. Allowed: ${(filter.selectedValues ?? []).join(", ")}. Received: ${formatPayloadValueForMessage(value)}.`
        );
      }
      continue;
    }

    if (filter.dataTypeFilter === "Range" && filter.minValue && filter.maxValue) {
      if (!isValueInRange(value, filter.minValue, filter.maxValue, options)) {
        reasons.push(
          `${label} filter rejected. Allowed range: ${filter.minValue} to ${filter.maxValue}. Received: ${formatPayloadValueForMessage(value)}.`
        );
      }
    }
  }

  return reasons;
}

function parseDuplicatePeriodDays(period: string) {
  const trimmed = period.trim();
  if (!trimmed || trimmed === "OFF") return null;
  if (trimmed === "1 day") return 1;

  const match = trimmed.match(/^(\d+)\s+days?$/i);
  return match ? Number(match[1]) : null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readPayloadString(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function resolveDuplicateFieldNames(payload: Record<string, unknown>, fields: MappingFieldDoc[]) {
  const emailField =
    fields.find((field) => field.type.trim().toLowerCase() === "email")?.fieldName ??
    (payload.email !== undefined ? "email" : "email");
  const ssnField =
    fields.find((field) => field.fieldName.trim().toLowerCase() === "ssn")?.fieldName ?? "ssn";

  return { emailField, ssnField };
}

function buildDuplicateKey(
  payload: Record<string, unknown>,
  method: CampaignDuplicatesSettings["duplicateMethod"],
  fields: MappingFieldDoc[]
) {
  const { emailField, ssnField } = resolveDuplicateFieldNames(payload, fields);
  const email = readPayloadString(payload, [emailField, "email"]);
  const ssn = readPayloadString(payload, [ssnField, "ssn"]);

  if (method === "SSN + Email") {
    if (!email && !ssn) return "";
    return `${ssn.toLowerCase()}|${email.toLowerCase()}`;
  }

  return email.toLowerCase();
}

type DuplicateCheckFn = (
  mappingId: string,
  duplicateKey: string,
  periodDays: number,
  validationStatus?: "success" | "fail"
) => Promise<boolean>;

export async function evaluateDuplicateRules(
  mappingId: string,
  payload: Record<string, unknown>,
  duplicates: CampaignDuplicatesSettings,
  fields: MappingFieldDoc[],
  checkDuplicate: DuplicateCheckFn
) {
  const reasons: string[] = [];
  const duplicateKey = buildDuplicateKey(payload, duplicates.duplicateMethod, fields);
  if (!duplicateKey) return reasons;

  const soldDays = parseDuplicatePeriodDays(duplicates.duplicateSold);
  if (soldDays !== null) {
    const exists = await checkDuplicate(mappingId, duplicateKey, soldDays, "success");
    if (exists) {
      reasons.push(
        `Duplicate sold lead rejected. A sold lead with the same ${duplicates.duplicateMethod.toLowerCase()} was found within ${duplicates.duplicateSold}.`
      );
    }
  }

  const postedDays = parseDuplicatePeriodDays(duplicates.duplicatePosted);
  if (postedDays !== null) {
    const exists = await checkDuplicate(mappingId, duplicateKey, postedDays);
    if (exists) {
      reasons.push(
        `Duplicate posted lead rejected. A lead with the same ${duplicates.duplicateMethod.toLowerCase()} was already posted within ${duplicates.duplicatePosted}.`
      );
    }
  }

  return reasons;
}

function resolveTimezone(timezone: string) {
  return TIMEZONE_IANA_MAP[timezone] ?? TIMEZONE_IANA_MAP[resolveCampaignTimezone(timezone)] ?? "UTC";
}

function getZonedParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: resolveTimezone(timezone),
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    dayLabel: lookup.weekday ?? "Mon",
    hour: lookup.hour ?? "00",
    minute: lookup.minute ?? "00",
    year: lookup.year ?? "1970",
    month: lookup.month ?? "01",
    day: lookup.day ?? "01",
  };
}

function scheduleRuleTimeToMinutes(hour: string, minute: string) {
  return Number(hour) * 60 + Number(minute);
}

function ruleMatchesNow(rule: CampaignScheduleRule, dayLabel: string, minutesNow: number) {
  if (!rule.active) return false;
  if (!rule.days.includes(dayLabel)) return false;

  const start = scheduleRuleTimeToMinutes(rule.startHour, rule.startMinute);
  const end = scheduleRuleTimeToMinutes(rule.endHour, rule.endMinute);
  return minutesNow >= start && minutesNow <= end;
}

function getStartOfZonedDay(date: Date, timezone: string) {
  const parts = getZonedParts(date, timezone);
  const iso = `${parts.year}-${parts.month}-${parts.day}T00:00:00`;
  const utcGuess = new Date(iso);
  const offsetFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: resolveTimezone(timezone),
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const midnightParts = offsetFormatter.formatToParts(utcGuess);
  const lookup = Object.fromEntries(midnightParts.map((part) => [part.type, part.value]));
  const hour = Number(lookup.hour ?? 0);
  const minute = Number(lookup.minute ?? 0);
  return new Date(utcGuess.getTime() - (hour * 60 + minute) * 60_000);
}

type LeadCountFn = (mappingId: string, from: Date, to: Date, validationStatus?: "success") => Promise<number>;

export async function evaluateScheduleRules(
  mappingId: string,
  settings: Pick<MappingIntakeSettingsRecord, "timezone" | "scheduleRules">,
  postedAt: Date,
  countLeads: LeadCountFn
) {
  const reasons: string[] = [];
  const activeRules = settings.scheduleRules.filter((rule) => rule.active);
  if (activeRules.length === 0) return reasons;

  const zoned = getZonedParts(postedAt, settings.timezone);
  const minutesNow = scheduleRuleTimeToMinutes(zoned.hour, zoned.minute);
  const matchingRules = activeRules.filter((rule) => ruleMatchesNow(rule, zoned.dayLabel, minutesNow));

  if (matchingRules.some((rule) => rule.action === "Do not post")) {
    reasons.push("Schedule rejected. Posting is blocked during the current time window.");
  }

  const postRules = activeRules.filter((rule) => rule.action === "Post");
  if (postRules.length > 0 && !matchingRules.some((rule) => rule.action === "Post")) {
    reasons.push(
      `Schedule rejected. Current time (${zoned.dayLabel} ${zoned.hour}:${zoned.minute}, ${settings.timezone}) is outside the allowed posting schedule.`
    );
  }

  const dayStart = getStartOfZonedDay(postedAt, settings.timezone);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  for (const rule of matchingRules.filter((item) => item.action === "Post")) {
    if (rule.dailyPostLeadsLimit != null && rule.dailyPostLeadsLimit >= 0) {
      const postedCount = await countLeads(mappingId, dayStart, dayEnd);
      if (postedCount >= rule.dailyPostLeadsLimit) {
        reasons.push(
          `Schedule rejected. Daily post limit reached (${rule.dailyPostLeadsLimit} leads for the current day).`
        );
      }
    }

    if (rule.dailySoldLeadsLimit != null && rule.dailySoldLeadsLimit >= 0) {
      const soldCount = await countLeads(mappingId, dayStart, dayEnd, "success");
      if (soldCount >= rule.dailySoldLeadsLimit) {
        reasons.push(
          `Schedule rejected. Daily sold limit reached (${rule.dailySoldLeadsLimit} sold leads for the current day).`
        );
      }
    }
  }

  return reasons;
}

export function buildFieldOptionsMap(fields: MappingFieldDoc[]) {
  return new Map(
    fields.map((field) => [
      field.fieldName,
      (field.options ?? []).map((option) => ({
        value: option.value?.trim() || option.label?.trim() || "",
        label: option.label?.trim() || option.value?.trim() || "",
      })),
    ])
  );
}

export async function evaluateMappingIntakeRules(params: {
  mappingId: string;
  payload: Record<string, unknown>;
  settings: MappingIntakeSettingsRecord;
  fields: MappingFieldDoc[];
  postedAt: Date;
  checkDuplicate: DuplicateCheckFn;
  countLeads: LeadCountFn;
}) {
  const reasons: string[] = [];

  reasons.push(
    ...(await evaluateDuplicateRules(
      params.mappingId,
      params.payload,
      params.settings.duplicates,
      params.fields,
      params.checkDuplicate
    ))
  );

  reasons.push(
    ...evaluateGeneralFiltersForPayload(
      params.payload,
      params.settings.generalFilters,
      buildFieldOptionsMap(params.fields)
    )
  );

  reasons.push(
    ...(await evaluateScheduleRules(
      params.mappingId,
      params.settings,
      params.postedAt,
      params.countLeads
    ))
  );

  return reasons;
}

export { SCHEDULE_DAY_OPTIONS };
