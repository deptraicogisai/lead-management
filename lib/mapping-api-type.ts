import type { PingTreeCampaignType } from "@/lib/ping-tree";

export type MappingApiType = "Redirect" | "Silent";

export const MAPPING_API_TYPE_OPTIONS: MappingApiType[] = ["Redirect", "Silent"];

export const SILENT_API_NO_BUYER_MESSAGE = "Buyer not found.";

export function normalizeMappingApiType(value: unknown): MappingApiType {
  return value === "Silent" ? "Silent" : "Redirect";
}

export function resolvePublisherPingTreeTypes(apiType: MappingApiType): PingTreeCampaignType[] {
  return apiType === "Silent" ? ["Silent"] : ["Redirect", "Silent"];
}

export function shouldIncludePublisherRedirectUrl(apiType: MappingApiType) {
  return apiType === "Redirect";
}

export function buildPublisherSoldResponse(params: {
  apiType: MappingApiType;
  leadId: string;
  origin: string;
  redirectUrl?: string;
  publisherResponsePrice?: number | null;
}) {
  const response: Record<string, unknown> = {
    status: 1,
    status_text: "Accepted",
    lead_id: params.leadId,
  };

  if (shouldIncludePublisherRedirectUrl(params.apiType)) {
    response.redirect_url =
      params.redirectUrl?.trim() ||
      `${params.origin}/reports/publisher/lead-details?leadId=${encodeURIComponent(params.leadId)}`;
  }

  if (params.publisherResponsePrice != null) {
    response.price = params.publisherResponsePrice;
  }

  return response;
}
