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

function buildPayloadFieldValueMatch(fieldPath: string, value: string) {
  const conditions: Record<string, unknown>[] = [
    {
      [fieldPath]: {
        $regex: new RegExp(`^\\s*${escapeRegExp(value)}\\s*$`, "i"),
      },
    },
  ];

  if (/^-?\d+(\.\d+)?$/.test(value)) {
    const numericValue = Number(value);
    if (!Number.isNaN(numericValue)) {
      conditions.push({ [fieldPath]: numericValue });
    }
  }

  return conditions.length === 1 ? conditions[0] : { $or: conditions };
}

export async function validateMappingFieldConfiguration(
  payload: Record<string, unknown>,
  apiFields: MappingLeadFieldConfig[]
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
    }
  }

  return reasons;
}

function buildSsnFieldValueMatch(fieldPath: string, normalizedDigits: string) {
  const conditions: Record<string, unknown>[] = [buildPayloadFieldValueMatch(fieldPath, normalizedDigits)];

  if (/^\d{9}$/.test(normalizedDigits)) {
    const flexiblePattern = normalizedDigits.split("").join("\\D*");
    conditions.push({
      [fieldPath]: {
        $regex: new RegExp(`^\\s*${flexiblePattern}\\s*$`, "i"),
      },
    });
  }

  return conditions.length === 1 ? conditions[0] : { $or: conditions };
}

export function buildDuplicateExistsQuery(
  payload: Record<string, unknown>,
  fields: MappingFieldDoc[],
  duplicateKey: string
) {
  const { emailField, ssnField } = resolveDuplicateFieldNames(payload, fields);
  const parts = duplicateKey.split("|").map((part) => part.trim());

  if (parts.length === 2) {
    const [ssn, email] = parts;
    if (!ssn || !email) return null;

    return {
      $and: [
        buildPayloadFieldValueMatch(`payload.${emailField}`, email),
        buildSsnFieldValueMatch(`payload.${ssnField}`, ssn),
      ],
    };
  }

  return buildPayloadFieldValueMatch(`payload.${emailField}`, duplicateKey);
}

export type PublisherReasons = string | Array<{ message: string }>;

export function formatPublisherReasons(messages: string[]): PublisherReasons {
  const normalized = messages.map((message) => message.trim()).filter(Boolean);
  if (normalized.length <= 1) {
    return normalized[0] ?? "";
  }

  return normalized.map((message) => ({ message }));
}

export function buildLeadRejectResponse(reasons: string[]) {
  return {
    status: 2,
    status_text: "reject" as const,
    reasons: formatPublisherReasons(reasons),
  };
}

function normalizePublisherReasonsForDisplay(value: unknown): PublisherReasons {
  if (typeof value === "string") {
    return value;
  }

  if (!Array.isArray(value)) {
    return "";
  }

  const messages = value
    .map((item) => {
      if (typeof item === "string") {
        return item.trim();
      }

      if (item && typeof item === "object" && "message" in item) {
        return String((item as { message: unknown }).message ?? "").trim();
      }

      return "";
    })
    .filter(Boolean);

  return formatPublisherReasons(messages);
}

export function resolvePublisherReasonMessage(reasons: PublisherReasons): string {
  if (typeof reasons === "string") {
    return reasons;
  }

  return reasons[0]?.message?.trim() ?? "";
}

export function formatLeadRejectResponseBody(body: Record<string, unknown> | null | undefined) {
  if (!body) {
    return buildLeadRejectResponse([]);
  }

  return {
    status: typeof body.status === "number" ? body.status : 2,
    status_text: typeof body.status_text === "string" ? body.status_text : "reject",
    reasons: normalizePublisherReasonsForDisplay(body.reasons),
  };
}

export function formatBuyerPostResponseBody(params: {
  buyerStatus: string;
  price?: number | null;
  redirectUrl?: string | null;
  rejectReason?: string | null;
  errorReason?: string | null;
}) {
  if (params.buyerStatus === "Accept") {
    const response: Record<string, unknown> = {
      status: 1,
      status_text: "Sold",
    };

    if (params.price !== null && params.price !== undefined) {
      response.price = params.price;
    }

    const redirectUrl = params.redirectUrl?.trim() ?? "";
    if (redirectUrl) {
      response.redirect_url = redirectUrl;
    }

    return response;
  }

  const reasons = [params.rejectReason, params.errorReason]
    .map((value) => value?.trim() ?? "")
    .filter(Boolean);

  return formatLeadRejectResponseBody(
    buildLeadRejectResponse(reasons.length > 0 ? reasons : ["Buyer rejected the lead."]) as Record<string, unknown>
  );
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
      periodDays: number | null,
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
