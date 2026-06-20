import type { MockBuyerPostOptions } from "@/lib/mock-buyer-post";

export const CAMPAIGN_TEST_MOCK_STATUS_OPTIONS = ["Accept", "Reject"] as const;

export type CampaignTestMockStatus = (typeof CAMPAIGN_TEST_MOCK_STATUS_OPTIONS)[number];

export type CampaignTestMockResponse = {
  timeoutSeconds: number | null;
  status: CampaignTestMockStatus;
  price: number | null;
  redirectUrl: string;
  reasons: string[];
};

export const DEFAULT_CAMPAIGN_TEST_MOCK: CampaignTestMockResponse = {
  timeoutSeconds: 0,
  status: "Accept",
  price: 25,
  redirectUrl: "https://example.com/redirect/test",
  reasons: ["Buyer declined the lead."],
};

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
    };
  }

  return {
    timeoutSeconds: sanitizeOptionalNumber(record.timeoutSeconds ?? record.responseDelaySeconds),
    status: "Accept",
    price: sanitizeOptionalNumber(legacy.price ?? record.buyerPrice) ?? DEFAULT_CAMPAIGN_TEST_MOCK.price,
    redirectUrl:
      typeof legacy.redirectUrl === "string"
        ? legacy.redirectUrl.trim()
        : typeof legacy.redirect_url === "string"
          ? legacy.redirect_url.trim()
          : DEFAULT_CAMPAIGN_TEST_MOCK.redirectUrl,
    reasons: [...DEFAULT_CAMPAIGN_TEST_MOCK.reasons],
  };
}

export function sanitizeCampaignTestMock(value: unknown): CampaignTestMockResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_CAMPAIGN_TEST_MOCK };
  }

  const record = value as Record<string, unknown>;

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
      return {
        timeoutSeconds: sanitizeOptionalNumber(record.timeoutSeconds ?? record.responseDelaySeconds),
        status,
        price: status === "Accept" ? sanitizeOptionalNumber(record.price) ?? DEFAULT_CAMPAIGN_TEST_MOCK.price : null,
        redirectUrl:
          status === "Accept" && typeof record.redirectUrl === "string"
            ? record.redirectUrl.trim()
            : status === "Accept"
              ? DEFAULT_CAMPAIGN_TEST_MOCK.redirectUrl
              : "",
        reasons: status === "Reject" ? sanitizeReasons(record.reasons) : [...DEFAULT_CAMPAIGN_TEST_MOCK.reasons],
      };
    }

    return migrateLegacyMock(record);
  }

  return { ...DEFAULT_CAMPAIGN_TEST_MOCK };
}

export function buildCampaignTestMockBuyerResponse(mock: CampaignTestMockResponse) {
  if (mock.status === "Accept") {
    const response: Record<string, unknown> = {
      status: 1,
      status_text: "Sold",
    };

    if (mock.price != null) {
      response.price = Number(mock.price).toFixed(2);
    }

    const redirectUrl = mock.redirectUrl.trim();
    if (redirectUrl) {
      response.redirectUrl = redirectUrl;
    }

    return response;
  }

  const reasons = mock.reasons.map((reason) => reason.trim()).filter(Boolean);

  return {
    status: 2,
    status_text: "Reject",
    reasons:
      reasons.length > 0
        ? reasons.map((message) => ({ message }))
        : DEFAULT_CAMPAIGN_TEST_MOCK.reasons.map((message) => ({ message })),
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
    return {
      status: 1,
      status_text: "Sold",
      price,
      redirectUrl: `https://example.com/redirect/${Math.random().toString(36).slice(2, 10)}`,
    };
  }

  return {
    status: 2,
    status_text: "Reject",
    reasons: reason ? [{ message: reason }] : [{ message: "Buyer declined the lead." }],
  };
}
