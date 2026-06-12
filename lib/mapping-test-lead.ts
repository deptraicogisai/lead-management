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

const RANDOM_FIRST_NAMES = ["John", "Jane", "Michael", "Emily", "Robert", "Lisa", "David", "Sarah", "James", "Maria"];
const RANDOM_LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Davis", "Miller", "Wilson", "Moore", "Taylor", "Anderson"];
const RANDOM_STREETS = ["Main St", "Oak Ave", "Elm Dr", "Maple Rd", "Cedar Ln", "Pine Blvd", "Lake View Dr"];
const RANDOM_CITIES = ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Seattle", "Denver", "Atlanta"];
const RANDOM_STATES = ["CA", "TX", "FL", "NY", "IL", "WA", "AZ", "CO", "GA", "NC"];
const RANDOM_COMPANIES = ["Acme Corp", "Summit LLC", "Global Tech", "Bright Solutions", "Northline Inc", "Harbor Group"];
const RANDOM_JOB_TITLES = ["Engineer", "Manager", "Analyst", "Consultant", "Supervisor", "Specialist", "Coordinator"];

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem<T>(items: readonly T[]): T {
  return items[randomInt(0, items.length - 1)];
}

function randomLetters(length: number) {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  return Array.from({ length }, () => chars[randomInt(0, chars.length - 1)]).join("");
}

function randomDigits(length: number) {
  return Array.from({ length }, () => String(randomInt(0, 9))).join("");
}

function buildFieldContext(field: MappingTestLeadField) {
  const fieldName = field.fieldName.trim().toLowerCase();
  const description = field.description?.trim().toLowerCase() ?? "";
  const normalizedType = field.type.trim().toLowerCase();
  const normalizedFormat = field.format?.trim().toLowerCase() ?? "";

  return {
    fieldName,
    description,
    normalizedType,
    normalizedFormat,
    haystack: `${fieldName} ${description}`,
  };
}

function buildRandomFieldValue(field: MappingTestLeadField): string {
  if (field.options.length > 0) {
    const option = randomItem(field.options);
    return formatTestLeadOptionSelectValue(option, field);
  }

  const { fieldName, normalizedType, normalizedFormat, haystack } = buildFieldContext(field);

  if (normalizedType === "email" || normalizedFormat === "email" || haystack.includes("email")) {
    const localPart = `${randomItem(RANDOM_FIRST_NAMES).toLowerCase()}.${randomLetters(5)}${randomInt(1, 999)}`;
    return `${localPart}@example.com`;
  }

  if (normalizedFormat === "e.164" || haystack.includes("phone") || haystack.includes("mobile") || haystack.includes("cell")) {
    return `+1${randomDigits(10)}`;
  }

  if (normalizedType === "boolean") {
    return Math.random() > 0.5 ? "true" : "false";
  }

  if (normalizedType === "date") {
    const year = randomInt(2020, 2026);
    const month = String(randomInt(1, 12)).padStart(2, "0");
    const day = String(randomInt(1, 28)).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  if (isNumericFieldType(field.type)) {
    if (haystack.includes("amount") || haystack.includes("income") || haystack.includes("loan") || haystack.includes("salary")) {
      return String(randomInt(25000, 150000));
    }
    if (haystack.includes("age")) return String(randomInt(21, 65));
    if (haystack.includes("year")) return String(randomInt(2010, 2024));
    if (haystack.includes("month")) return String(randomInt(1, 12));
    return String(randomInt(100, 9999));
  }

  if (haystack.includes("ssn") || haystack.includes("social")) return randomDigits(9);
  if (haystack.includes("zip") || haystack.includes("postal")) return randomDigits(5);
  if (haystack.includes("state") && !haystack.includes("statement")) return randomItem(RANDOM_STATES);
  if (haystack.includes("city")) return randomItem(RANDOM_CITIES);
  if (haystack.includes("country")) return randomItem(["US", "USA"]);
  if (haystack.includes("address") || haystack.includes("street") || haystack.includes("addr")) {
    return `${randomInt(100, 9999)} ${randomItem(RANDOM_STREETS)}`;
  }
  if (
    haystack.includes("last name") ||
    haystack.includes("lastname") ||
    fieldName.includes("lname") ||
    fieldName.endsWith("_ln") ||
    fieldName === "lastname"
  ) {
    return randomItem(RANDOM_LAST_NAMES);
  }
  if (
    haystack.includes("first name") ||
    haystack.includes("firstname") ||
    fieldName.includes("fname") ||
    fieldName.endsWith("_fn") ||
    fieldName === "firstname"
  ) {
    return randomItem(RANDOM_FIRST_NAMES);
  }
  if (haystack.includes("employer") || haystack.includes("company") || haystack.includes("business")) {
    return randomItem(RANDOM_COMPANIES);
  }
  if (haystack.includes("occupation") || haystack.includes("job title") || haystack.includes("position")) {
    return randomItem(RANDOM_JOB_TITLES);
  }
  if (haystack.includes("routing")) return randomDigits(9);
  if (haystack.includes("account")) return randomDigits(10);
  if (haystack.includes("license") || haystack.includes(" dl")) return randomDigits(8);
  if (fieldName.includes("name") || haystack.includes(" full name")) {
    return `${randomItem(RANDOM_FIRST_NAMES)} ${randomItem(RANDOM_LAST_NAMES)}`;
  }
  if (haystack.includes("url") || haystack.includes("website")) {
    return `https://www.${randomLetters(8)}.example.com`;
  }
  if (haystack.includes("ip")) {
    return `${randomInt(1, 255)}.${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(1, 254)}`;
  }

  if (normalizedType === "string" || normalizedType === "text" || normalizedType === "") {
    const token = fieldName.split(/[^a-z0-9]+/).filter(Boolean)[0] ?? "value";
    return `${token}_${randomLetters(4)}${randomInt(10, 99)}`;
  }

  return `${fieldName}_${randomLetters(6)}`;
}

export function buildRandomTestLeadForm(fields: MappingTestLeadField[]) {
  return fields.reduce<Record<string, string>>((form, field) => {
    form[field.fieldName] = buildRandomFieldValue(field);
    return form;
  }, {});
}

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
