import type {
  IntegrationBuilderArrayMappingEntry,
  IntegrationBuilderConfigField,
  IntegrationBuilderRequestMapping,
  IntegrationBuilderResponseMapping,
} from "@/lib/integration-builder";

export type IntegrationTemplateContext = {
  lead: Record<string, unknown>;
  config: Record<string, string>;
  mapped: Record<string, string>;
  response?: unknown;
};

const TWIG_BLOCK_PATTERN = /\{\{\s*([^}]+?)\s*\}\}/g;
const TEMPLATE_EXPRESSION_PATTERN = /^(lead|config|mapped|response)\.(.+)$/i;

function getValueAtPath(source: unknown, path: string): unknown {
  if (!path.trim()) return undefined;

  const segments = path.split(".").map((segment) => segment.trim()).filter(Boolean);
  let current: unknown = source;

  for (const segment of segments) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function findCaseInsensitiveKey(source: Record<string, unknown>, key: string) {
  const normalized = key.trim().toLowerCase();
  if (!normalized) return undefined;

  return Object.keys(source).find((entry) => entry.toLowerCase() === normalized);
}

export function readLeadFieldValue(lead: Record<string, unknown>, path: string): unknown {
  const normalizedPath = path.trim();
  if (!normalizedPath) return undefined;

  const directPath = getValueAtPath(lead, normalizedPath);
  if (directPath !== undefined) return directPath;

  if (!normalizedPath.includes(".")) {
    const matchedKey = findCaseInsensitiveKey(lead, normalizedPath);
    if (matchedKey) return lead[matchedKey];
  }

  const payload = lead.payload;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const payloadRecord = payload as Record<string, unknown>;
    const fromPayload = getValueAtPath(payloadRecord, normalizedPath);
    if (fromPayload !== undefined) return fromPayload;

    if (!normalizedPath.includes(".")) {
      const matchedKey = findCaseInsensitiveKey(payloadRecord, normalizedPath);
      if (matchedKey) return payloadRecord[matchedKey];
    }
  }

  return undefined;
}

export function buildLeadTemplateContext(lead: Record<string, unknown>) {
  const payload =
    lead.payload && typeof lead.payload === "object" && !Array.isArray(lead.payload)
      ? (lead.payload as Record<string, unknown>)
      : lead;

  return {
    ...payload,
    ...lead,
    payload,
  };
}

export function buildIntegrationRuntimeConfig(
  configFields: IntegrationBuilderConfigField[],
  configValues: Record<string, string>
) {
  const runtime: Record<string, string> = { ...configValues };

  for (const field of configFields) {
    const variableName = field.variableName.trim();
    if (!variableName) continue;
    if (runtime[variableName] === undefined) {
      runtime[variableName] = "";
    }
  }

  return runtime;
}

function stringifyTemplateValue(value: unknown) {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return String(value);
}

function resolveTemplateExpression(expression: string, context: IntegrationTemplateContext) {
  const match = expression.trim().match(TEMPLATE_EXPRESSION_PATTERN);
  if (!match) return "";

  const namespace = match[1].toLowerCase();
  const path = match[2]?.trim() ?? "";
  if (!path) return "";

  if (namespace === "lead") {
    return stringifyTemplateValue(readLeadFieldValue(context.lead, path));
  }

  if (namespace === "config") {
    const direct = context.config[path];
    if (direct !== undefined) return stringifyTemplateValue(direct);

    const matchedKey = findCaseInsensitiveKey(context.config, path);
    return matchedKey ? stringifyTemplateValue(context.config[matchedKey]) : "";
  }

  if (namespace === "mapped") {
    const direct = context.mapped[path];
    if (direct !== undefined) return stringifyTemplateValue(direct);

    const matchedKey = findCaseInsensitiveKey(context.mapped, path);
    return matchedKey ? stringifyTemplateValue(context.mapped[matchedKey]) : "";
  }

  if (namespace === "response") {
    return stringifyTemplateValue(getValueAtPath(context.response, path));
  }

  return "";
}

export function renderTwigTemplate(template: string, context: IntegrationTemplateContext) {
  if (!template.includes("{{")) {
    return template;
  }

  return template.replace(TWIG_BLOCK_PATTERN, (_, inner: string) => resolveTemplateExpression(inner, context));
}

export function resolveRequestMappingFieldName(rawName: string) {
  return rawName.trim();
}

export function resolveRequestMappingValue(rawValue: string, context: IntegrationTemplateContext) {
  return renderTwigTemplate(rawValue ?? "", context);
}

function coerceRequestMappingBodyValue(type: string | undefined, rendered: string) {
  const normalizedType = type?.trim().toLowerCase() ?? "string";

  if (normalizedType === "number") {
    const parsed = Number(rendered);
    return Number.isFinite(parsed) ? parsed : rendered;
  }

  if (normalizedType === "boolean") {
    return rendered === "true" || rendered === "1";
  }

  if (normalizedType === "object" || normalizedType === "array") {
    const trimmed = rendered.trim();
    if (!trimmed) return normalizedType === "array" ? [] : {};
    try {
      return JSON.parse(trimmed);
    } catch {
      return rendered;
    }
  }

  return rendered;
}

