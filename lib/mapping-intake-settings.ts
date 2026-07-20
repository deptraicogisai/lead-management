import {
  buildGeneralFiltersFromVerticalFields,
  defaultCampaignDuplicates,
  isGeneralFilterRangeValid,
  SCHEDULE_DAY_OPTIONS,
  syncGeneralFiltersWithFields as syncGeneralFiltersWithVerticalFields,
  type CampaignDuplicatesSettings,
  type CampaignGeneralFilter,
  type CampaignScheduleRule,
} from "@/lib/campaign";
import type { MappingFieldDoc } from "@/lib/mapping-field-api";
import {
  buildRangeFilterRejectMessage,
  isValueInCheckboxFilter,
  isValueExcludedFromMultiSelectFilter,
  isValueInMultiSelectFilter,
  normalizeMultiSelectPayloadValues,
  isValueInRangeFilter,
  type FieldOptionLike,
} from "@/lib/lead-field-value";
import { resolveCampaignTimezone, resolveIanaTimeZone } from "@/lib/timezones";
import { getZonedDateTimeParts, getZonedDayRange } from "@/lib/date-range";

export type MappingIntakeSettingsRecord = {
  timezone: string;
  duplicates: CampaignDuplicatesSettings;
  generalFilters: CampaignGeneralFilter[];
  scheduleRules: CampaignScheduleRule[];
};

type MappingIntakeDoc = {
  timezone?: string | null;
  duplicates?: Partial<CampaignDuplicatesSettings> | null;
  generalFilters?: Array<
    Omit<CampaignGeneralFilter, "minValue" | "maxValue" | "textValue" | "selectedValues" | "multiSelectMode"> & {
      multiSelectMode?: CampaignGeneralFilter["multiSelectMode"] | null;
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

function formatPayloadValueForMessage(value: unknown) {
  if (value === undefined || value === null || (typeof value === "string" && !value.trim())) {
    return "(empty)";
  }
  return String(value);
}

function resolveTimezone(timezone: string) {
  return resolveIanaTimeZone(timezone);
}

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
  return syncGeneralFiltersWithVerticalFields(
    existing,
    fields.map((field) => ({
      id: field._id?.toString(),
      fieldName: field.fieldName,
      description: field.description,
      dataTypeFilter: field.dataTypeFilter,
    }))
  );
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
        multiSelectMode: filter.multiSelectMode ?? undefined,
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
    duplicates: {
      ...defaultCampaignDuplicates(),
      ...(doc.duplicates ?? {}),
    },
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

function readPayloadFieldValue(payload: Record<string, unknown>, fieldName: string) {
  const trimmed = fieldName.trim();
  if (!trimmed) return undefined;
  if (Object.prototype.hasOwnProperty.call(payload, trimmed)) {
    return payload[trimmed];
  }

  const target = trimmed.toLowerCase();
  for (const [key, value] of Object.entries(payload)) {
    if (key.trim().toLowerCase() === target) {
      return value;
    }
  }

  return undefined;
}

export function evaluateGeneralFiltersForPayload(
  payload: Record<string, unknown>,
  filters: CampaignGeneralFilter[],
  optionsByFieldName: Map<string, FieldOptionLike[]>
) {
  const reasons: string[] = [];

  for (const filter of filters) {
    if (!filter.enabled) continue;

    const value = readPayloadFieldValue(payload, filter.fieldName);
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
      if (!normalizeComparableValue(value)) {
        reasons.push(`${label} is required.`);
        continue;
      }

      if (!isValueInCheckboxFilter(value, filter.selectedValues ?? [], options)) {
        reasons.push(
          `${label} filter rejected. Allowed: ${(filter.selectedValues ?? []).join(", ")}. Received: ${formatPayloadValueForMessage(value)}.`
        );
      }
      continue;
    }

    if (filter.dataTypeFilter === "Multi Select" && (filter.selectedValues?.length ?? 0) > 0) {
      const submitted = normalizeMultiSelectPayloadValues(value);
      const mode = filter.multiSelectMode ?? "included";

      if (mode === "excluded") {
        if (!isValueExcludedFromMultiSelectFilter(value, filter.selectedValues ?? [], options)) {
          reasons.push(
            `${label} filter rejected. Must not contain: ${(filter.selectedValues ?? []).join(", ")}. Received: ${formatPayloadValueForMessage(value)}.`
          );
        }
        continue;
      }

      if (submitted.length === 0) {
        reasons.push(`${label} is required.`);
        continue;
      }

      if (!isValueInMultiSelectFilter(value, filter.selectedValues ?? [], options)) {
        reasons.push(
          `${label} filter rejected. Must contain one of: ${(filter.selectedValues ?? []).join(", ")}. Received: ${formatPayloadValueForMessage(value)}.`
        );
      }
      continue;
    }

    if (filter.dataTypeFilter === "Range" && filter.minValue && filter.maxValue) {
      if (!normalizeComparableValue(value)) {
        reasons.push(`${label} is required.`);
        continue;
      }

      if (!isValueInRangeFilter(value, filter.minValue, filter.maxValue, options)) {
        reasons.push(
          buildRangeFilterRejectMessage({
            label,
            value,
            minValue: filter.minValue,
            maxValue: filter.maxValue,
            options,
            formatValue: formatPayloadValueForMessage,
          })
        );
      }
    }
  }

  return reasons;
}

function parseDuplicatePeriodDays(period?: string | null) {
  if (!period) return null;
  const trimmed = period.trim();
  if (!trimmed || trimmed === "OFF") return null;
  if (trimmed === "1 day") return 1;

  const match = trimmed.match(/^(\d+)\s+days?$/i);
  return match ? Number(match[1]) : null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readPayloadIdentityValue(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && !Number.isNaN(value)) {
      return String(value).trim();
    }
    if (typeof value === "boolean") {
      return String(value).trim();
    }
  }
  return "";
}

