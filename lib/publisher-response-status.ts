import { formatPublisherReasons, type PublisherReasons } from "@/lib/mapping-lead-validation";

/**
 * Publisher API JSON `status` codes:
 * 1 — Accepted
 * 2 — Rejected
 * 3 — Authentication or server error (auth failures + unexpected server errors)
 * 4 — Access Denied (publisher / channel / source paused)
 */
export const PUBLISHER_RESPONSE_STATUS = {
  accepted: 1,
  rejected: 2,
  error: 3,
  accessDenied: 4,
} as const;

export const PUBLISHER_RESPONSE_STATUS_TEXT = {
  accepted: "Accepted",
  rejected: "Rejected",
  error: "Authentication or server error",
  accessDenied: "Access Denied",
} as const;

export type PublisherResponseStatusCode =
  (typeof PUBLISHER_RESPONSE_STATUS)[keyof typeof PUBLISHER_RESPONSE_STATUS];

export function buildPublisherAcceptedResponse(): Record<string, unknown> {
  return {
    status: PUBLISHER_RESPONSE_STATUS.accepted,
    status_text: PUBLISHER_RESPONSE_STATUS_TEXT.accepted,
  };
}

export function buildPublisherRejectedResponse(reasons: string[]): Record<string, unknown> {
  return {
    status: PUBLISHER_RESPONSE_STATUS.rejected,
    status_text: PUBLISHER_RESPONSE_STATUS_TEXT.rejected,
    reasons: formatPublisherReasons(reasons),
  };
}

export function buildPublisherErrorResponse(reasons: string[]): Record<string, unknown> {
  return {
    status: PUBLISHER_RESPONSE_STATUS.error,
    status_text: PUBLISHER_RESPONSE_STATUS_TEXT.error,
    reasons: formatPublisherReasons(reasons),
  };
}

export function buildPublisherAccessDeniedResponse(reasons: string[]): Record<string, unknown> {
  return {
    status: PUBLISHER_RESPONSE_STATUS.accessDenied,
    status_text: PUBLISHER_RESPONSE_STATUS_TEXT.accessDenied,
    reasons: formatPublisherReasons(reasons),
  };
}

export function isPublisherErrorStatus(status: unknown): boolean {
  return status === PUBLISHER_RESPONSE_STATUS.error || status === "error";
}

export function resolvePublisherResponseReasons(value: unknown): PublisherReasons {
  if (typeof value === "string" || Array.isArray(value)) {
    if (typeof value === "string") {
      return value;
    }

    const messages = value
      .map((item) => {
        if (typeof item === "string") {
          return item.trim();
        }

        if (item && typeof item === "object" && "message" in item) {
          return String((item as { message: unknown }).message ?? "").trim();
        }

        return "";
      })
      .filter(Boolean);

    return formatPublisherReasons(messages);
  }

  return "";
}