export function buildMappedValues(
  arrayMappings: IntegrationBuilderArrayMappingEntry[],
  lead: Record<string, unknown>
) {
  const mapped: Record<string, string> = {};

  for (const entry of arrayMappings) {
    const slug = entry.slug?.trim();
    if (!slug) continue;

    const leadValue = readLeadFieldValue(lead, entry.fieldName);
    const leadComparable = stringifyTemplateValue(leadValue).trim().toLowerCase();

    let resolved = stringifyTemplateValue(leadValue);

    for (const mapping of entry.mappings ?? []) {
      const label = mapping.label?.trim().toLowerCase() ?? "";
      const mappingValue = mapping.mapping?.trim() ?? "";
      if (!label) continue;

      if (leadComparable === label) {
        resolved = mappingValue;
        break;
      }
    }

    mapped[slug] = resolved;
  }

  return mapped;
}

export function buildIntegrationRequest(params: {
  requestMapping: IntegrationBuilderRequestMapping;
  lead: Record<string, unknown>;
  config: Record<string, string>;
  mapped: Record<string, string>;
}) {
  const context: IntegrationTemplateContext = {
    lead: buildLeadTemplateContext(params.lead),
    config: params.config,
    mapped: params.mapped,
  };

  const url = renderTwigTemplate(params.requestMapping.requestUrl, context).trim();
  const headers: Record<string, string> = {};

  for (const header of params.requestMapping.headers ?? []) {
    const key = header.key?.trim();
    if (!key) continue;
    headers[key] = renderTwigTemplate(header.value ?? "", context);
  }

  const body: Record<string, unknown> = {};
  for (const row of params.requestMapping.dataRows ?? []) {
    const fieldName = resolveRequestMappingFieldName(row.name ?? "");
    if (!fieldName) continue;

    const rendered = resolveRequestMappingValue(row.value ?? "", context);
    body[fieldName] = coerceRequestMappingBodyValue(row.type, rendered);
  }

  return {
    url,
    method: params.requestMapping.methodType?.trim().toUpperCase() || "POST",
    dataType: params.requestMapping.dataType?.trim().toUpperCase() || "JSON",
    headers,
    body,
  };
}

export type ParsedBuyerResponse = {
  soldSign: string;
  soldPrice: number | null;
  redirectUrl: string;
  rejectSign: string;
  rejectReason: string;
  errorReason: string;
  mappingError: boolean;
};

