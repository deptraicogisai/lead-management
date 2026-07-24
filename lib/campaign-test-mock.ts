import type { MockBuyerPostOptions } from "@/lib/mock-buyer-post";
import { formatPublisherReasons } from "@/lib/mapping-lead-validation";

export const CAMPAIGN_TEST_MOCK_STATUS_OPTIONS = ["Accept", "Reject"] as const;

export type CampaignTestMockStatus = (typeof CAMPAIGN_TEST_MOCK_STATUS_OPTIONS)[number];

export type CampaignTestMockPhaseConfig = {
  timeoutSeconds: number | null;
  status: CampaignTestMockStatus;
  price: number | null;
  redirectUrl: string;
  reasons: string[];
};

export type CampaignTestMockResponse = CampaignTestMockPhaseConfig & {
  /** Present when campaign integration is Ping Post — mock for the Ping phase. */
  ping?: CampaignTestMockPhaseConfig | null;
};

export const DEFAULT_CAMPAIGN_TEST_MOCK_PHASE: CampaignTestMockPhaseConfig = {
  timeoutSeconds: 0,
  status: "Accept",
  price: 25,
  redirectUrl: "https://example.com/landing",
  reasons: ["Buyer declined the lead."],
};

export const DEFAULT_CAMPAIGN_TEST_MOCK: CampaignTestMockResponse = {
  ...DEFAULT_CAMPAIGN_TEST_MOCK_PHASE,
  ping: null,
};

export const DEFAULT_CAMPAIGN_TEST_PING_MOCK: CampaignTestMockPhaseConfig = {
  timeoutSeconds: 0,
  status: "Accept",
  price: null,
  redirectUrl: "",
  reasons: ["Buyer declined the ping."],
};

function readConfiguredDirectUrl(record: Record<string, unknown>) {
  if (typeof record.redirectUrl === "string" && record.redirectUrl.trim()) {
    return record.redirectUrl.trim();
  }

  if (typeof record.directUrl === "string" && record.directUrl.trim()) {
    return record.directUrl.trim();
  }

  if (typeof record.direct_url === "string" && record.direct_url.trim()) {
    return record.direct_url.trim();
  }

  return "";
}

function sanitizeOptionalNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function sanitizeStatus(value: unknown): CampaignTestMockStatus {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "reject" || normalized === "rejected" || normalized === "declined" || normalized === "0" || normalized === "2") {
    return "Reject";
  }
  return "Accept";
}

function sanitizeReasons(value: unknown) {
  if (Array.isArray(value)) {
    const reasons = value
      .map((entry) => {
        if (typeof entry === "string") return entry.trim();
        if (entry && typeof entry === "object" && "message" in entry) {
          return String((entry as { message?: unknown }).message ?? "").trim();
        }
        return "";
      })
      .filter(Boolean);
    if (reasons.length > 0) return reasons;
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  return [...DEFAULT_CAMPAIGN_TEST_MOCK.reasons];
}

function readLegacyResponse(record: Record<string, unknown>) {
  if (record.response && typeof record.response === "object" && !Array.isArray(record.response)) {
    return record.response as Record<string, unknown>;
  }
  return record;
}

function sanitizePhaseConfig(
  value: unknown,
  defaults: CampaignTestMockPhaseConfig = DEFAULT_CAMPAIGN_TEST_MOCK_PHASE
): CampaignTestMockPhaseConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...defaults };
  }

  const record = value as Record<string, unknown>;
  const status = sanitizeStatus(record.status);

  if (status === "Reject") {
    return {
      timeoutSeconds: sanitizeOptionalNumber(record.timeoutSeconds ?? record.responseDelaySeconds),
      status,
      price: null,
      redirectUrl: "",
      reasons: sanitizeReasons(record.reasons ?? record.reason),
    };
  }

  return {
    timeoutSeconds: sanitizeOptionalNumber(record.timeoutSeconds ?? record.responseDelaySeconds),
    status: "Accept",
    price: sanitizeOptionalNumber(record.price ?? record.buyerPrice),
    redirectUrl: readConfiguredDirectUrl(record),
    reasons: [...defaults.reasons],
  };
}

