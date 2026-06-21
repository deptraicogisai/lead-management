export type VerticalFieldOption = {
  label: string;
  value: string;
};

export type VerticalFieldRecord = {
  id: string;
  fieldName: string;
  description: string;
  type: string;
  displayArrayMapping: boolean;
  dataTypeFilter?: string | null;
  options: VerticalFieldOption[];
  required?: boolean;
  format?: string;
  emailDuplicateRule?: {
    mode: "days" | "forever";
    days?: number;
  };
  ignoreValues?: string[];
};

export type VerticalFieldImportPayload = Omit<VerticalFieldRecord, "id">;

export type JsonUploadFieldImportResult =
  | { fields: VerticalFieldImportPayload[] }
  | { error: string }
  | { notBulk: true };

export type VerticalFieldImportItem = {
  field_name?: string;
  fieldName?: string;
  description?: string;
  data_type?: string | null;
  type?: string;
  display_array_mapping?: boolean | number;
  displayArrayMapping?: boolean | number;
  data_type_filter?: string | null;
  dataTypeFilter?: string | null;
  options?: Array<{
    label?: string;
    value?: string | number | null;
  }>;
};

export function fieldNameToSectionTitle(fieldName: string) {
  return fieldName.replace(/_/g, "").toUpperCase();
}

export function fieldNameToSlug(fieldName: string) {
  return fieldName.replace(/_([a-z0-9])/gi, (_, character: string) => character.toUpperCase());
}

export function normalizeVerticalFieldType(value?: string | null) {
  const normalized = (value ?? "").trim();
  if (!normalized) return "string";
  return normalized.toLowerCase();
}

export function formatVerticalFieldTypeLabel(value: string) {
  const normalized = value.trim();
  if (!normalized) return "-";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function normalizeOptionValue(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function isSingleFieldDefinitionPayload(payload: Record<string, unknown>) {
  const fieldName = String(payload.fieldName ?? payload.field_name ?? "").trim();
  const description = String(payload.description ?? "").trim();
  const type = String(payload.type ?? payload.data_type ?? "").trim();

  if (!fieldName || !description || !type) {
    return false;
  }

  const allowedKeys = new Set([
    "fieldName",
    "field_name",
    "description",
    "type",
    "data_type",
    "required",
    "format",
    "displayArrayMapping",
    "display_array_mapping",
    "dataTypeFilter",
    "data_type_filter",
    "options",
    "emailDuplicateRule",
    "ignoreValues",
  ]);

  return Object.keys(payload).every((key) => allowedKeys.has(key));
}

function isFieldDefinitionImportItem(value: unknown): value is VerticalFieldImportItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const item = value as VerticalFieldImportItem;
  const fieldName = (item.fieldName ?? item.field_name ?? "").trim();
  const description = (item.description ?? "").trim();
  const type = (item.type ?? item.data_type ?? "").trim();

  return Boolean(fieldName && description && type);
}

export function parseLeadSampleFieldImport(
  payload: Record<string, unknown>
): { fields: VerticalFieldImportPayload[] } | { error: string } {
  const entries = Object.entries(payload).filter(([key]) => key.trim());

  if (entries.length === 0) {
    return { error: "JSON object does not contain any fields." as const };
  }

  const fields = entries.map(([fieldName]) => ({
    fieldName,
    description: fieldName,
    type: "string",
    required: false,
    displayArrayMapping: false,
    options: [],
    ignoreValues: [],
  }));

  return { fields };
}

export function resolveJsonUploadFieldImport(payload: unknown): JsonUploadFieldImportResult {
  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      return { error: "JSON array is empty." as const };
    }

    if (isFieldDefinitionImportItem(payload[0])) {
      return parseVerticalFieldImport(payload);
    }

    const first = payload[0];
    if (first && typeof first === "object" && !Array.isArray(first)) {
      return parseLeadSampleFieldImport(first as Record<string, unknown>);
    }

    return { error: "JSON array must contain field definitions or a lead sample object." as const };
  }

  if (!payload || typeof payload !== "object") {
    return { error: "Upload JSON must be an object or array." as const };
  }

  if (Array.isArray((payload as { fields?: unknown }).fields)) {
    return parseVerticalFieldImport(payload);
  }

  const objectPayload = payload as Record<string, unknown>;

  if (isSingleFieldDefinitionPayload(objectPayload)) {
    return { notBulk: true as const };
  }

  return parseLeadSampleFieldImport(objectPayload);
}

