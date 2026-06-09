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

export function parseVerticalFieldImport(payload: unknown) {
  const items = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { fields?: unknown }).fields)
      ? (payload as { fields: unknown[] }).fields
      : null;

  if (!items) {
    return { error: "Import file must contain a JSON array of field definitions." as const };
  }

  const fields: Omit<VerticalFieldRecord, "id">[] = [];

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
