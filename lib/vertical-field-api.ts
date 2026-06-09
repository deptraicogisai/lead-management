import type { ApiFieldConfig } from "@/lib/mock-data";

export function toVerticalFieldResponse(doc: {
  _id?: { toString(): string };
  fieldName: string;
  description: string;
  type: string;
  required?: boolean;
  format?: string | null;
  emailDuplicateRule?: {
    mode?: "days" | "forever" | null;
    days?: number | null;
  } | null;
  ignoreValues?: string[] | null;
  displayArrayMapping?: boolean | null;
  dataTypeFilter?: string | null;
  options?: Array<{
    label?: string | null;
    value?: string | null;
  }> | null;
}): ApiFieldConfig {
  return {
    id: doc._id?.toString() ?? "",
    fieldName: doc.fieldName,
    description: doc.description,
    type: doc.type,
    displayArrayMapping: Boolean(doc.displayArrayMapping),
    dataTypeFilter: doc.dataTypeFilter ?? null,
    options: Array.isArray(doc.options)
      ? doc.options.map((option) => ({
          label: option.label ?? "",
          value: option.value ?? "",
        }))
      : [],
    required: Boolean(doc.required),
    format: doc.format ?? undefined,
    emailDuplicateRule: doc.emailDuplicateRule?.mode
      ? {
          mode: doc.emailDuplicateRule.mode,
          ...(doc.emailDuplicateRule.mode === "days" && typeof doc.emailDuplicateRule.days === "number"
            ? { days: doc.emailDuplicateRule.days }
            : {}),
        }
      : undefined,
    ignoreValues: Array.isArray(doc.ignoreValues) ? doc.ignoreValues : [],
  };
}
