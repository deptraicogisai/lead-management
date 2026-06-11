export type FieldOptionLike = {
  label?: string | null;
  value?: string | null;
};

export type LeadFieldValueSource = {
  fieldName: string;
  description?: string | null;
  type: string;
  format?: string | null;
  options?: FieldOptionLike[] | null;
};

const SAMPLE_REQUEST_OVERRIDES: Record<string, unknown> = {
  fname: "Jim",
  first_name: "Jim",
  last_name: "Smith",
  zip_code: "550000",
  zip: "550000",
};

function normalizeType(type: string) {
  return type.trim().toLowerCase();
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function normalizeComparableValue(value: unknown) {
  if (typeof value === "string") return value.trim().toLowerCase();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim().toLowerCase();
  return "";
}

export function getFieldOptionValues(options: FieldOptionLike[] = []) {
  return options
    .map((option) => option.value?.trim() || option.label?.trim() || "")
    .filter(Boolean);
}

export function buildAllowedFieldOptionValues(options: FieldOptionLike[] = []) {
  const allowed = new Set<string>();

  for (const option of options) {
    const value = option.value?.trim().toLowerCase();
    const label = option.label?.trim().toLowerCase();

    if (value) allowed.add(value);
    if (label) allowed.add(label);
  }

  return allowed;
}

export function formatAcceptedValuesList(options: FieldOptionLike[] = []) {
  return getFieldOptionValues(options).join(", ");
}

export function isValueInFieldOptions(value: unknown, options: FieldOptionLike[] = []) {
  if (options.length === 0) return true;

  const comparable = normalizeComparableValue(value);
  if (!comparable) return true;

  return buildAllowedFieldOptionValues(options).has(comparable);
}

type RangeComparable = number | string;

function parseRangeComparable(value: string, options: FieldOptionLike[] = []): RangeComparable | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const matchedOption = options.find(
    (option) => option.value?.trim().toLowerCase() === trimmed.toLowerCase()
  );

  if (matchedOption?.value?.trim()) {
    const numeric = Number(matchedOption.value.trim());
    return Number.isNaN(numeric) ? matchedOption.value.trim() : numeric;
  }

  const directNumeric = Number(trimmed);
  if (!Number.isNaN(directNumeric)) return directNumeric;

  return trimmed;
}

function compareRangeValues(left: RangeComparable, right: RangeComparable) {
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  return String(left).localeCompare(String(right), undefined, { numeric: true });
}

function isWithinRangeComparable(
  value: RangeComparable,
  minValue: RangeComparable,
  maxValue: RangeComparable
) {
  const low = compareRangeValues(minValue, maxValue) <= 0 ? minValue : maxValue;
  const high = compareRangeValues(minValue, maxValue) <= 0 ? maxValue : minValue;

  return compareRangeValues(value, low) >= 0 && compareRangeValues(value, high) <= 0;
}

export function getRangeComparableValue(value: string, options: FieldOptionLike[] = []) {
  return parseRangeComparable(value, options);
}

export function getAllowedOptionValuesInRange(
  minValue: string,
  maxValue: string,
  options: FieldOptionLike[] = []
) {
  const minComparable = parseRangeComparable(minValue, options);
  const maxComparable = parseRangeComparable(maxValue, options);
  if (minComparable === null || maxComparable === null) return [];

  return getFieldOptionValues(options).filter((optionValue) => {
    const comparable = parseRangeComparable(optionValue, options);
    if (comparable === null) return false;
    return isWithinRangeComparable(comparable, minComparable, maxComparable);
  });
}

export function getMaxRangeOptions(minValue: string, options: FieldOptionLike[] = []) {
  if (!minValue.trim()) return options;

  const minComparable = parseRangeComparable(minValue, options);
  if (minComparable === null) return options;

  return options.filter((option) => {
    const optionValue = option.value?.trim() ?? "";
    if (!optionValue) return false;

    const comparable = parseRangeComparable(optionValue, options);
    if (comparable === null) return false;

    return compareRangeValues(comparable, minComparable) >= 0;
  });
}

export function isGeneralFilterRangeValid(
  minValue: string,
  maxValue: string,
  options: FieldOptionLike[] = []
) {
  if (!minValue.trim() || !maxValue.trim()) return true;

  const minComparable = parseRangeComparable(minValue, options);
  const maxComparable = parseRangeComparable(maxValue, options);
  if (minComparable === null || maxComparable === null) return true;

  return compareRangeValues(maxComparable, minComparable) >= 0;
}

