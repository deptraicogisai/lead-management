import type { VerticalFieldOption } from "@/lib/vertical-field";

export type MappingFieldResponse = {
  id: string;
  fieldName: string;
  description: string;
  type: string;
  required: boolean;
  format: string;
  displayArrayMapping: boolean;
  dataTypeFilter: string | null;
  options: VerticalFieldOption[];
  emailDuplicateRule?: {
    mode: "days" | "forever";
    days?: number;
  };
  ignoreValues: string[];
  sourceVerticalFieldId?: string;
  isCustom: boolean;
};

export type MappingFieldPayload = {
  fieldName?: string;
  description?: string;
  type?: string;
  required?: boolean;
  format?: string;
  displayArrayMapping?: boolean;
  dataTypeFilter?: string | null;
  options?: Array<{
    label?: string;
    value?: string;
  }>;
  emailDuplicateRule?: {
    mode?: "days" | "forever";
    days?: number;
  };
  ignoreValues?: string[];
};

export type MappingFieldDoc = {
  _id?: { toString(): string };
  fieldName: string;
  description: string;
  type: string;
  required: boolean;
  format?: string | null;
  displayArrayMapping?: boolean | null;
  dataTypeFilter?: string | null;
  options?: Array<{
    label?: string | null;
    value?: string | null;
  }> | null;
  emailDuplicateRule?: {
    mode?: "days" | "forever" | null;
    days?: number | null;
  } | null;
  ignoreValues?: string[] | null;
  sourceVerticalFieldId?: string | null;
};

export function normalizeMappingFieldOptions(
  options?: Array<{ label?: string | null; value?: string | null }> | null
): VerticalFieldOption[] {
  if (!Array.isArray(options)) return [];

  return options
    .map((option) => ({
      label: option.label?.trim() ?? "",
      value: option.value?.trim() ?? "",
    }))
    .filter((option) => option.label || option.value)
    .map((option) => ({
      label: option.label,
      value: option.value || option.label,
    }));
}

export function toMappingFieldResponse(field: MappingFieldDoc): MappingFieldResponse {
  return {
    id: field._id?.toString() ?? "",
    fieldName: field.fieldName,
    description: field.description,
    type: field.type,
    required: field.required,
    format: field.format ?? "",
    displayArrayMapping: Boolean(field.displayArrayMapping),
    dataTypeFilter: field.dataTypeFilter?.trim() || null,
    options: normalizeMappingFieldOptions(field.options),
    emailDuplicateRule: field.emailDuplicateRule?.mode
      ? {
          mode: field.emailDuplicateRule.mode,
          ...(field.emailDuplicateRule.mode === "days" && typeof field.emailDuplicateRule.days === "number"
            ? { days: field.emailDuplicateRule.days }
            : {}),
        }
      : undefined,
    ignoreValues: Array.isArray(field.ignoreValues) ? field.ignoreValues : [],
    sourceVerticalFieldId: field.sourceVerticalFieldId ?? undefined,
    isCustom: !field.sourceVerticalFieldId,
  };
}

export function sanitizeIgnoreValues(ignoreValues?: string[]) {
  const seen = new Set<string>();

  return (ignoreValues ?? []).reduce<string[]>((accumulator, item) => {
    const normalized = item.trim();
    const dedupeKey = normalized.toLowerCase();

    if (!normalized || seen.has(dedupeKey)) {
      return accumulator;
    }

    seen.add(dedupeKey);
    accumulator.push(normalized);
    return accumulator;
  }, []);
}

export function normalizeMappingFieldConfig(body: MappingFieldPayload) {
  const normalizedType = body.type?.trim().toLowerCase() ?? "";
  const ignoreValues = normalizedType === "email" ? [] : sanitizeIgnoreValues(body.ignoreValues);

  if (normalizedType === "email") {
    const mode = body.emailDuplicateRule?.mode;

    if (mode !== "days" && mode !== "forever") {
      return { error: "Email duplicate rule is required for email fields." };
    }

    if (mode === "days") {
      const days = Number(body.emailDuplicateRule?.days);
      if (!Number.isInteger(days) || days <= 0) {
        return { error: "Duplicate email window must be a positive number of days." };
      }

      return {
        value: {
          format: "email",
          emailDuplicateRule: {
            mode,
            days,
          },
          ignoreValues,
        },
      };
    }

    return {
      value: {
        format: "email",
        emailDuplicateRule: {
          mode,
        },
        ignoreValues,
      },
    };
  }

  return {
    value: {
      format: body.format?.trim() || "",
      emailDuplicateRule: undefined,
      ignoreValues,
    },
  };
}
