import type { DocumentationField } from "@/lib/api-documentation-content";
import type { EffectiveMappingField } from "@/lib/mapping-fields";

export function toDocumentationField(field: EffectiveMappingField): DocumentationField {
  return {
    id: field.id,
    fieldName: field.fieldName,
    description: field.description,
    type: field.type,
    required: field.required,
    format: field.format ?? "",
    emailDuplicateRule: field.emailDuplicateRule,
    ignoreValues: field.ignoreValues ?? [],
    options: field.options.map((option) => ({
      label: option.label,
      value: option.value,
    })),
  };
}