function migrateLegacyMock(record: Record<string, unknown>): CampaignTestMockResponse {
  const legacy = readLegacyResponse(record);
  const status = sanitizeStatus(legacy.status ?? record.status);

  if (status === "Reject") {
    return {
      timeoutSeconds: sanitizeOptionalNumber(record.timeoutSeconds ?? record.responseDelaySeconds),
      status,
      price: null,
      redirectUrl: "",
      reasons: sanitizeReasons(legacy.reasons ?? legacy.reject_reason ?? legacy.reason ?? record.reason),
      ping: null,
    };
  }

  return {
    timeoutSeconds: sanitizeOptionalNumber(record.timeoutSeconds ?? record.responseDelaySeconds),
    status: "Accept",
    price: sanitizeOptionalNumber(legacy.price ?? record.buyerPrice) ?? DEFAULT_CAMPAIGN_TEST_MOCK.price,
    redirectUrl: readConfiguredDirectUrl(legacy) || DEFAULT_CAMPAIGN_TEST_MOCK.redirectUrl,
    reasons: [...DEFAULT_CAMPAIGN_TEST_MOCK.reasons],
    ping: null,
  };
}

export function sanitizeCampaignTestMock(value: unknown): CampaignTestMockResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_CAMPAIGN_TEST_MOCK };
  }

  const record = value as Record<string, unknown>;
  const pingRaw = record.ping;

  if (
    record.status === "Accept" ||
    record.status === "Reject" ||
    record.response ||
    record.statusText ||
    record.reason ||
    record.buyerPrice != null
  ) {
    if (record.status === "Accept" || record.status === "Reject") {
      const status = record.status as CampaignTestMockStatus;
      const post: CampaignTestMockResponse = {
        timeoutSeconds: sanitizeOptionalNumber(record.timeoutSeconds ?? record.responseDelaySeconds),
        status,
        price: status === "Accept" ? sanitizeOptionalNumber(record.price) ?? DEFAULT_CAMPAIGN_TEST_MOCK.price : null,
        redirectUrl:
          status === "Accept"
            ? readConfiguredDirectUrl(record) || DEFAULT_CAMPAIGN_TEST_MOCK.redirectUrl
            : "",
        reasons: status === "Reject" ? sanitizeReasons(record.reasons) : [...DEFAULT_CAMPAIGN_TEST_MOCK.reasons],
        ping: null,
      };

      if (pingRaw && typeof pingRaw === "object" && !Array.isArray(pingRaw)) {
        post.ping = sanitizePhaseConfig(pingRaw, DEFAULT_CAMPAIGN_TEST_PING_MOCK);
      }

      return post;
    }

    return migrateLegacyMock(record);
  }

  return { ...DEFAULT_CAMPAIGN_TEST_MOCK };
}

/** Post-phase buyer mock JSON (Sold / Reject). */
export function buildCampaignTestMockBuyerResponse(mock: CampaignTestMockResponse) {
  if (mock.status === "Accept") {
    const response: Record<string, unknown> = {
      status: 1,
      status_text: "Sold",
    };

    if (mock.price != null) {
      response.price = Number(mock.price).toFixed(2);
    }

    const directUrl = mock.redirectUrl.trim();
    if (directUrl) {
      response.redirect_url = directUrl;
    }

    return response;
  }

  const reasons = mock.reasons.map((reason) => reason.trim()).filter(Boolean);

  return {
    status: 2,
    status_text: "Reject",
    reasons: formatPublisherReasons(
      reasons.length > 0 ? reasons : [...DEFAULT_CAMPAIGN_TEST_MOCK.reasons]
    ),
  };
}

/** Ping-phase buyer mock JSON — numeric status 1/2 (matches Sold::Sign / Reject::Sign). */
export function buildCampaignTestMockPingBuyerResponse(mock: CampaignTestMockPhaseConfig) {
  if (mock.status === "Accept") {
    return {
      status: 1,
      status_text: "Accept",
    };
  }

  const reasons = mock.reasons.map((reason) => reason.trim()).filter(Boolean);

  return {
    status: 2,
    status_text: "Reject",
    reasons: formatPublisherReasons(
      reasons.length > 0 ? reasons : [...DEFAULT_CAMPAIGN_TEST_PING_MOCK.reasons]
    ),
  };
}

