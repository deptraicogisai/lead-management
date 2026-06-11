import type { MappingFieldDoc } from "@/lib/mapping-field-api";
import {
  evaluateMappingIntakeRules,
  resolveDuplicateFieldNames,
  type MappingIntakeSettingsRecord,
} from "@/lib/mapping-intake-settings";
import {
  formatAcceptedValuesList,
  isValueInFieldOptions,
  type FieldOptionLike,
} from "@/lib/lead-field-value";

export type MappingLeadFieldConfig = {
  fieldName: string;
  description: string;
  type: string;
  required: boolean;
  format?: string | null;
  ignoreValues?: string[] | null;
  options?: FieldOptionLike[] | null;
  emailDuplicateRule?: {
    mode?: "days" | "forever" | null;
    days?: number | null;
  } | null;
};

function isMissingRequired(value: unknown) {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

function isPresentValue(value: unknown) {
  return value !== undefined && value !== null && !(typeof value === "string" && value.trim() === "");
}

function normalizeComparableValue(value: unknown) {
  if (typeof value === "string") return value.trim().toLowerCase();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim().toLowerCase();
  return "";
}

function isValidByType(type: string, value: unknown) {
  const normalizedType = type.toLowerCase();
  if (normalizedType === "string") return typeof value === "string";
  if (normalizedType === "email") return typeof value === "string";
  if (normalizedType === "boolean") return typeof value === "boolean";
  if (normalizedType === "numberic" || normalizedType === "numeric" || normalizedType === "number") {
    return typeof value === "number" && !Number.isNaN(value);
  }
  if (normalizedType === "date") {
    if (value instanceof Date) return !Number.isNaN(value.getTime());
    if (typeof value === "string") return !Number.isNaN(Date.parse(value));
    return false;
  }
  return true;
}

function isValidByFormat(format: string | undefined, value: unknown) {
  if (value === undefined || value === null || format === undefined) return true;
  if (typeof value !== "string") return false;

  const normalized = format.trim().toLowerCase();
  if (normalized === "email") {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
  if (normalized === "e.164") {
    return /^\+[1-9]\d{1,14}$/.test(value);
  }
  return true;
}

function isIgnoredFieldValue(value: unknown, ignoreValues?: string[]) {
  const comparableValue = normalizeComparableValue(value);
  if (!comparableValue) return false;
  return (ignoreValues ?? []).some((item) => item.trim().toLowerCase() === comparableValue);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function validateMappingFieldConfiguration(
  payload: Record<string, unknown>,
  apiFields: MappingLeadFieldConfig[],
  checkEmailDuplicate: (
    fieldName: string,
    value: unknown,
    rule?: MappingLeadFieldConfig["emailDuplicateRule"]
  ) => Promise<boolean>
) {
  const reasons: string[] = [];

  for (const field of apiFields) {
    const value = payload[field.fieldName];
    const label = field.description?.trim() || field.fieldName;
    const normalizedType = field.type.trim().toLowerCase();

    if (field.required && isMissingRequired(value)) {
      reasons.push(`${label} is required.`);
      continue;
    }

    if (normalizedType !== "email" && isPresentValue(value) && isIgnoredFieldValue(value, field.ignoreValues ?? undefined)) {
      reasons.push(`${label} contains an ignored value and is not allowed.`);
      continue;
    }

    if (!isMissingRequired(value) && !isValidByType(field.type, value)) {
      reasons.push(`${label} has invalid type. Expected ${field.type}.`);
      continue;
    }

    if (!isMissingRequired(value) && !isValidByFormat(field.format || undefined, value)) {
      reasons.push(`${label} has invalid format (${field.format}).`);
      continue;
    }

    if (
      isPresentValue(value) &&
      (field.options?.length ?? 0) > 0 &&
      !isValueInFieldOptions(value, field.options ?? [])
    ) {
      reasons.push(`${label} must be one of the accepted values: ${formatAcceptedValuesList(field.options ?? [])}.`);
      continue;
    }

    if (
      normalizedType === "email" &&
      isPresentValue(value) &&
      (await checkEmailDuplicate(field.fieldName, value, field.emailDuplicateRule))
    ) {
      if (field.emailDuplicateRule?.mode === "days" && typeof field.emailDuplicateRule.days === "number") {
        reasons.push(`${label} already exists within ${field.emailDuplicateRule.days} day(s).`);
      } else {
        reasons.push(`${label} already exists in the system.`);
      }
    }
  }

  return reasons;
}

export function buildDuplicateExistsQuery(
  payload: Record<string, unknown>,
  fields: MappingFieldDoc[],
  duplicateKey: string
) {
  const { emailField, ssnField } = resolveDuplicateFieldNames(payload, fields);
  const parts = duplicateKey.split("|").map((part) => part.trim());

  if (parts.length === 2 && parts.some(Boolean)) {
    const [ssn, email] = parts;
    const andConditions: Record<string, unknown>[] = [];

    if (email) {
      andConditions.push({
        [`payload.${emailField}`]: {
          $regex: new RegExp(`^\\s*${escapeRegExp(email)}\\s*$`, "i"),
        },
      });
    }

    if (ssn) {
      andConditions.push({
        [`payload.${ssnField}`]: {
          $regex: new RegExp(`^\\s*${escapeRegExp(ssn)}\\s*$`, "i"),
        },
      });
    }

    return andConditions.length > 0 ? { $and: andConditions } : null;
  }

  return {
    [`payload.${emailField}`]: {
      $regex: new RegExp(`^\\s*${escapeRegExp(duplicateKey)}\\s*$`, "i"),
    },
  };
}

export function buildLeadRejectResponse(reasons: string[]) {
  return {
    status: 2,
    status_text: "reject" as const,
    reasons: reasons.map((message) => ({ message })),
  };
}

export async function validateMappingIntakeSettings(
  params: {
    mappingId: string;
    payload: Record<string, unknown>;
    settings: MappingIntakeSettingsRecord;
    fields: MappingFieldDoc[];
    postedAt: Date;
    checkDuplicate: (
      mappingId: string,
      duplicateKey: string,
      periodDays: number,
      validationStatus?: "success" | "fail"
    ) => Promise<boolean>;
    countLeads: (
      mappingId: string,
      from: Date,
      to: Date,
      validationStatus?: "success"
    ) => Promise<number>;
  }
) {
  return evaluateMappingIntakeRules(params);
}
