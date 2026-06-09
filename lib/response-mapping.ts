export type IntegrationBuilderResponseMappingField = {
  key: string;
  value: string;
};

export type IntegrationBuilderResponseMapping = {
  dataType: string;
  fields: IntegrationBuilderResponseMappingField[];
};

export const DEFAULT_RESPONSE_MAPPING_FIELDS: IntegrationBuilderResponseMappingField[] = [
  { key: "Sold::Sign", value: '{{ response.message == "Approved" }}' },
  { key: "Sold::Price", value: "{{ response.result.price }}" },
  { key: "Sold::RedirectUrl", value: "{{ response.result.redirect_url }}" },
  { key: "Reject::Sign", value: '{{ response.message == "Declined" }}' },
  { key: "Reject::Reason", value: "" },
  { key: "Error::Reason", value: "Invalid response from buyer" },
];

export function normalizeResponseMapping(
  responseMapping?: IntegrationBuilderResponseMapping | null
): IntegrationBuilderResponseMapping {
  const dataType = responseMapping?.dataType?.trim() || "JSON";
  const savedFields = Array.isArray(responseMapping?.fields) ? responseMapping.fields : [];
  const savedByKey = new Map(
    savedFields
      .map((field) => ({
        key: field.key?.trim() ?? "",
        value: field.value ?? "",
      }))
      .filter((field) => field.key)
      .map((field) => [field.key, field.value] as const)
  );

  if (savedByKey.size === 0) {
    return {
      dataType,
      fields: DEFAULT_RESPONSE_MAPPING_FIELDS.map((field) => ({ ...field })),
    };
  }

  const defaultKeys = new Set(DEFAULT_RESPONSE_MAPPING_FIELDS.map((field) => field.key));
  const fields = [
    ...DEFAULT_RESPONSE_MAPPING_FIELDS.map((field) => ({
      key: field.key,
      value: savedByKey.get(field.key) ?? field.value,
    })),
    ...savedFields
      .filter((field) => field.key?.trim() && !defaultKeys.has(field.key.trim()))
      .map((field) => ({
        key: field.key.trim(),
        value: field.value ?? "",
      })),
  ];

  return { dataType, fields };
}