export function normalizeCampaignTestMocks(
  value: Record<string, unknown> | Map<string, unknown> | null | undefined
): Record<string, CampaignTestMockResponse> {
  if (!value) return {};

  const entries =
    value instanceof Map ? Array.from(value.entries()) : Object.entries(value as Record<string, unknown>);

  const result: Record<string, CampaignTestMockResponse> = {};
  for (const [campaignId, mock] of entries) {
    if (!campaignId?.trim()) continue;
    result[campaignId] = sanitizeCampaignTestMock(mock);
  }

  return result;
}

export function getCampaignTestMockStatusLabel(mock: CampaignTestMockResponse | null | undefined) {
  if (!mock) return "";
  return mock.status;
}

export function campaignTestMockToMockBuyerPostOptions(
  mock: CampaignTestMockResponse | null | undefined
): MockBuyerPostOptions | undefined {
  if (!mock) return undefined;

  const response = buildCampaignTestMockBuyerResponse(mock);
  const isAccept = mock.status === "Accept";
  const reasons = mock.reasons.map((reason) => reason.trim()).filter(Boolean);

  return {
    responseDelaySeconds: mock.timeoutSeconds,
    buyerPrice: isAccept ? mock.price ?? undefined : undefined,
    status: isAccept ? "Accept" : "Reject",
    statusText: isAccept ? "Sold" : "Reject",
    reason: isAccept ? undefined : reasons.join(" | ") || DEFAULT_CAMPAIGN_TEST_MOCK.reasons[0],
    response,
  };
}

/** Convert nested ping mock config for the Ping request phase. */
export function campaignTestMockToPingMockBuyerPostOptions(
  mock: CampaignTestMockResponse | null | undefined
): MockBuyerPostOptions | undefined {
  if (!mock?.ping) return undefined;

  const ping = mock.ping;
  const isAccept = ping.status === "Accept";
  const reasons = ping.reasons.map((reason) => reason.trim()).filter(Boolean);

  return {
    responseDelaySeconds: ping.timeoutSeconds,
    status: isAccept ? "Accept" : "Reject",
    statusText: isAccept ? "Accept" : "Reject",
    reason: isAccept ? undefined : reasons.join(" | ") || DEFAULT_CAMPAIGN_TEST_PING_MOCK.reasons[0],
    response: buildCampaignTestMockPingBuyerResponse(ping),
  };
}

export function mergeMockBuyerPostOptions(
  requestOptions?: MockBuyerPostOptions,
  campaignMock?: CampaignTestMockResponse | null
): MockBuyerPostOptions | undefined {
  const campaignOptions = campaignTestMockToMockBuyerPostOptions(campaignMock);

  if (!requestOptions && !campaignOptions) {
    return undefined;
  }

  if (!campaignOptions) {
    return requestOptions;
  }

  if (!requestOptions) {
    return campaignOptions;
  }

  return {
    status: campaignOptions.status ?? requestOptions.status,
    statusText: campaignOptions.statusText ?? requestOptions.statusText,
    reason: campaignOptions.reason ?? requestOptions.reason,
    buyerPrice: campaignOptions.buyerPrice ?? requestOptions.buyerPrice,
    responseDelaySeconds: campaignOptions.responseDelaySeconds ?? requestOptions.responseDelaySeconds,
    response: campaignOptions.response ?? requestOptions.response,
  };
}

export function buildMockBuyerResponseFromOptions(options: MockBuyerPostOptions) {
  const status = options.status?.trim() || "Accept";
  const reason = options.reason?.trim() || "";
  const normalized = status.toLowerCase();
  const isAccept = ["accept", "accepted", "sold", "approved", "1"].includes(normalized);
  const priceValue = options.buyerPrice ?? 0;
  const price = Number.isFinite(Number(priceValue)) ? Number(priceValue).toFixed(2) : "0.00";

  if (isAccept) {
    const response: Record<string, unknown> = {
      status: 1,
      status_text: "Sold",
      price,
    };

    if (options.response?.redirect_url) {
      response.redirect_url = options.response.redirect_url;
    } else if (options.response?.direct_url) {
      response.redirect_url = options.response.direct_url;
    } else if (options.response?.redirectUrl) {
      response.redirect_url = options.response.redirectUrl;
    }

    return response;
  }

  return {
    status: 2,
    status_text: "Reject",
    reasons: formatPublisherReasons(
      reason ? [reason] : ["Buyer declined the lead."]
    ),
  };
}
