import type { IntegrationBuilderRecord } from "@/lib/integration-builder";
import { DEFAULT_ERROR_REASON, normalizeResponseMapping } from "@/lib/response-mapping";

const EXPORT_TYPE = "direct" as const;
const EXPORT_VERSION = 1;

const EXPORT_ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";

export type IntegrationBuilderExportPayload = {
  type: typeof EXPORT_TYPE;
  version: typeof EXPORT_VERSION;
  productId: number;
  name: string;
  config: Array<{
    slug: string;
    label: string;
    type: string;
    required: boolean;
    id: string;
  }>;
  mapped: Array<{
    id: string;
    slug: string;
    field: string;
    data: Record<string, string>;
  }>;
  unwantedFields: {
    config: [];
  };
  leadStashRetrieval: false;
  request: {
    url: string;
    methodType: string;
    dataType: string;
    headers: Record<string, string>;
    queryParams: [];
    data: {
      _meta: {
        type: "object";
      };
      data: Array<{
        _meta: {
          type: string;
          nodeName: string;
        };
        data: string;
      }>;
    };
  };
  response: {
    dataType: string;
    success: {
      sign: string;
      price: string;
      redirectUrl: string;
    };
    priceReject: null;
    reject: {
      sign: string;
      reason: string;
    };
    error: {
      reason: string;
    };
    additionalVariables: [];
    pingPostCall: {
      enabled: false;
      durationToSell: string;
      campaignPhoneNumber: string;
      leadPhoneNumber: string;
    };
    smartTreeLeg: {
      enabled: false;
      ignoreLegsOnPost: false;
      ignorePriceOnPost: false;
      iterator: string;
      hash: string;
      status: string;
      price: string;
    };
    leadStashVariables: [];
    callLogic: {
      durationToSell: string;
      campaignPhoneNumber: string;
      leadPhoneNumber: string;
    };
    useLmsDefinedSettings: false;
    isCallLogic: false;
  };
};

function stableExportId(seed: string) {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }

  let result = "";
  let value = Math.abs(hash);

  for (let index = 0; index < 21; index += 1) {
    value = (value * 1103515245 + 12345) & 0x7fffffff;
    result += EXPORT_ID_CHARS[value % EXPORT_ID_CHARS.length];
  }

  return result;
}

function mapRequestFieldType(type: string) {
  const normalized = type.trim().toLowerCase();

  if (normalized === "number" || normalized === "integer" || normalized === "float") {
    return "number";
  }

  if (normalized === "boolean") {
    return "boolean";
  }

  if (normalized === "object") {
    return "object";
  }

  if (normalized === "array") {
    return "array";
  }

  return "string";
}

function buildMappedData(mappings: Array<{ label: string; mapping: string }>) {
  const data: Record<string, string> = {};
  const defaultRow = mappings.find((row) => row.label.trim().toLowerCase() === "_default");
  const firstMapping = mappings[0]?.mapping ?? "";

  data._default = defaultRow?.mapping ?? firstMapping;

  for (const row of mappings) {
    const label = row.label?.trim();
    if (!label || label.toLowerCase() === "_default") {
      continue;
    }

    data[label] = row.mapping ?? "";
  }

  return data;
}

function buildRequestHeaders(headers: Array<{ key: string; value: string }>) {
  return headers.reduce<Record<string, string>>((accumulator, header) => {
    const key = header.key?.trim();
    if (!key) {
      return accumulator;
    }

    accumulator[key] = header.value ?? "";
    return accumulator;
  }, {});
}

function getResponseFieldValue(fields: Array<{ key: string; value: string }>, key: string) {
  return fields.find((field) => field.key === key)?.value ?? "";
}

export function resolveIntegrationExportProductId(
  record: IntegrationBuilderRecord,
  verticalOptions: Array<{ id: string }>
) {
  const labelMatch = record.productLabel.match(/^\[(\d+)\]/);
  if (labelMatch) {
    return Number.parseInt(labelMatch[1], 10);
  }

  const index = verticalOptions.findIndex((option) => option.id === record.verticalId);
  return index >= 0 ? index + 1 : 1;
}

export function buildIntegrationBuilderExportPayload(
  record: IntegrationBuilderRecord,
  productId: number
): IntegrationBuilderExportPayload {
  const responseMapping = normalizeResponseMapping(record.responseMapping);
  const requestMapping = record.requestMapping;

  return {
    type: EXPORT_TYPE,
    version: EXPORT_VERSION,
    productId,
    name: record.name,
    config: record.configFields.map((field) => ({
      slug: field.variableName,
      label: field.label,
      type: field.type,
      required: field.required,
      id: stableExportId(`config:${record.id}:${field.variableName}`),
    })),
    mapped: record.arrayMappings.map((entry) => ({
      id: stableExportId(`mapped:${record.id}:${entry.slug}`),
      slug: entry.slug,
      field: entry.fieldName,
      data: buildMappedData(entry.mappings),
    })),
    unwantedFields: {
      config: [],
    },
    leadStashRetrieval: false,
    request: {
      url: requestMapping.requestUrl,
      methodType: requestMapping.methodType,
      dataType: requestMapping.dataType,
      headers: buildRequestHeaders(requestMapping.headers),
      queryParams: [],
      data: {
        _meta: {
          type: "object",
        },
        data: requestMapping.dataRows
          .filter((row) => row.name.trim())
          .map((row) => ({
            _meta: {
              type: mapRequestFieldType(row.type),
              nodeName: row.name.trim(),
            },
            data: row.value ?? "",
          })),
      },
    },
    response: {
      dataType: responseMapping.dataType,
      success: {
        sign: getResponseFieldValue(responseMapping.fields, "Sold::Sign"),
        price: getResponseFieldValue(responseMapping.fields, "Sold::Price"),
        redirectUrl: getResponseFieldValue(responseMapping.fields, "Sold::RedirectUrl"),
      },
      priceReject: null,
      reject: {
        sign: getResponseFieldValue(responseMapping.fields, "Reject::Sign"),
        reason: getResponseFieldValue(responseMapping.fields, "Reject::Reason"),
      },
      error: {
        reason: getResponseFieldValue(responseMapping.fields, "Error::Reason") || DEFAULT_ERROR_REASON,
      },
      additionalVariables: [],
      pingPostCall: {
        enabled: false,
        durationToSell: "{{ }}",
        campaignPhoneNumber: "{{ }}",
        leadPhoneNumber: "{{ }}",
      },
      smartTreeLeg: {
        enabled: false,
        ignoreLegsOnPost: false,
        ignorePriceOnPost: false,
        iterator: "{{ }}",
        hash: "{{ }}",
        status: "{{ }}",
        price: "{{ }}",
      },
      leadStashVariables: [],
      callLogic: {
        durationToSell: "{{ }}",
        campaignPhoneNumber: "{{ }}",
        leadPhoneNumber: "{{ }}",
      },
      useLmsDefinedSettings: false,
      isCallLogic: false,
    },
  };
}

export function buildIntegrationBuilderExportFileName(name: string) {
  const sanitized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${sanitized || "integration-builder"}.json`;
}

export function downloadJsonFile(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