export function isValueInRangeFilter(
  value: unknown,
  minValue: string,
  maxValue: string,
  options: FieldOptionLike[] = []
) {
  if (!normalizeComparableValue(value)) return false;

  const valueComparable = parseRangeComparable(String(value), options);
  const minComparable = parseRangeComparable(minValue, options);
  const maxComparable = parseRangeComparable(maxValue, options);

  if (valueComparable === null || minComparable === null || maxComparable === null) {
    return false;
  }

  return isWithinRangeComparable(valueComparable, minComparable, maxComparable);
}

export function buildAllowedCheckboxFilterValues(selectedValues: string[], options: FieldOptionLike[] = []) {
  const allowed = new Set<string>();

  for (const selected of selectedValues) {
    const normalizedSelected = selected.trim().toLowerCase();
    if (!normalizedSelected) continue;

    allowed.add(normalizedSelected);

    const matchedOption = options.find(
      (option) =>
        option.value?.trim().toLowerCase() === normalizedSelected ||
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

export function isValueInCheckboxFilter(
  value: unknown,
  selectedValues: string[],
  options: FieldOptionLike[] = []
) {
  const comparable = normalizeComparableValue(value);
  if (!comparable) return false;

  return buildAllowedCheckboxFilterValues(selectedValues, options).has(comparable);
}

function pickOptionExampleValue(field: LeadFieldValueSource) {
  const values = getFieldOptionValues(field.options ?? []);
  if (values.length === 0) return null;

  const index = hashString(field.fieldName) % values.length;
  return values[index];
}

function coerceExampleValue(raw: string, type: string) {
  const normalizedType = normalizeType(type);

  if (normalizedType === "boolean") {
    return raw.trim().toLowerCase() === "true";
  }

  if (normalizedType === "number" || normalizedType === "numeric" || normalizedType === "numberic") {
    const numeric = Number(raw);
    return Number.isNaN(numeric) ? raw : numeric;
  }

  return raw;
}

export function buildFieldExampleValue(field: LeadFieldValueSource): unknown {
  const optionValue = pickOptionExampleValue(field);
  if (optionValue) {
    return coerceExampleValue(optionValue, field.type);
  }

  const override = SAMPLE_REQUEST_OVERRIDES[field.fieldName] ?? SAMPLE_REQUEST_OVERRIDES[field.fieldName.toLowerCase()];
  if (override !== undefined) {
    return override;
  }

  const normalizedType = normalizeType(field.type);
  const normalizedFormat = field.format?.trim().toLowerCase() ?? "";
  const fieldName = field.fieldName.toLowerCase();

  if (normalizedType === "email" || normalizedFormat === "email" || fieldName.includes("email")) {
    return "jim@example.com";
  }

  if (normalizedFormat === "e.164" || fieldName.includes("phone")) {
    return "+15551234567";
  }

  if (normalizedType === "boolean") {
    return true;
  }

  if (normalizedType === "date") {
    return "2026-04-25";
  }

  if (normalizedType === "number" || normalizedType === "numeric" || normalizedType === "numberic") {
    if (fieldName.includes("amount") || fieldName.includes("income")) return 50000;
    if (fieldName.includes("age")) return 35;
    return 1000;
  }

  if (fieldName.includes("zip")) return "550000";
  if (fieldName.includes("ssn")) return "123456789";
  if (fieldName.includes("state")) return "CA";
  if (fieldName.includes("city")) return "New York";
  if (fieldName.includes("address") || fieldName.includes("street")) return "123 Main St";
  if (fieldName.includes("country")) return "US";
  if (fieldName.includes("last")) return "Smith";
  if (fieldName.includes("first") || fieldName.includes("fname")) return "Jim";

  if (normalizedType === "string") {
    return field.description?.trim() || field.fieldName.replace(/_/g, " ");
  }

  return field.description?.trim() || field.fieldName;
}

export function buildFieldExampleRequest(fields: LeadFieldValueSource[]) {
  return fields.reduce<Record<string, unknown>>((payload, field) => {
    payload[field.fieldName] = buildFieldExampleValue(field);
    return payload;
  }, {});
}
