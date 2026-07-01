import type { ApiFieldConfig } from "@/lib/mock-data";
import type { MappingTestLeadField } from "@/lib/mapping-test-lead";

export function toCampaignTestLeadFields(fields: ApiFieldConfig[]): MappingTestLeadField[] {
  return fields.map((field) => ({
    fieldName: field.fieldName,
    description: field.description,
    type: field.type,
    required: field.required,
    format: field.format,
    dataTypeFilter: field.dataTypeFilter,
    options: field.options ?? [],
  }));
}
