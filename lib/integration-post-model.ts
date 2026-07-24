import {
  DEFAULT_RESPONSE_MAPPING_FIELDS,
  type IntegrationBuilderResponseMapping,
} from "@/lib/response-mapping";

export const INTEGRATION_POST_MODELS = ["Direct Post", "Ping Post"] as const;
export type IntegrationPostModel = (typeof INTEGRATION_POST_MODELS)[number];

export function isIntegrationPostModel(value: unknown): value is IntegrationPostModel {
  return value === "Direct Post" || value === "Ping Post";
}

export function normalizeIntegrationPostModel(value: unknown): IntegrationPostModel {
  return isIntegrationPostModel(value) ? value : "Direct Post";
}

export type PostModelConfigField = {
  variableName: string;
  label: string;
  type: string;
  required: boolean;
};

export type PostModelRequestMapping = {
  requestUrl: string;
  methodType: string;
  dataType: string;
  payloadType: string;
  isPrePingEnabled: boolean;
  headers: Array<{ key: string; value: string }>;
  dataRows: Array<{ name: string; type: string; value: string }>;
};

export const DEFAULT_CONFIG_FIELDS_DIRECT: PostModelConfigField[] = [
  { variableName: "url", label: "URL", type: "string", required: true },
  { variableName: "timeout", label: "Post timeout (seconds)", type: "number", required: false },
];

/** Auto-created when Post Model is Ping Post. */
export const DEFAULT_CONFIG_FIELDS_PING_POST: PostModelConfigField[] = [
  { variableName: "ping_url", label: "Ping URL", type: "string", required: true },
  { variableName: "ping_timeout", label: "Ping Timeout", type: "string", required: false },
  { variableName: "post_url", label: "Post URL", type: "string", required: true },
  { variableName: "post_timeout", label: "Post Timeout", type: "string", required: false },
];

const DIRECT_ONLY_VARIABLES = new Set(["url", "timeout"]);
const PING_POST_VARIABLES = new Set(["ping_url", "ping_timeout", "post_url", "post_timeout"]);

export function getDefaultConfigFields(postModel: IntegrationPostModel): PostModelConfigField[] {
  const source =
    postModel === "Ping Post" ? DEFAULT_CONFIG_FIELDS_PING_POST : DEFAULT_CONFIG_FIELDS_DIRECT;
  return source.map((field) => ({ ...field }));
}

export function getDefaultRequestUrl(postModel: IntegrationPostModel, phase: "POST" | "PING" = "POST") {
  if (postModel === "Ping Post") {
    return phase === "PING" ? "{{ config.ping_url }}" : "{{ config.post_url }}";
  }
  return "{{ config.url }}";
}

export function createDefaultRequestMapping(
  postModel: IntegrationPostModel,
  phase: "POST" | "PING" = "POST"
): PostModelRequestMapping {
  return {
    requestUrl: getDefaultRequestUrl(postModel, phase),
    methodType: "POST",
    dataType: "JSON",
    payloadType: "Object",
    isPrePingEnabled: false,
    headers: [],
    dataRows: [],
  };
}

export function createDefaultResponseMapping(): IntegrationBuilderResponseMapping {
  return {
    dataType: "JSON",
    fields: DEFAULT_RESPONSE_MAPPING_FIELDS.map((field) => ({ ...field })),
  };
}

function readConfigValue(
  byVariable: Map<string, PostModelConfigField>,
  ...keys: string[]
): PostModelConfigField | undefined {
  for (const key of keys) {
    const found = byVariable.get(key);
    if (found) return found;
  }
  return undefined;
}

/**
 * Convert Integration Config field list when switching Post Model.
 * Direct → Ping: seed ping/post URL+timeout (migrate url/timeout into post_*).
 * Ping → Direct: drop ping_* / post_*, restore url/timeout from post_* when present.
 */
export function convertConfigFieldsForPostModel(
  current: PostModelConfigField[] | null | undefined,
  nextModel: IntegrationPostModel
): PostModelConfigField[] {
  const rows = Array.isArray(current) ? current : [];
  const byVariable = new Map(
    rows
      .map((field) => ({
        variableName: field.variableName?.trim() ?? "",
        label: field.label?.trim() ?? "",
        type: field.type?.trim() || "string",
        required: Boolean(field.required),
      }))
      .filter((field) => field.variableName)
      .map((field) => [field.variableName, field] as const)
  );

  if (nextModel === "Ping Post") {
    const defaults = getDefaultConfigFields("Ping Post").map((field) => {
      if (field.variableName === "post_url") {
        const saved = readConfigValue(byVariable, "post_url", "url");
        return {
          ...field,
          label: saved?.label || field.label,
          type: saved?.type || field.type,
          required: saved ? saved.required : field.required,
        };
      }
      if (field.variableName === "post_timeout") {
        const saved = readConfigValue(byVariable, "post_timeout", "timeout");
        return {
          ...field,
          label: saved?.label || field.label,
          type: saved?.type || field.type,
          required: saved ? saved.required : field.required,
        };
      }
      const saved = byVariable.get(field.variableName);
      return {
        ...field,
        label: saved?.label || field.label,
        type: saved?.type || field.type,
        required: saved ? saved.required : field.required,
      };
    });

    const extras = rows
      .map((field) => ({
        variableName: field.variableName?.trim() ?? "",
        label: field.label?.trim() ?? "",
        type: field.type?.trim() || "string",
        required: Boolean(field.required),
      }))
      .filter(
        (field) =>
          field.variableName &&
          !PING_POST_VARIABLES.has(field.variableName) &&
          !DIRECT_ONLY_VARIABLES.has(field.variableName)
      );

    return [...defaults, ...extras];
  }

  const defaults = getDefaultConfigFields("Direct Post").map((field) => {
    if (field.variableName === "url") {
      const saved = readConfigValue(byVariable, "url", "post_url");
      return {
        ...field,
        label: saved?.label || field.label,
        type: saved?.type || field.type,
        required: saved ? saved.required : field.required,
      };
    }
    if (field.variableName === "timeout") {
      const saved = readConfigValue(byVariable, "timeout", "post_timeout");
      return {
        ...field,
        label: saved?.label || field.label,
        type: saved?.type || field.type,
        required: saved ? saved.required : field.required,
      };
    }
    return { ...field };
  });

  const extras = rows
    .map((field) => ({
      variableName: field.variableName?.trim() ?? "",
      label: field.label?.trim() ?? "",
      type: field.type?.trim() || "string",
      required: Boolean(field.required),
    }))
    .filter(
      (field) =>
        field.variableName &&
        !DIRECT_ONLY_VARIABLES.has(field.variableName) &&
        !PING_POST_VARIABLES.has(field.variableName)
    );

  return [...defaults, ...extras];
}

export function rewriteRequestUrlForPostModel(
  requestUrl: string,
  nextModel: IntegrationPostModel
): string {
  const trimmed = requestUrl.trim();
  if (nextModel === "Ping Post") {
    if (!trimmed || trimmed === "{{ config.url }}") return "{{ config.post_url }}";
    return trimmed;
  }
  if (!trimmed || trimmed === "{{ config.post_url }}") return "{{ config.url }}";
  return trimmed;
}
