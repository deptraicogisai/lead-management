import { normalizeResponseMapping } from "@/lib/response-mapping";
import {
  createDefaultRequestMapping,
  createDefaultResponseMapping,
  getDefaultConfigFields,
  normalizeIntegrationPostModel,
  type IntegrationPostModel,
} from "@/lib/integration-post-model";

export type { IntegrationPostModel } from "@/lib/integration-post-model";
export {
  INTEGRATION_POST_MODELS,
  DEFAULT_CONFIG_FIELDS_DIRECT,
  DEFAULT_CONFIG_FIELDS_PING_POST,
  convertConfigFieldsForPostModel,
  createDefaultRequestMapping,
  createDefaultResponseMapping,
  getDefaultConfigFields,
  getDefaultRequestUrl,
  isIntegrationPostModel,
  normalizeIntegrationPostModel,
  rewriteRequestUrlForPostModel,
} from "@/lib/integration-post-model";

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
  postModel: IntegrationPostModel;
  verticalId: string;
  product: string;
  productLabel: string;
  arrayMappings: IntegrationBuilderArrayMappingEntry[];
  requestMapping: IntegrationBuilderRequestMapping;
  /** Present when postModel is Ping Post; otherwise null. */
  pingRequestMapping: IntegrationBuilderRequestMapping | null;
  responseMapping: IntegrationBuilderResponseMapping;
  /** Present when postModel is Ping Post; otherwise null. */
  pingResponseMapping: IntegrationBuilderResponseMapping | null;
  configFields: IntegrationBuilderConfigField[];
  createdAt: string;
  updatedAt: string;
};

type IntegrationBuilderDoc = {
  _id?: { toString(): string };
  displayId: number;
  name: string;
  status: IntegrationBuilderStatus;
  postModel?: string | null;
  verticalRef?: { toString(): string } | string | null;
  arrayMappings?: unknown;
  requestMapping?: unknown;
  pingRequestMapping?: unknown;
  responseMapping?: unknown;
  pingResponseMapping?: unknown;
  configFields?: unknown;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

/** @deprecated Prefer getDefaultConfigFields(postModel) — kept for Direct Post create/import. */
export const DEFAULT_CONFIG_FIELDS: IntegrationBuilderConfigField[] = getDefaultConfigFields("Direct Post");

export function normalizeConfigFields(
  configFields?: IntegrationBuilderConfigField[] | null,
  postModel: IntegrationPostModel = "Direct Post"
): IntegrationBuilderConfigField[] {
  const defaults = getDefaultConfigFields(postModel);
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
    return defaults.map((field) => ({ ...field }));
  }

  const defaultVariables = new Set(defaults.map((field) => field.variableName));
  return [
    ...defaults.map((field) => {
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

export function normalizeRequestMapping(
  requestMapping?: IntegrationBuilderRequestMapping | null,
  fallbackUrl = "{{ config.url }}"
): IntegrationBuilderRequestMapping {
  return {
    requestUrl: requestMapping?.requestUrl?.trim() || fallbackUrl,
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
  const postModel = normalizeIntegrationPostModel(doc.postModel);
  const isPingPost = postModel === "Ping Post";

  return {
    id: doc._id?.toString() ?? "",
    displayId: doc.displayId,
    name: doc.name,
    status: doc.status,
    postModel,
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
      doc.requestMapping as IntegrationBuilderRequestMapping | null | undefined,
      isPingPost ? "{{ config.post_url }}" : "{{ config.url }}"
    ),
    pingRequestMapping: isPingPost
      ? normalizeRequestMapping(
          (doc.pingRequestMapping as IntegrationBuilderRequestMapping | null | undefined) ??
            createDefaultRequestMapping("Ping Post", "PING"),
          "{{ config.ping_url }}"
        )
      : null,
    responseMapping: normalizeResponseMapping(
      doc.responseMapping as IntegrationBuilderResponseMapping | null | undefined
    ),
    pingResponseMapping: isPingPost
      ? normalizeResponseMapping(
          (doc.pingResponseMapping as IntegrationBuilderResponseMapping | null | undefined) ??
            createDefaultResponseMapping()
        )
      : null,
    configFields: normalizeConfigFields(
      doc.configFields as IntegrationBuilderConfigField[] | null | undefined,
      postModel
    ),
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : "",
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : "",
  };
}
