export const BUYER_LEAD_API_PATH = "/api/lists/addlead";
export const BUYER_API_KEY_HEADER = "x-api-key";

export function generateBuyerApiKey() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export function buildBuyerLeadPostPath() {
  return BUYER_LEAD_API_PATH;
}

export function buildBuyerLeadPostUrl(origin: string) {
  const base = origin.replace(/\/$/, "");
  return `${base}${BUYER_LEAD_API_PATH}`;
}

export function isBuyerLeadMockEndpoint(url: string) {
  const normalized = url.trim();
  if (!normalized) return false;

  try {
    const parsed = new URL(normalized);
    if (parsed.pathname.endsWith(BUYER_LEAD_API_PATH)) {
      return true;
    }

    return /\/api\/buyers\/[^/]+\/post$/i.test(parsed.pathname);
  } catch {
    return normalized.includes(BUYER_LEAD_API_PATH) || /\/api\/buyers\/[^/]+\/post/i.test(normalized);
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