function evaluateResponseExpression(expression: string, response: unknown) {
  const trimmed = expression.trim();

  const equalityMatch = trimmed.match(/^response\.(.+?)\s*==\s*["'](.+?)["']$/);
  if (equalityMatch) {
    const left = stringifyTemplateValue(getValueAtPath(response, equalityMatch[1] ?? "")).trim();
    const right = (equalityMatch[2] ?? "").trim();
    return left.localeCompare(right, undefined, { sensitivity: "accent" }) === 0;
  }

  const pathMatch = trimmed.match(/^response\.(.+)$/);
  if (pathMatch) {
    return stringifyTemplateValue(getValueAtPath(response, pathMatch[1] ?? ""));
  }

  return trimmed;
}

function isAcceptedSoldSign(value: string) {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "true" ||
    normalized === "accept" ||
    normalized === "accepted" ||
    normalized === "sold" ||
    normalized === "approved" ||
    normalized === "success" ||
    normalized === "ok" ||
    normalized === "1" ||
    normalized === "yes"
  );
}

export function parseIntegrationResponse(
  responseMapping: IntegrationBuilderResponseMapping,
  rawResponseText: string
): ParsedBuyerResponse {
  const result: ParsedBuyerResponse = {
    soldSign: "",
    soldPrice: null,
    redirectUrl: "",
    rejectSign: "",
    rejectReason: "",
    errorReason: "",
    mappingError: false,
  };

  let parsedResponse: unknown = rawResponseText;
  const trimmed = rawResponseText.trim();

  if (trimmed) {
    try {
      parsedResponse = JSON.parse(trimmed);
    } catch {
      parsedResponse = { message: trimmed };
    }
  } else {
    parsedResponse = {};
  }

  const context: IntegrationTemplateContext = {
    lead: {},
    config: {},
    mapped: {},
    response: parsedResponse,
  };

  const fieldMap = new Map(
    (responseMapping.fields ?? []).map((field) => [field.key?.trim() ?? "", field.value ?? ""])
  );

  const readField = (key: string) => {
    const template = fieldMap.get(key)?.trim() ?? "";
    if (!template) {
      return "";
    }

    if (!template.includes("{{")) {
      return template;
    }

    return renderTwigTemplate(template, context).trim();
  };

  result.soldSign = readField("Sold::Sign");
  result.redirectUrl = readField("Sold::RedirectUrl");
  result.rejectSign = readField("Reject::Sign");
  result.rejectReason = readField("Reject::Reason");
  result.errorReason = readField("Error::Reason");

  const priceRaw = readField("Sold::Price");
  if (priceRaw) {
    const parsedPrice = Number(priceRaw.replace(/[^0-9.-]/g, ""));
    result.soldPrice = Number.isFinite(parsedPrice) ? parsedPrice : null;
  }

  const hasMapping =
    Boolean(fieldMap.get("Sold::Sign")?.trim()) ||
    Boolean(fieldMap.get("Reject::Sign")?.trim()) ||
    Boolean(fieldMap.get("Error::Reason")?.trim());

  if (!hasMapping && trimmed) {
    const responseRecord = parsedResponse as Record<string, unknown>;
    const status = stringifyTemplateValue(
      responseRecord.status ?? responseRecord.msg ?? responseRecord.message ?? responseRecord.status_text
    ).trim();
    result.soldSign = status;
    result.rejectSign = isAcceptedSoldSign(status) ? "" : status;
    result.rejectReason = stringifyTemplateValue(responseRecord.reject_reason ?? responseRecord.rejectReason);
    result.errorReason = stringifyTemplateValue(responseRecord.error_reason ?? responseRecord.errorReason);
    result.redirectUrl = stringifyTemplateValue(responseRecord.redirectUrl ?? responseRecord.redirect_url);
    const price = Number(responseRecord.price);
    result.soldPrice = Number.isFinite(price) ? price : null;
  }

  if (hasMapping) {
    const soldTemplate = fieldMap.get("Sold::Sign")?.trim() ?? "";
    const rejectTemplate = fieldMap.get("Reject::Sign")?.trim() ?? "";

    if (soldTemplate.includes("==")) {
      result.soldSign = evaluateResponseExpression(soldTemplate.replace(/\{\{\s*|\s*\}\}/g, ""), parsedResponse)
        ? "true"
        : "";
    }

    if (rejectTemplate.includes("==")) {
      result.rejectSign = evaluateResponseExpression(rejectTemplate.replace(/\{\{\s*|\s*\}\}/g, ""), parsedResponse)
        ? "true"
        : "";
    }

    if (!result.soldSign && !result.rejectSign && !result.errorReason && trimmed) {
      const responseRecord = parsedResponse as Record<string, unknown>;
      const statusText = stringifyTemplateValue(
        responseRecord.status ??
          responseRecord.msg ??
          responseRecord.message ??
          responseRecord.status_text
      ).trim();

      if (isAcceptedSoldSign(statusText)) {
        result.soldSign = statusText;
      } else {
        result.mappingError = true;
        result.errorReason = "Response mapping could not determine buyer status.";
      }
    }
  }

  return result;
}

export function inferBuyerStatusFromParsedResponse(parsed: ParsedBuyerResponse, minPrice: number) {
  if (parsed.mappingError) {
    return {
      status: "Error" as const,
      reason: parsed.errorReason || "Response mapping error.",
    };
  }

  if (parsed.errorReason) {
    return {
      status: "Error" as const,
      reason: parsed.errorReason,
    };
  }

  const soldComparable = parsed.soldSign.trim().toLowerCase();
  const rejectComparable = parsed.rejectSign.trim().toLowerCase();

  const isAccept = isAcceptedSoldSign(parsed.soldSign);

  const isReject =
    rejectComparable === "true" ||
    rejectComparable === "reject" ||
    rejectComparable === "rejected" ||
    rejectComparable === "declined" ||
    rejectComparable === "0" ||
    rejectComparable === "2" ||
    soldComparable === "2";

  if (isAccept) {
    if (parsed.soldPrice !== null && parsed.soldPrice < minPrice) {
      return {
        status: "Price Reject" as const,
        reason: `Buyer price ${parsed.soldPrice} is below campaign min price ${minPrice}.`,
      };
    }
    return { status: "Accept" as const, reason: "" };
  }

  if (soldComparable.includes("timeout")) {
    return { status: "Timeout" as const, reason: parsed.rejectReason || "Buyer request timed out." };
  }

  if (soldComparable.includes("price conflict") || rejectComparable.includes("price conflict")) {
    return { status: "Price Conflict" as const, reason: parsed.rejectReason || "Buyer price conflict." };
  }

  if (soldComparable.includes("price reject") || rejectComparable.includes("price reject")) {
    return { status: "Price Reject" as const, reason: parsed.rejectReason || "Buyer price below floor." };
  }

  if (isReject) {
    return { status: "Reject" as const, reason: parsed.rejectReason || "Buyer rejected the lead." };
  }

  if (parsed.soldSign || parsed.rejectSign) {
    return { status: "Error" as const, reason: "Unrecognized buyer response status." };
  }

  return { status: "Error" as const, reason: "Empty or unmapped buyer response." };
}
