export const BUYER_LEAD_API_BASE_PATH = "/api/lists/addlead";
/** Clear Test Mode mock endpoints for Ping Post / Direct Post. */
export const BUYER_LEAD_PING_PATH = "/api/lists/addlead/ping";
export const BUYER_LEAD_POST_PATH = "/api/lists/addlead/post";
/** @deprecated Prefer BUYER_LEAD_POST_PATH — kept for older generated URLs. */
export const BUYER_LEAD_API_PATH = BUYER_LEAD_API_BASE_PATH;

export const BUYER_API_KEY_HEADER = "x-api-key";

export function generateBuyerApiKey() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export function buildBuyerLeadPostPath() {
  return BUYER_LEAD_POST_PATH;
}

export function buildBuyerLeadPingPath() {
  return BUYER_LEAD_PING_PATH;
}

function withOrigin(origin: string, path: string) {
  const base = origin.replace(/\/$/, "");
  return `${base}${path}`;
}

export function buildBuyerLeadPostUrl(origin: string) {
  return withOrigin(origin, BUYER_LEAD_POST_PATH);
}

export function buildBuyerLeadPingUrl(origin: string) {
  return withOrigin(origin, BUYER_LEAD_PING_PATH);
}

export type BuyerLeadApiUrls = {
  pingUrl: string;
  postUrl: string;
};

/** Easy-to-read Test Mode mock URLs for Ping + Post. */
export function buildBuyerLeadApiUrls(origin: string): BuyerLeadApiUrls {
  return {
    pingUrl: buildBuyerLeadPingUrl(origin),
    postUrl: buildBuyerLeadPostUrl(origin),
  };
}

function pathnameMatchesLeadApi(pathname: string) {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return (
    normalized === BUYER_LEAD_API_BASE_PATH ||
    normalized === BUYER_LEAD_PING_PATH ||
    normalized === BUYER_LEAD_POST_PATH ||
    /\/api\/buyers\/[^/]+\/post$/i.test(normalized)
  );
}

export function isBuyerLeadMockEndpoint(url: string) {
  const normalized = url.trim();
  if (!normalized) return false;

  try {
    const parsed = new URL(normalized);
    return pathnameMatchesLeadApi(parsed.pathname);
  } catch {
    return (
      normalized.includes(BUYER_LEAD_API_BASE_PATH) ||
      normalized.includes(BUYER_LEAD_PING_PATH) ||
      normalized.includes(BUYER_LEAD_POST_PATH) ||
      /\/api\/buyers\/[^/]+\/post/i.test(normalized)
    );
  }
}

export function isBuyerLeadPingEndpoint(url: string) {
  const normalized = url.trim();
  if (!normalized) return false;
  try {
    const parsed = new URL(normalized);
    return parsed.pathname.replace(/\/+$/, "") === BUYER_LEAD_PING_PATH;
  } catch {
    return normalized.includes(BUYER_LEAD_PING_PATH);
  }
}

type BuyerLeadEndpointSource = {
  _id?: { toString(): string };
  postLeadUrl?: string | null;
  apiKey?: string | null;
};

export function resolveBuyerMockPostUrl(
  buyer: BuyerLeadEndpointSource,
  origin: string,
  buyerId?: string
) {
  const configuredUrl = buyer.postLeadUrl?.trim();
  if (configuredUrl) {
    // Prefer clear /post path when an older base addlead URL is stored.
    if (configuredUrl.replace(/\/$/, "").endsWith(BUYER_LEAD_API_BASE_PATH)) {
      return buildBuyerLeadPostUrl(origin || new URL(configuredUrl).origin);
    }
    return configuredUrl;
  }

  if (buyer.apiKey?.trim()) {
    return buildBuyerLeadPostUrl(origin);
  }

  const resolvedBuyerId = buyerId?.trim() || buyer._id?.toString() || "";
  if (resolvedBuyerId) {
    const base = origin.replace(/\/$/, "");
    return `${base}/api/buyers/${encodeURIComponent(resolvedBuyerId)}/post`;
  }

  return "";
}

export function resolveBuyerMockPingUrl(
  buyer: BuyerLeadEndpointSource,
  origin: string
) {
  if (buyer.apiKey?.trim() || buyer.postLeadUrl?.trim()) {
    try {
      const fromConfigured = buyer.postLeadUrl?.trim();
      if (fromConfigured) {
        return buildBuyerLeadPingUrl(origin || new URL(fromConfigured).origin);
      }
    } catch {
      // fall through
    }
    return buildBuyerLeadPingUrl(origin);
  }
  return "";
}