export function parseVerticalFieldImportItem(
  item: VerticalFieldImportItem,
  index: number
): { value: Omit<VerticalFieldRecord, "id"> } | { error: string } {
  const fieldName = (item.field_name ?? item.fieldName ?? "").trim();
  const description = (item.description ?? "").trim();
  const type = normalizeVerticalFieldType(item.data_type ?? item.type);
  const displayArrayMappingRaw = item.display_array_mapping ?? item.displayArrayMapping ?? 0;
  const displayArrayMapping = displayArrayMappingRaw === true || displayArrayMappingRaw === 1;
  const dataTypeFilter = item.data_type_filter ?? item.dataTypeFilter ?? null;

  if (!fieldName) {
    return { error: `Row ${index + 1}: field_name is required.` };
  }

  if (!description) {
    return { error: `Row ${index + 1}: description is required.` };
  }

  const options = (item.options ?? []).reduce<VerticalFieldOption[]>((accumulator, option, optionIndex) => {
    const label = (option.label ?? "").trim();
    const value = normalizeOptionValue(option.value);

    if (!label && !value) {
      return accumulator;
    }

    if (!label) {
      return accumulator;
    }

    accumulator.push({
      label,
      value: value || label,
    });

    return accumulator;
  }, []);

  return {
    value: {
      fieldName,
      description,
      type,
      displayArrayMapping,
      dataTypeFilter: dataTypeFilter?.trim() || null,
      options,
      required: false,
      ignoreValues: [],
    },
  };
}

export function parseVerticalFieldImport(
  payload: unknown
): { fields: VerticalFieldImportPayload[] } | { error: string } {
  const items = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { fields?: unknown }).fields)
      ? (payload as { fields: unknown[] }).fields
      : null;

  if (!items) {
    return { error: "Import file must contain a JSON array of field definitions." as const };
  }

  const fields: VerticalFieldImportPayload[] = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index] as VerticalFieldImportItem;
    const parsed = parseVerticalFieldImportItem(item, index);

    if ("error" in parsed) {
      return { error: parsed.error };
    }

    fields.push(parsed.value);
  }

  return { fields };
}

export type ArrayMappingEntry = {
  fieldName: string;
  slug: string;
  mappings: Array<{
    label: string;
    mapping: string;
  }>;
};

export function buildDefaultArrayMappingEntry(field: Pick<VerticalFieldRecord, "fieldName" | "options">): ArrayMappingEntry {
  const optionRows = field.options.map((option) => ({
    label: option.value,
    mapping: "",
  }));

  return {
    fieldName: field.fieldName,
    slug: fieldNameToSlug(field.fieldName),
    mappings: [{ label: "Default", mapping: "" }, ...optionRows],
  };
}

export function mergeArrayMappingEntry(
  field: Pick<VerticalFieldRecord, "fieldName" | "options">,
  saved?: ArrayMappingEntry | null
): ArrayMappingEntry {
  const defaults = buildDefaultArrayMappingEntry(field);

  if (!saved) {
    return defaults;
  }

  const savedByLabel = new Map(saved.mappings.map((row) => [row.label, row.mapping]));

  return {
    fieldName: field.fieldName,
    slug: saved.slug || defaults.slug,
    mappings: defaults.mappings.map((row) => ({
      label: row.label,
      mapping: savedByLabel.get(row.label) ?? row.mapping,
    })),
  };
}
