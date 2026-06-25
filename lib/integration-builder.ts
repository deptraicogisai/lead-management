import { normalizeResponseMapping } from "@/lib/response-mapping";

export type IntegrationBuilderStatus = "Active" | "Disabled" | "Deleted";

export const INTEGRATION_BUILDER_STATUS_DETAIL_OPTIONS: IntegrationBuilderStatus[] = [
  "Active",
  "Disabled",
  "Deleted",
];

export type IntegrationBuilderArrayMappingEntry = {
  fieldName: string;
  slug: string;
  mappings: Array<{
    label: string;
    mapping: string;
  }>;
};

type IntegrationBuilderArrayMappingEntryInput = {
  fieldName: string;
  slug: string;
  mappings?: Array<{
    label: string;
    mapping?: string | null;
  }> | null;
};

export type IntegrationBuilderRequestMappingHeader = {
  key: string;
  value: string;
};

export type IntegrationBuilderRequestMappingDataRow = {
  name: string;
  type: string;
  value: string;
};

export type IntegrationBuilderConfigField = {
  variableName: string;
  label: string;
  type: string;
  required: boolean;
};

export type IntegrationBuilderResponseMappingField = {
  key: string;
  value: string;
};

export type IntegrationBuilderResponseMapping = {
  dataType: string;
  fields: IntegrationBuilderResponseMappingField[];
};

export type IntegrationBuilderRequestMapping = {
  requestUrl: string;
  methodType: string;
  dataType: string;
  payloadType: string;
  isPrePingEnabled: boolean;
  headers: IntegrationBuilderRequestMappingHeader[];
  dataRows: IntegrationBuilderRequestMappingDataRow[];
};

export type IntegrationBuilderRecord = {
  id: string;
  displayId: number;
  name: string;
  status: IntegrationBuilderStatus;
  verticalId: string;
  product: string;
  productLabel: string;
  arrayMappings: IntegrationBuilderArrayMappingEntry[];
  requestMapping: IntegrationBuilderRequestMapping;
  responseMapping: IntegrationBuilderResponseMapping;
  configFields: IntegrationBuilderConfigField[];
  createdAt: string;
  updatedAt: string;
};

type IntegrationBuilderDoc = {
  _id?: { toString(): string };
  displayId: number;
  name: string;
  status: IntegrationBuilderStatus;
  verticalRef?: { toString(): string } | string | null;
  arrayMappings?: unknown;
  requestMapping?: unknown;
  responseMapping?: unknown;
  configFields?: unknown;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

export const DEFAULT_CONFIG_FIELDS: IntegrationBuilderConfigField[] = [
  { variableName: "url", label: "URL", type: "string", required: true },
  { variableName: "timeout", label: "Post timeout (seconds)", type: "number", required: false },
];

export function normalizeConfigFields(
  configFields?: IntegrationBuilderConfigField[] | null
): IntegrationBuilderConfigField[] {
  const savedFields = Array.isArray(configFields) ? configFields : [];
  const savedByVariable = new Map(
    savedFields
      .map((field) => ({
        variableName: field.variableName?.trim() ?? "",
        label: field.label?.trim() ?? "",
        type: field.type?.trim() || "string",
        required: Boolean(field.required),
      }))
      .filter((field) => field.variableName)
      .map((field) => [field.variableName, field] as const)
  );

  if (savedByVariable.size === 0) {
    return DEFAULT_CONFIG_FIELDS.map((field) => ({ ...field }));
  }

  const defaultVariables = new Set(DEFAULT_CONFIG_FIELDS.map((field) => field.variableName));
  return [
    ...DEFAULT_CONFIG_FIELDS.map((field) => {
      const saved = savedByVariable.get(field.variableName);
      return {
        variableName: field.variableName,
        label: saved?.label || field.label,
        type: saved?.type || field.type,
        required: saved ? saved.required : field.required,
      };
    }),
    ...savedFields
      .map((field) => ({
        variableName: field.variableName?.trim() ?? "",
        label: field.label?.trim() ?? "",
        type: field.type?.trim() || "string",
        required: Boolean(field.required),
      }))
      .filter((field) => field.variableName && !defaultVariables.has(field.variableName)),
  ];
}

function normalizeRequestMapping(
  requestMapping?: IntegrationBuilderRequestMapping | null
): IntegrationBuilderRequestMapping {
  return {
    requestUrl: requestMapping?.requestUrl?.trim() || "{{ config.url }}",
    methodType: requestMapping?.methodType?.trim() || "POST",
    dataType: requestMapping?.dataType?.trim() || "JSON",
    payloadType: requestMapping?.payloadType?.trim() || "Object",
    isPrePingEnabled: Boolean(requestMapping?.isPrePingEnabled),
    headers: Array.isArray(requestMapping?.headers)
      ? requestMapping.headers.map((row) => ({
          key: row.key?.trim() ?? "",
          value: row.value ?? "",
        }))
      : [],
    dataRows: Array.isArray(requestMapping?.dataRows)
      ? requestMapping.dataRows.map((row) => ({
          name: row.name?.trim() ?? "",
          type: row.type?.trim() || "String",
          value: row.value ?? "",
        }))
      : [],
  };
}

export { normalizeResponseMapping };

export function buildVerticalIndexMap(verticalIds: string[]) {
  return new Map(verticalIds.map((id, index) => [id, index + 1]));
}

export function formatProductLabel(verticalName: string, verticalIndex?: number) {
  if (!verticalIndex) return verticalName;
  return `[${verticalIndex}] ${verticalName}`;
}

export function toIntegrationBuilderRecord(
  doc: IntegrationBuilderDoc,
  verticalNameById: Map<string, string>,
  verticalIndexById?: Map<string, number>
): IntegrationBuilderRecord {
  const verticalId =
    typeof doc.verticalRef === "string" ? doc.verticalRef : doc.verticalRef?.toString() ?? "";
  const product = verticalNameById.get(verticalId) ?? "";
  const verticalIndex = verticalIndexById?.get(verticalId);

  return {
    id: doc._id?.toString() ?? "",
    displayId: doc.displayId,
    name: doc.name,
    status: doc.status,
    verticalId,
    product,
    productLabel: formatProductLabel(product, verticalIndex),
    arrayMappings: Array.isArray(doc.arrayMappings)
      ? doc.arrayMappings.map((entry) => {
          const row = entry as IntegrationBuilderArrayMappingEntryInput;
          return {
            fieldName: row.fieldName,
            slug: row.slug,
            mappings: Array.isArray(row.mappings)
              ? row.mappings.map((mappingRow) => ({
                  label: mappingRow.label,
                  mapping: mappingRow.mapping ?? "",
                }))
              : [],
          };
        })
      : [],
    requestMapping: normalizeRequestMapping(
      doc.requestMapping as IntegrationBuilderRequestMapping | null | undefined
    ),
    responseMapping: normalizeResponseMapping(
      doc.responseMapping as IntegrationBuilderResponseMapping | null | undefined
    ),
    configFields: normalizeConfigFields(doc.configFields as IntegrationBuilderConfigField[] | null | undefined),
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : "",
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : "",
  };
}
