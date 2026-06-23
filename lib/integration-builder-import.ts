import {
  DEFAULT_CONFIG_FIELDS,
  type IntegrationBuilderArrayMappingEntry,
  type IntegrationBuilderConfigField,
  type IntegrationBuilderRequestMapping,
  type IntegrationBuilderResponseMapping,
} from "@/lib/integration-builder";
import type { IntegrationBuilderExportPayload } from "@/lib/integration-builder-export";

export type IntegrationBuilderImportCreateData = {
  configFields: IntegrationBuilderConfigField[];
  arrayMappings: IntegrationBuilderArrayMappingEntry[];
  requestMapping: IntegrationBuilderRequestMapping;
  responseMapping: IntegrationBuilderResponseMapping;
};

function importMappedDataToMappings(data: Record<string, string>) {
  return Object.entries(data)
    .filter(([label]) => label.trim())
    .map(([label, mapping]) => ({
      label,
      mapping: mapping ?? "",
    }));
}

function importRequestFieldType(type: string) {
  const normalized = type.trim().toLowerCase();

  if (normalized === "number" || normalized === "integer" || normalized === "float") {
    return "Number";
  }

  if (normalized === "boolean") {
    return "Boolean";
  }

  return "String";
}

export function parseIntegrationBuilderImportSchema(
  raw: unknown
): { ok: true; schema: IntegrationBuilderExportPayload } | { ok: false; message: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, message: "Invalid JSON schema file." };
  }

  const schema = raw as Record<string, unknown>;

  if (!schema.name || typeof schema.name !== "string" || !schema.name.trim()) {
    return { ok: false, message: "Schema must include a name." };
  }

  const productId = Number(schema.productId);
  if (!Number.isFinite(productId) || productId < 1) {
    return { ok: false, message: "Schema must include a valid productId." };
  }

  if (!schema.request || typeof schema.request !== "object") {
    return { ok: false, message: "Schema must include request configuration." };
  }

  if (!schema.response || typeof schema.response !== "object") {
    return { ok: false, message: "Schema must include response configuration." };
  }

  return { ok: true, schema: raw as IntegrationBuilderExportPayload };
}

export function resolveImportVerticalId(productId: number, verticalIdsOldestFirst: string[]) {
  if (!Number.isInteger(productId) || productId < 1 || productId > verticalIdsOldestFirst.length) {
    return null;
  }

  return verticalIdsOldestFirst[productId - 1] ?? null;
}

export function buildIntegrationBuilderImportName(schemaName: string, existingNames: Iterable<string> = []) {
  const baseName = schemaName.trim();
  const existing = new Set([...existingNames].map((name) => name.trim().toLowerCase()));

  const firstCandidate = `${baseName} (Import)`;
  if (!existing.has(firstCandidate.toLowerCase())) {
    return firstCandidate;
  }

  let counter = 2;
  while (true) {
    const candidate = `${baseName} (Import) ${counter}`;
    if (!existing.has(candidate.toLowerCase())) {
      return candidate;
    }
    counter += 1;
  }
}

export function buildIntegrationBuilderImportCreateData(
  schema: IntegrationBuilderExportPayload
): IntegrationBuilderImportCreateData {
  const config = Array.isArray(schema.config) ? schema.config : [];
  const mapped = Array.isArray(schema.mapped) ? schema.mapped : [];
  const request = schema.request;
  const response = schema.response;

  const configFields =
    config.length > 0
      ? config
          .map((field) => ({
            variableName: field.slug?.trim() ?? "",
            label: field.label?.trim() || field.slug?.trim() || "",
            type: field.type?.trim() || "string",
            required: Boolean(field.required),
          }))
          .filter((field) => field.variableName)
      : DEFAULT_CONFIG_FIELDS.map((field) => ({ ...field }));

  const arrayMappings = mapped
    .map((entry) => ({
      fieldName: entry.field?.trim() || entry.slug?.trim() || "",
      slug: entry.slug?.trim() || entry.field?.trim() || "",
      mappings: importMappedDataToMappings(entry.data ?? {}),
    }))
    .filter((entry) => entry.fieldName && entry.slug);

  const headers = Object.entries(request.headers ?? {}).map(([key, value]) => ({
    key,
    value: String(value ?? ""),
  }));

  const dataRows = (request.data?.data ?? [])
    .map((row) => ({
      name: row._meta?.nodeName?.trim() ?? "",
      type: importRequestFieldType(row._meta?.type ?? "string"),
      value: row.data ?? "",
    }))
    .filter((row) => row.name);

  const requestMapping: IntegrationBuilderRequestMapping = {
    requestUrl: request.url?.trim() || "{{ config.url }}",
    methodType: request.methodType?.trim() || "POST",
    dataType: request.dataType?.trim() || "JSON",
    payloadType: "Object",
    isPrePingEnabled: false,
    headers,
    dataRows,
  };

  const responseMapping: IntegrationBuilderResponseMapping = {
    dataType: response?.dataType?.trim() || "JSON",
    fields: [
      { key: "Sold::Sign", value: response?.success?.sign ?? "" },
      { key: "Sold::Price", value: response?.success?.price ?? "" },
      { key: "Sold::RedirectUrl", value: response?.success?.redirectUrl ?? "" },
      { key: "Reject::Sign", value: response?.reject?.sign ?? "" },
      { key: "Reject::Reason", value: response?.reject?.reason ?? "" },
      { key: "Error::Reason", value: response?.error?.reason ?? "" },
    ],
  };

  return {
    configFields,
    arrayMappings,
    requestMapping,
    responseMapping,
  };
}
