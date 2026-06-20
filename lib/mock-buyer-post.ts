export type MockBuyerPostOptions = {
  buyerPrice?: number | null;
  responseDelaySeconds?: number | null;
  status?: string | null;
  statusText?: string | null;
  reason?: string | null;
  response?: Record<string, unknown> | null;
};

export const MOCK_BUYER_PRICE_HEADER = "x-mock-buyer-price";
export const MOCK_BUYER_RESPONSE_DELAY_HEADER = "x-mock-buyer-response-delay-seconds";
export const MOCK_BUYER_STATUS_HEADER = "x-mock-buyer-status";
export const MOCK_BUYER_STATUS_TEXT_HEADER = "x-mock-buyer-status-text";
export const MOCK_BUYER_REASON_HEADER = "x-mock-buyer-reason";
export const MOCK_BUYER_RESPONSE_JSON_HEADER = "x-mock-buyer-response-json";
export const MOCK_BUYER_POST_BODY_KEY = "__mockBuyerPostOptions";

function encodeMockResponseJson(response: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(response), "utf8").toString("base64");
}

function decodeMockResponseJson(value: string) {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64").toString("utf8")) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function sanitizeResponseRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

export function parseMockBuyerPostOptions(value: unknown): MockBuyerPostOptions | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const buyerPrice = Number(record.buyerPrice);
  const responseDelaySeconds = Number(record.responseDelaySeconds ?? record.timeoutSeconds);
  const status = typeof record.status === "string" ? record.status.trim() : "";
  const statusText = typeof record.statusText === "string" ? record.statusText.trim() : "";
  const reason = typeof record.reason === "string" ? record.reason.trim() : "";
  const response = sanitizeResponseRecord(record.response);

  const options: MockBuyerPostOptions = {};

  if (Number.isFinite(buyerPrice) && buyerPrice >= 0) {
    options.buyerPrice = buyerPrice;
  }

  if (Number.isFinite(responseDelaySeconds) && responseDelaySeconds >= 0) {
    options.responseDelaySeconds = responseDelaySeconds;
  }

  if (status) options.status = status;
  if (statusText) options.statusText = statusText;
  if (reason) options.reason = reason;
  if (response) options.response = response;

  return Object.keys(options).length > 0 ? options : undefined;
}

export function buildMockBuyerPostHeaders(options?: MockBuyerPostOptions | null): Record<string, string> {
  if (!options) return {};

  const headers: Record<string, string> = {};

  if (options.buyerPrice != null && Number.isFinite(options.buyerPrice)) {
    headers[MOCK_BUYER_PRICE_HEADER] = String(options.buyerPrice);
  }

  if (options.responseDelaySeconds != null && Number.isFinite(options.responseDelaySeconds)) {
    headers[MOCK_BUYER_RESPONSE_DELAY_HEADER] = String(options.responseDelaySeconds);
  }

  if (options.status?.trim()) {
    headers[MOCK_BUYER_STATUS_HEADER] = options.status.trim();
  }

  if (options.statusText?.trim()) {
    headers[MOCK_BUYER_STATUS_TEXT_HEADER] = options.statusText.trim();
  }

  if (options.reason?.trim()) {
    headers[MOCK_BUYER_REASON_HEADER] = options.reason.trim();
  }

  if (options.response && Object.keys(options.response).length > 0) {
    headers[MOCK_BUYER_RESPONSE_JSON_HEADER] = encodeMockResponseJson(options.response);
  }

  return headers;
}

export function mergeMockBuyerPostOptionRecords(
  primary?: MockBuyerPostOptions,
  fallback?: MockBuyerPostOptions
): MockBuyerPostOptions | undefined {
  if (!primary && !fallback) {
    return undefined;
  }

  if (!primary) {
    return fallback;
  }

  if (!fallback) {
    return primary;
  }

  return {
    buyerPrice: primary.buyerPrice ?? fallback.buyerPrice,
    responseDelaySeconds: primary.responseDelaySeconds ?? fallback.responseDelaySeconds,
    status: primary.status ?? fallback.status,
    statusText: primary.statusText ?? fallback.statusText,
    reason: primary.reason ?? fallback.reason,
    response: primary.response ?? fallback.response,
  };
}

export function readMockBuyerPostOptionsFromBody(body: unknown): MockBuyerPostOptions | undefined {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return undefined;
  }

  return parseMockBuyerPostOptions((body as Record<string, unknown>)[MOCK_BUYER_POST_BODY_KEY]);
}

export function readMockBuyerPostHeaders(req: Request): MockBuyerPostOptions | undefined {
  const buyerPriceRaw = req.headers.get(MOCK_BUYER_PRICE_HEADER);
  const delayRaw = req.headers.get(MOCK_BUYER_RESPONSE_DELAY_HEADER);
  const responseJsonRaw = req.headers.get(MOCK_BUYER_RESPONSE_JSON_HEADER);

  const options: MockBuyerPostOptions = {};

  if (buyerPriceRaw !== null && buyerPriceRaw.trim() !== "") {
    const buyerPrice = Number(buyerPriceRaw);
    if (Number.isFinite(buyerPrice) && buyerPrice >= 0) {
      options.buyerPrice = buyerPrice;
    }
  }

  if (delayRaw !== null && delayRaw.trim() !== "") {
    const responseDelaySeconds = Number(delayRaw);
    if (Number.isFinite(responseDelaySeconds) && responseDelaySeconds >= 0) {
      options.responseDelaySeconds = responseDelaySeconds;
    }
  }

  const status = req.headers.get(MOCK_BUYER_STATUS_HEADER);
  const statusText = req.headers.get(MOCK_BUYER_STATUS_TEXT_HEADER);
  const reason = req.headers.get(MOCK_BUYER_REASON_HEADER);

  if (status?.trim()) options.status = status.trim();
  if (statusText?.trim()) options.statusText = statusText.trim();
  if (reason?.trim()) options.reason = reason.trim();

  if (responseJsonRaw?.trim()) {
    const response = decodeMockResponseJson(responseJsonRaw.trim());
    if (response) {
      options.response = response;
    }
  }

  return Object.keys(options).length > 0 ? options : undefined;
}

export function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
