/** Toggle on only for local experiments. Campaign mock redirect_url is used by default. */
export const USE_HARDCODED_BUYER_REDIRECT_URL_FOR_TEST = false;
export const HARDCODED_BUYER_REDIRECT_URL = "https://www.tiktok.com";

export function resolveBuyerRedirectUrl(
  redirectUrl: string | null | undefined,
  buyerAccepted: boolean
): string {
  if (USE_HARDCODED_BUYER_REDIRECT_URL_FOR_TEST && buyerAccepted) {
    return HARDCODED_BUYER_REDIRECT_URL;
  }

  return typeof redirectUrl === "string" ? redirectUrl.trim() : "";
}

export function buildPublisherTrackingRedirectUrl(origin: string, leadId: string) {
  const base = origin.replace(/\/$/, "");
  return `${base}/redirect?id=${encodeURIComponent(leadId)}`;
}

export function parseRedirectLeadId(value: string | null | undefined) {
  return value?.trim() ?? "";
}

export function isLeadRedirectConfirmed(lead: { redirectConfirmedAt?: Date | string | null }) {
  if (!lead.redirectConfirmedAt) return false;
  const confirmedAt = new Date(lead.redirectConfirmedAt);
  return !Number.isNaN(confirmedAt.getTime());
}
