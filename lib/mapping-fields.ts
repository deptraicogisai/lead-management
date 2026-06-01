type StringLikeId = { toString(): string } | string;

type VerticalFieldSource = {
  _id?: StringLikeId;
  fieldName: string;
  description: string;
  type: string;
  required: boolean;
  format?: string | null;
  emailDuplicateRule?: {
    mode?: "days" | "forever" | null;
    days?: number | null;
  } | null;
  ignoreValues?: string[] | null;
};

type MappingFieldSource = {
  _id?: StringLikeId;
  sourceVerticalFieldId?: string | null;
  fieldName: string;
  description: string;
  type: string;
  required: boolean;
  format?: string | null;
  emailDuplicateRule?: {
    mode?: "days" | "forever" | null;
    days?: number | null;
  } | null;
  ignoreValues?: string[] | null;
};

export type EffectiveMappingField = {
  id: string;
  sourceVerticalFieldId?: string;
  fieldName: string;
  description: string;
  type: string;
  required: boolean;
  format: string;
  emailDuplicateRule?: {
    mode: "days" | "forever";
    days?: number;
  };
  ignoreValues: string[];
  isCustom: boolean;
};

function toId(value?: StringLikeId) {
  if (!value) return "";
  return typeof value === "string" ? value : value.toString();
}

function normalizeFormat(value?: string | null) {
  return value?.trim() ?? "";
}

function normalizeEmailDuplicateRule(rule?: {
  mode?: "days" | "forever" | null;
  days?: number | null;
} | null) {
  if (!rule?.mode) {
    return undefined;
  }

  if (rule.mode === "days" && typeof rule.days === "number") {
    return {
      mode: "days" as const,
      days: rule.days,
    };
  }

  return {
    mode: rule.mode,
  };
}

function normalizeIgnoreValues(values?: string[] | null) {
  return Array.isArray(values) ? values : [];
}

function normalizeFieldName(value: string) {
  return value.trim().toLowerCase();
}

export function getCustomMappingFields(
  fields: MappingFieldSource[] = [],
  verticalFields: VerticalFieldSource[] = []
) {
  const inheritedFieldNames = new Set(verticalFields.map((field) => normalizeFieldName(field.fieldName)));

  return fields.filter((field) => {
    if (field.sourceVerticalFieldId) {
      return false;
    }

    // Older mappings may still contain copied vertical fields without sourceVerticalFieldId.
    // When the vertical definition changes, those stale copies can look like custom fields.
    return !inheritedFieldNames.has(normalizeFieldName(field.fieldName));
  });
}

export function getEffectiveMappingFields(
  verticalFields: VerticalFieldSource[] = [],
  mappingFields: MappingFieldSource[] = []
): EffectiveMappingField[] {
  const inheritedFields = verticalFields.map((field) => ({
    id: toId(field._id) || field.fieldName,
    sourceVerticalFieldId: toId(field._id) || undefined,
    fieldName: field.fieldName,
    description: field.description,
    type: field.type,
    required: field.required,
    format: normalizeFormat(field.format),
    emailDuplicateRule: normalizeEmailDuplicateRule(field.emailDuplicateRule),
    ignoreValues: normalizeIgnoreValues(field.ignoreValues),
    isCustom: false,
  }));

  const customFields = getCustomMappingFields(mappingFields, verticalFields).map((field) => ({
    id: toId(field._id) || field.fieldName,
    sourceVerticalFieldId: undefined,
    fieldName: field.fieldName,
    description: field.description,
    type: field.type,
    required: field.required,
    format: normalizeFormat(field.format),
    emailDuplicateRule: normalizeEmailDuplicateRule(field.emailDuplicateRule),
    ignoreValues: normalizeIgnoreValues(field.ignoreValues),
    isCustom: true,
  }));

  return [...inheritedFields, ...customFields];
}
