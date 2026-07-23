import type { BuyerHttpRequestSnapshot, BuyerHttpResponseSnapshot } from "@/lib/buyer-post-request";
import { MOCK_BUYER_POST_BODY_KEY } from "@/lib/mock-buyer-post";

export type BuyerHttpExchangeLog = {
  request: BuyerHttpRequestSnapshot | null;
  response: BuyerHttpResponseSnapshot | null;
  publisherLead?: Record<string, unknown>;
  systemLead?: Record<string, unknown>;
  mappedValues?: Record<string, string>;
  errorMessage?: string;
};

export function snapshotFetchResponseHeaders(response: Response): Record<string, string> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
}

export function parseResponseBodyForDisplay(body: string): unknown {
  const trimmed = body.trim();
  if (!trimmed) {
    return "";
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return body;
  }
}

/** Strip internal/mock-only keys before showing request/response JSON in the UI. */
export function sanitizeLogPayloadForDisplay(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === MOCK_BUYER_POST_BODY_KEY || key.startsWith("__")) {
      continue;
    }
    next[key] = entry;
  }
  return next;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRequestSnapshot(value: unknown): BuyerHttpRequestSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }

  const url = typeof value.url === "string" ? value.url : "";
  const method = typeof value.method === "string" ? value.method : "POST";
  const headers = isRecord(value.headers)
    ? Object.fromEntries(
        Object.entries(value.headers).map(([key, headerValue]) => [key, String(headerValue ?? "")])
      )
    : {};
  const rawBody = isRecord(value.body) ? value.body : {};
  const body = sanitizeLogPayloadForDisplay(rawBody) as Record<string, unknown>;

  if (!url && Object.keys(body).length === 0 && Object.keys(headers).length === 0) {
    return null;
  }

  return { url, method, headers, body };
}

export function resolveBuyerHttpExchangeFromLog(params: {
  requestPayload: unknown;
  responseBody?: string;
  responseHeaders?: Record<string, string> | null;
  httpStatus?: number;
  errorMessage?: string;
}): BuyerHttpExchangeLog {
  const payload = params.requestPayload;
  let request: BuyerHttpRequestSnapshot | null = null;
  let publisherLead: Record<string, unknown> | undefined;
  let systemLead: Record<string, unknown> | undefined;
  let mappedValues: Record<string, string> | undefined;

  if (isRecord(payload)) {
    if (payload.request) {
      request = readRequestSnapshot(payload.request);
      publisherLead = isRecord(payload.publisherLead) ? payload.publisherLead : undefined;
      systemLead = isRecord(payload.systemLead) ? payload.systemLead : undefined;
      mappedValues = isRecord(payload.mappedValues)
        ? Object.fromEntries(
            Object.entries(payload.mappedValues).map(([key, value]) => [key, String(value ?? "")])
          )
        : undefined;
    } else if (payload.method || payload.url || payload.headers || payload.data) {
      request = readRequestSnapshot({
        url: payload.url,
        method: payload.method,
        headers: payload.headers,
        body: payload.data ?? payload.body,
      });
    } else if (payload.body) {
      request = readRequestSnapshot({
        url: "",
        method: "POST",
        headers: {},
        body: payload.body,
      });
    }
  }

  const responseBody = params.responseBody ?? "";
  const response: BuyerHttpResponseSnapshot | null =
    responseBody || params.httpStatus || params.responseHeaders
      ? {
          httpStatus: params.httpStatus ?? 0,
          headers: params.responseHeaders ?? {},
          body: responseBody,
        }
      : null;

  return {
    request,
    response,
    publisherLead,
    systemLead,
    mappedValues,
    errorMessage: params.errorMessage?.trim() || undefined,
  };
}

export function resolveBuyerHttpExchangeFromAttempt(params: {
  request: BuyerHttpRequestSnapshot | null;
  response: BuyerHttpResponseSnapshot;
  publisherLead?: Record<string, unknown>;
  systemLead?: Record<string, unknown>;
  mappedValues?: Record<string, string>;
  errorReason?: string;
}): BuyerHttpExchangeLog {
  return {
    request: params.request,
    response: params.response,
    publisherLead: params.publisherLead,
    systemLead: params.systemLead,
    mappedValues: params.mappedValues,
    errorMessage: params.errorReason?.trim() || undefined,
  };
}
