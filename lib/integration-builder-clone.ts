import { DEFAULT_CONFIG_FIELDS } from "@/lib/integration-builder";

type CloneableIntegrationBuilder = {
  status: string;
  verticalRef?: unknown;
  arrayMappings?: unknown;
  requestMapping?: unknown;
  responseMapping?: unknown;
  configFields?: unknown;
};

function cloneValue<T>(value: T | null | undefined, fallback: T): T {
  if (value === null || value === undefined) {
    return fallback;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

export function buildClonedIntegrationBuilderPayload(
  source: CloneableIntegrationBuilder,
  name: string
) {
  return {
    name: name.trim(),
    status: source.status,
    verticalRef: source.verticalRef,
    arrayMappings: cloneValue(source.arrayMappings, []),
    requestMapping: cloneValue(source.requestMapping, undefined),
    responseMapping: cloneValue(source.responseMapping, undefined),
    configFields: cloneValue(source.configFields, DEFAULT_CONFIG_FIELDS.map((field) => ({ ...field }))),
  };
}
