function readBuyerResponseErrorMessage(responseBody: string) {
  const trimmed = responseBody.trim();
  if (!trimmed) return "";

  try {
    const record = JSON.parse(trimmed) as Record<string, unknown>;
    const candidates = [record.error_reason, record.errorReason, record.message, record.status_text];

    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
  } catch {
    if (trimmed.length <= 500) {
      return trimmed;
    }
  }

  return "";
}

const INVALID_API_KEY_MESSAGE = "Invalid API key.";

function isBuyerAuthenticationFailure(httpStatus: number, responseMessage: string) {
  const normalized = responseMessage.toLowerCase();

  return (
    httpStatus === 401 ||
    normalized.includes("invalid api key") ||
    normalized.includes("missing x-api-key") ||
    normalized.includes("buyer not matched")
  );
}

export function resolveBuyerPostErrorReason(httpStatus: number, responseBody: string) {
  const responseMessage = readBuyerResponseErrorMessage(responseBody);

  if (isBuyerAuthenticationFailure(httpStatus, responseMessage)) {
    return INVALID_API_KEY_MESSAGE;
  }

  if (responseMessage) {
    return responseMessage;
  }

  if (httpStatus === 404) {
    return INVALID_API_KEY_MESSAGE;
  }

  return `Buyer returned HTTP ${httpStatus}.`;
}
