type StringLikeId = { toString(): string } | string;

type VerticalFieldOptionSource = {
  label?: string | null;
  value?: string | null;
};

export type VerticalFieldSource = {
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
  displayArrayMapping?: boolean | null;
  dataTypeFilter?: string | null;
  options?: VerticalFieldOptionSource[] | null;
};

export type MappingFieldSource = {
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
  displayArrayMapping?: boolean | null;
  dataTypeFilter?: string | null;
  options?: VerticalFieldOptionSource[] | null;
};

export type EffectiveMappingField = {
  id: string;
  sourceVerticalFieldId?: string;
  fieldName: string;
  description: string;
  type: string;
  required: boolean;
  format: string;
  displayArrayMapping: boolean;
  dataTypeFilter: string | null;
  options: Array<{ label: string; value: string }>;
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

function normalizeOptions(options?: VerticalFieldOptionSource[] | null) {
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

function toEffectiveField(field: MappingFieldSource): EffectiveMappingField {
  return {
    id: toId(field._id) || field.fieldName,
    sourceVerticalFieldId: field.sourceVerticalFieldId ?? undefined,
    fieldName: field.fieldName,
    description: field.description,
    type: field.type,
    required: field.required,
    format: normalizeFormat(field.format),
    displayArrayMapping: Boolean(field.displayArrayMapping),
    dataTypeFilter: field.dataTypeFilter?.trim() || null,
    options: normalizeOptions(field.options),
    emailDuplicateRule: normalizeEmailDuplicateRule(field.emailDuplicateRule),
    ignoreValues: normalizeIgnoreValues(field.ignoreValues),
    isCustom: !field.sourceVerticalFieldId,
  };
}

export function buildCopiedFieldsFromVertical(verticalFields: VerticalFieldSource[] = []) {
  return verticalFields.map((field) => ({
    sourceVerticalFieldId: toId(field._id) || undefined,
    fieldName: field.fieldName,
    description: field.description,
    type: field.type,
    required: field.required,
    format: normalizeFormat(field.format),
    emailDuplicateRule: field.emailDuplicateRule ?? undefined,
    ignoreValues: normalizeIgnoreValues(field.ignoreValues),
    displayArrayMapping: Boolean(field.displayArrayMapping),
    dataTypeFilter: field.dataTypeFilter?.trim() || null,
    options: normalizeOptions(field.options),
  }));
}

export function mappingFieldsNeedSeeding(
  mappingFields: MappingFieldSource[] = [],
  verticalFields: VerticalFieldSource[] = []
) {
  if (verticalFields.length === 0) {
    return false;
  }

  if (mappingFields.length === 0) {
    return true;
  }

  const hasCopiedFields = mappingFields.some((field) => Boolean(field.sourceVerticalFieldId));
  if (hasCopiedFields) {
    return false;
  }

  // Older mappings were saved before vertical fields were copied into the seller API.
  return true;
}

export function buildSeededMappingFields(
  verticalFields: VerticalFieldSource[] = [],
  mappingFields: MappingFieldSource[] = []
) {
  const copiedFields = buildCopiedFieldsFromVertical(verticalFields);
  const customFields = getCustomMappingFields(mappingFields, verticalFields);

  return [...copiedFields, ...customFields];
}

export function getEffectiveMappingFields(
  verticalFields: VerticalFieldSource[] = [],
  mappingFields: MappingFieldSource[] = []
): EffectiveMappingField[] {
  if (mappingFields.length > 0) {
    return mappingFields.map(toEffectiveField);
  }

  return verticalFields.map((field) => ({
    id: toId(field._id) || field.fieldName,
    sourceVerticalFieldId: toId(field._id) || undefined,
    fieldName: field.fieldName,
    description: field.description,
    type: field.type,
    required: field.required,
    format: normalizeFormat(field.format),
    displayArrayMapping: Boolean(field.displayArrayMapping),
    dataTypeFilter: field.dataTypeFilter?.trim() || null,
    options: normalizeOptions(field.options),
    emailDuplicateRule: normalizeEmailDuplicateRule(field.emailDuplicateRule),
    ignoreValues: normalizeIgnoreValues(field.ignoreValues),
    isCustom: false,
  }));
}
