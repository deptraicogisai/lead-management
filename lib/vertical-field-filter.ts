export const VERTICAL_DATA_TYPE_FILTER_OPTIONS = ["", "Text", "Range", "Checkbox", "Multi Select", "Dropdown"] as const;

export type VerticalDataTypeFilter = (typeof VERTICAL_DATA_TYPE_FILTER_OPTIONS)[number];

export const DATA_TYPE_FILTERS_WITH_OPTIONS = ["Range", "Checkbox", "Multi Select", "Dropdown"] as const;

export function dataTypeFilterUsesOptions(dataTypeFilter?: string | null) {
  const normalized = dataTypeFilter?.trim() ?? "";
  return (DATA_TYPE_FILTERS_WITH_OPTIONS as readonly string[]).includes(normalized);
}
