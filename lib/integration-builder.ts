import { normalizeResponseMapping } from "@/lib/response-mapping";

export type IntegrationBuilderStatus = "Active" | "Draft" | "Paused";
export type IntegrationBuilderPostingType = "Direct Post" | "Ping Post";

export type IntegrationBuilderArrayMappingEntry = {
  fieldName: string;
  slug: string;
  mappings: Array<{
    label: string;
    mapping: string;
  }>;
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
  postingType: IntegrationBuilderPostingType;
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
  postingType: IntegrationBuilderPostingType;
  verticalRef?: { toString(): string } | string | null;
  arrayMappings?: IntegrationBuilderArrayMappingEntry[] | null;
  requestMapping?: IntegrationBuilderRequestMapping | null;
  responseMapping?: IntegrationBuilderResponseMapping | null;
  configFields?: IntegrationBuilderConfigField[] | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

function normalizeConfigFields(
  configFields?: IntegrationBuilderConfigField[] | null
): IntegrationBuilderConfigField[] {
  if (!Array.isArray(configFields)) return [];

  return configFields.map((field) => ({
    variableName: field.variableName?.trim() ?? "",
    label: field.label?.trim() ?? "",
    type: field.type?.trim() || "string",
    required: Boolean(field.required),
  }));
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
    postingType: doc.postingType,
    verticalId,
    product,
    productLabel: formatProductLabel(product, verticalIndex),
    arrayMappings: Array.isArray(doc.arrayMappings)
      ? doc.arrayMappings.map((entry) => ({
          fieldName: entry.fieldName,
          slug: entry.slug,
          mappings: Array.isArray(entry.mappings)
            ? entry.mappings.map((row) => ({
                label: row.label,
                mapping: row.mapping ?? "",
              }))
            : [],
        }))
      : [],
    requestMapping: normalizeRequestMapping(doc.requestMapping as IntegrationBuilderRequestMapping | null),
    responseMapping: normalizeResponseMapping(doc.responseMapping as IntegrationBuilderResponseMapping | null),
    configFields: normalizeConfigFields(doc.configFields as IntegrationBuilderConfigField[] | null),
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : "",
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : "",
  };
}
