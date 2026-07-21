import type { PingTreeCampaignType } from "@/lib/ping-tree";
import { buildPublisherTrackingRedirectUrl } from "@/lib/publisher-redirect";
export type MappingApiType = "Redirect" | "Silent";

export const MAPPING_API_TYPE_OPTIONS: MappingApiType[] = ["Redirect", "Silent"];

export const SILENT_API_NO_BUYER_MESSAGE = "Buyer not found.";

export function normalizeMappingApiType(value: unknown): MappingApiType {
  return value === "Silent" ? "Silent" : "Redirect";
}

export function resolveLeadMappingApiType(
  mappingRef: string | null | undefined,
  mappingApiTypeById: Map<string, MappingApiType>
): MappingApiType {
  if (!mappingRef) return "Redirect";
  return mappingApiTypeById.get(mappingRef) ?? "Redirect";
}

export function buildLeadApiTypeByLeadId(
  leads: Array<{
    _id?: { toString(): string };
    mappingRef?: { toString(): string } | string | null;
  }>,
  mappingApiTypeById: Map<string, MappingApiType>
): Map<string, MappingApiType> {
  const result = new Map<string, MappingApiType>();
  for (const lead of leads) {
    const leadId = lead._id?.toString() ?? "";
    if (!leadId) continue;
    const mappingRef =
      typeof lead.mappingRef === "string" ? lead.mappingRef : lead.mappingRef?.toString() ?? "";
    result.set(leadId, resolveLeadMappingApiType(mappingRef, mappingApiTypeById));
  }
  return result;
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
    const buyerRedirectUrl = params.redirectUrl?.trim() ?? "";
    if (buyerRedirectUrl) {
      response.redirect_url = buildPublisherTrackingRedirectUrl(params.origin, params.leadId);
    }
  }

  if (params.publisherResponsePrice != null) {
    response.price = params.publisherResponsePrice;
  }

  return response;
}