function readPayloadString(payload: Record<string, unknown>, keys: string[]) {
  return readPayloadIdentityValue(payload, keys);
}

function isSsnLikeField(field: Pick<MappingFieldDoc, "fieldName" | "description" | "type">) {
  const name = field.fieldName.trim().toLowerCase();
  const description = field.description?.trim().toLowerCase() ?? "";
  const type = field.type.trim().toLowerCase();

  return (
    name === "ssn" ||
    name.includes("ssn") ||
    name.includes("social") ||
    description.includes("ssn") ||
    description.includes("social security") ||
    type === "ssn"
  );
}

function resolveSsnFieldName(payload: Record<string, unknown>, fields: MappingFieldDoc[]) {
  const configuredField = fields.find((field) => isSsnLikeField(field))?.fieldName;
  if (configuredField) {
    return configuredField;
  }

  for (const key of Object.keys(payload)) {
    const normalizedKey = key.trim().toLowerCase();
    if (
      normalizedKey === "ssn" ||
      normalizedKey.includes("ssn") ||
      normalizedKey.includes("social")
    ) {
      return key;
    }
  }

  return "ssn";
}

function isEmailLikeField(field: Pick<MappingFieldDoc, "fieldName" | "type" | "format">) {
  const type = field.type.trim().toLowerCase();
  const format = field.format?.trim().toLowerCase() ?? "";
  const name = field.fieldName.trim().toLowerCase();

  return type === "email" || format === "email" || name === "email" || name.includes("email");
}

function readEmailFromPayload(payload: Record<string, unknown>, fields: MappingFieldDoc[]) {
  const emailField =
    fields.find((field) => field.type.trim().toLowerCase() === "email")?.fieldName ??
    fields.find((field) => field.format?.trim().toLowerCase() === "email")?.fieldName ??
    fields.find((field) => field.fieldName.trim().toLowerCase() === "email")?.fieldName ??
    fields.find((field) => isEmailLikeField(field))?.fieldName;

  if (emailField) {
    const value = readPayloadIdentityValue(payload, [emailField]);
    if (value) return { emailField, email: value };
  }

  for (const field of fields) {
    const value = readPayloadIdentityValue(payload, [field.fieldName]);
    if (value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return { emailField: field.fieldName, email: value };
    }
  }

  const fallbackEmail = readPayloadString(payload, ["email", "Email", "EMAIL"]);
  if (fallbackEmail) {
    return { emailField: "email", email: fallbackEmail };
  }

  return { emailField: emailField ?? "email", email: "" };
}

export function resolveDuplicateFieldNames(payload: Record<string, unknown>, fields: MappingFieldDoc[]) {
  const { emailField } = readEmailFromPayload(payload, fields);
  const ssnField = resolveSsnFieldName(payload, fields);

  return { emailField, ssnField };
}

function normalizeSsnIdentity(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits || value.trim().toLowerCase();
}

