import { buildFieldExampleRequest, type LeadFieldValueSource } from "@/lib/lead-field-value";
import type { VerticalFieldOption } from "@/lib/vertical-field";

export type MappingTestLeadField = {
  fieldName: string;
  description: string;
  type: string;
  required: boolean;
  format?: string;
  options: VerticalFieldOption[];
};

export function buildEmptyTestLeadForm(fields: MappingTestLeadField[]) {
  return fields.reduce<Record<string, string>>((form, field) => {
    form[field.fieldName] = "";
    return form;
  }, {});
}

export function buildPrefilledTestLeadForm(fields: MappingTestLeadField[]) {
  const examples = buildFieldExampleRequest(fields as LeadFieldValueSource[]);

  return fields.reduce<Record<string, string>>((form, field) => {
    const example = examples[field.fieldName];

    if (example === undefined || example === null) {
      form[field.fieldName] = "";
      return form;
    }

    if (typeof example === "boolean") {
      form[field.fieldName] = example ? "true" : "false";
      return form;
    }

    if (field.options.length > 0) {
      const exampleText = String(example);
      const matched =
        field.options.find((option) => option.value === exampleText) ??
        field.options.find((option) => option.label === exampleText) ??
        field.options.find((option) => String(option.value) === exampleText);

      form[field.fieldName] = matched
        ? formatTestLeadOptionSelectValue(matched, field)
        : isNumericFieldType(field.type) && typeof example === "number"
          ? String(example)
          : exampleText;
      return form;
    }

    form[field.fieldName] = String(example);
    return form;
  }, {});
}

function normalizeBooleanFormValue(raw: string) {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "true" || normalized === "yes" || normalized === "1") return true;
  if (normalized === "false" || normalized === "no" || normalized === "0") return false;
  return raw;
}

export function isNumericFieldType(type: string) {
  const normalizedType = type.trim().toLowerCase();
  return normalizedType === "number" || normalizedType === "numeric" || normalizedType === "numberic";
}

function findMatchingOption(field: MappingTestLeadField, raw: string) {
  return (
    field.options.find((option) => option.value === raw) ??
    field.options.find((option) => option.label === raw) ??
    field.options.find((option) => String(option.value) === raw)
  );
}

export function formatTestLeadOptionSelectValue(option: VerticalFieldOption, field: MappingTestLeadField) {
  if (isNumericFieldType(field.type)) {
    const numeric = Number(option.value);
    if (!Number.isNaN(numeric)) {
      return String(numeric);
    }
  }

  if (field.type.trim().toLowerCase() === "boolean") {
    const normalized = option.value.trim().toLowerCase();
    if (normalized === "true" || normalized === "yes" || normalized === "1") return "true";
    if (normalized === "false" || normalized === "no" || normalized === "0") return "false";
  }

  return option.value;
}

export function formatTestLeadOptionLabel(option: VerticalFieldOption, field: MappingTestLeadField) {
  if (option.label.trim()) {
    return option.label;
  }

  return formatTestLeadOptionSelectValue(option, field);
}

export function coerceTestLeadFieldValue(field: MappingTestLeadField, raw: string) {
  if (!raw.trim()) {
    return undefined;
  }

  const normalizedType = field.type.trim().toLowerCase();

  if (field.options.length > 0) {
    const matched = findMatchingOption(field, raw);
    const resolved = matched?.value ?? raw;
    return coerceValueByFieldType(resolved, normalizedType);
  }

  if (normalizedType === "boolean") {
    return normalizeBooleanFormValue(raw);
  }

  if (isNumericFieldType(normalizedType)) {
    const numeric = Number(raw);
    return Number.isNaN(numeric) ? raw : numeric;
  }

  return raw;
}

function coerceValueByFieldType(value: string, type: string) {
  const normalizedType = type.trim().toLowerCase();

  if (normalizedType === "boolean") {
    return normalizeBooleanFormValue(value);
  }

  if (isNumericFieldType(normalizedType)) {
    const numeric = Number(value);
    return Number.isNaN(numeric) ? value : numeric;
  }

  return value;
}

export function buildTestLeadPayload(fields: MappingTestLeadField[], form: Record<string, string>) {
  const payload: Record<string, unknown> = {};

  for (const field of fields) {
    const raw = form[field.fieldName] ?? "";
    const coerced = coerceTestLeadFieldValue(field, raw);
    if (coerced === undefined) continue;

    payload[field.fieldName] = coerced;
  }

  return payload;
}

export function validateTestLeadForm(fields: MappingTestLeadField[], form: Record<string, string>) {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const label = field.description?.trim() || field.fieldName;
    const raw = form[field.fieldName] ?? "";

    if (field.required && !raw.trim()) {
      errors[field.fieldName] = `${label} is required.`;
    }
  }

  return errors;
}

export function chunkTestLeadFields<T>(fields: T[], chunkSize = 12) {
  const chunks: T[][] = [];

  for (let index = 0; index < fields.length; index += chunkSize) {
    chunks.push(fields.slice(index, index + chunkSize));
  }

  return chunks;
}
