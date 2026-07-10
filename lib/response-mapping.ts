export type IntegrationBuilderResponseMappingField = {
  key: string;
  value: string;
};

export type IntegrationBuilderResponseMapping = {
  dataType: string;
  fields: IntegrationBuilderResponseMappingField[];
};

/** Default value for Error::Reason in Response Mapping (editable by user). */
export const DEFAULT_ERROR_REASON = "Invalid response from buyer";

export const DEFAULT_RESPONSE_MAPPING_FIELDS: IntegrationBuilderResponseMappingField[] = [
  { key: "Sold::Sign", value: "" },
  { key: "Sold::Price", value: "" },
  { key: "Sold::RedirectUrl", value: "" },
  { key: "Reject::Sign", value: "" },
  { key: "Reject::Reason", value: "" },
  { key: "Error::Reason", value: DEFAULT_ERROR_REASON },
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