function buildDuplicateKey(
  payload: Record<string, unknown>,
  method: CampaignDuplicatesSettings["duplicateMethod"],
  fields: MappingFieldDoc[]
) {
  const { email } = readEmailFromPayload(payload, fields);
  const { ssnField } = resolveDuplicateFieldNames(payload, fields);
  const ssn = readPayloadIdentityValue(payload, [ssnField, "ssn"]);

  if (method === "SSN + Email") {
    if (!email || !ssn) return "";
    return `${normalizeSsnIdentity(ssn)}|${email.toLowerCase()}`;
  }

  return email.toLowerCase();
}

type DuplicateCheckFn = (
  mappingId: string,
  duplicateKey: string,
  periodDays: number | null,
  validationStatus?: "success" | "fail"
) => Promise<boolean>;

function buildDuplicateRejectMessage(method: CampaignDuplicatesSettings["duplicateMethod"]) {
  if (method === "SSN + Email") {
    return "SSN and email cannot be duplicated.";
  }

  return "Email cannot be duplicated.";
}

export async function evaluateDuplicateRules(
  mappingId: string,
  payload: Record<string, unknown>,
  duplicates: CampaignDuplicatesSettings,
  fields: MappingFieldDoc[],
  checkDuplicate: DuplicateCheckFn
) {
  const reasons: string[] = [];
  const normalizedDuplicates = {
    ...defaultCampaignDuplicates(),
    ...duplicates,
  };
  const duplicateKey = buildDuplicateKey(payload, normalizedDuplicates.duplicateMethod, fields);
  if (!duplicateKey) return reasons;

  const duplicateMessage = buildDuplicateRejectMessage(normalizedDuplicates.duplicateMethod);

  const postedDays = parseDuplicatePeriodDays(normalizedDuplicates.duplicatePosted);
  const postedCheckPeriod = postedDays !== null ? postedDays : null;
  const postedDuplicateExists = await checkDuplicate(mappingId, duplicateKey, postedCheckPeriod);
  if (postedDuplicateExists) {
    reasons.push(duplicateMessage);
  }

  return reasons;
}

function getZonedParts(date: Date, timezone: string) {
  return getZonedDateTimeParts(date, resolveTimezone(timezone));
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

/** `to` is exclusive (next local midnight in the schedule timezone). */
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

  const timezone = resolveTimezone(settings.timezone);
  const zoned = getZonedParts(postedAt, timezone);
  if (!zoned) {
    reasons.push(`Schedule rejected. Unable to evaluate current time in timezone ${timezone}.`);
    return reasons;
  }

  const minutesNow = scheduleRuleTimeToMinutes(zoned.hour, zoned.minute);
  const matchingRules = activeRules.filter((rule) => ruleMatchesNow(rule, zoned.dayLabel, minutesNow));

  if (matchingRules.some((rule) => rule.action === "Do not post")) {
    reasons.push("Schedule rejected. Posting is blocked during the current time window.");
  }

  const postRules = activeRules.filter((rule) => rule.action === "Post");
  if (postRules.length > 0 && !matchingRules.some((rule) => rule.action === "Post")) {
    reasons.push(
      `Schedule rejected. Current time (${zoned.dayLabel} ${zoned.hour}:${zoned.minute}, ${timezone}) is outside the allowed posting schedule.`
    );
  }

  const dayRange = getZonedDayRange(postedAt, timezone);
  if (!dayRange) {
    reasons.push(`Schedule rejected. Unable to resolve the current day boundary in timezone ${timezone}.`);
    return reasons;
  }

  const { start: dayStart, endExclusive: dayEnd } = dayRange;

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

export async function evaluateMappingIntakeRulesByCategory(params: {
  mappingId: string;
  payload: Record<string, unknown>;
  settings: MappingIntakeSettingsRecord;
  fields: MappingFieldDoc[];
  postedAt: Date;
  checkDuplicate: DuplicateCheckFn;
  countLeads: LeadCountFn;
}) {
  const duplicateReasons = await evaluateDuplicateRules(
    params.mappingId,
    params.payload,
    params.settings.duplicates,
    params.fields,
    params.checkDuplicate
  );

  const filterReasons = evaluateGeneralFiltersForPayload(
    params.payload,
    params.settings.generalFilters,
    buildFieldOptionsMap(params.fields)
  );

  const scheduleReasons = await evaluateScheduleRules(
    params.mappingId,
    params.settings,
    params.postedAt,
    params.countLeads
  );

  return {
    duplicateReasons,
    filterReasons,
    scheduleReasons,
    allReasons: [...duplicateReasons, ...filterReasons, ...scheduleReasons],
  };
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

  const categorized = await evaluateMappingIntakeRulesByCategory(params);
  reasons.push(...categorized.allReasons);

  return reasons;
}

export { SCHEDULE_DAY_OPTIONS };
