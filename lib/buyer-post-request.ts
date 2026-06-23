import type { BuyerLeadStatus } from "@/lib/models/lead-delivery";
import type { BuyerPostValidationCheck } from "@/lib/buyer-post-trace";
import type { CampaignIntakeRuleGroup } from "@/lib/campaign-test-lead-intake";
import type { PingTreeCampaignType } from "@/lib/ping-tree";
import { buildLeadRejectResponse } from "@/lib/mapping-lead-validation";

export type BuyerHttpRequestSnapshot = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
};

export type BuyerHttpResponseSnapshot = {
  httpStatus: number;
  headers: Record<string, string>;
  body: string;
};

export type BuyerPostAttemptSnapshot = {
  campaignId: string;
  campaignName: string;
  buyerId: string;
  buyerCompany: string;
  buyerStatus: BuyerLeadStatus;
  publisherLead: Record<string, unknown>;
  systemLead: Record<string, unknown>;
  mappedValues: Record<string, string>;
  requestMappingData: Record<string, unknown>;
  campaignValidationChecks: BuyerPostValidationCheck[];
  campaignIntakeRuleGroups?: CampaignIntakeRuleGroup[];
  campaignTimezone?: string;
  postedToBuyer: boolean;
  price?: number | null;
  redirectUrl?: string;
  rejectReason?: string;
  errorReason?: string;
  request: BuyerHttpRequestSnapshot | null;
  response: BuyerHttpResponseSnapshot;
  logId?: string;
  pingTreeType?: PingTreeCampaignType;
  campaignOrder?: number;
  postedAt?: string;
};

export function buildBuyerRequestLogPayload(
  request: BuyerHttpRequestSnapshot | null,
  hint?: string | null
) {
  if (!request) {
    return {
      message:
        hint?.trim() ||
        "No buyer request was built. Add the campaign to the Ping Tree, configure Integration on the campaign, and ensure the buyer is Active.",
    };
  }

  return {
    method: request.method,
    url: request.url,
    headers: request.headers,
    data: request.body,
  };
}

export function buildBuyerHttpRequestSnapshot(params: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}): BuyerHttpRequestSnapshot {
  return {
    url: params.url.trim(),
    method: params.method.trim().toUpperCase() || "POST",
    headers: params.headers,
    body: params.body,
  };
}

export function buildStructuredBuyerDeliveryPayload(params: {
  publisherLead: Record<string, unknown>;
  systemLead: Record<string, unknown>;
  mappedValues: Record<string, string>;
  request: BuyerHttpRequestSnapshot;
}) {
  return {
    publisherLead: params.publisherLead,
    systemLead: params.systemLead,
    mappedValues: params.mappedValues,
    request: params.request,
  };
}

export function buildBuyerPostAttemptLogId(pingTreeType: PingTreeCampaignType, campaignOrder: number) {
  const prefix = pingTreeType === "Silent" ? "S" : "R";
  return `${prefix}-${String(campaignOrder).padStart(3, "0")}`;
}

export function buildBuyerPostAttemptSnapshot(params: {
  campaignId: string;
  campaignName: string;
  buyerId: string;
  buyerCompany: string;
  buyerStatus: BuyerLeadStatus;
  publisherLead: Record<string, unknown>;
  systemLead: Record<string, unknown>;
  mappedValues: Record<string, string>;
  requestMappingData?: Record<string, unknown>;
  campaignValidationChecks?: BuyerPostValidationCheck[];
  campaignIntakeRuleGroups?: CampaignIntakeRuleGroup[];
  campaignTimezone?: string;
  pingTreeType?: PingTreeCampaignType;
  campaignOrder?: number;
  postedAt?: string;
  request: BuyerHttpRequestSnapshot;
  httpStatus: number;
  responseBody: string;
  responseHeaders?: Record<string, string>;
  price?: number | null;
  redirectUrl?: string;
  rejectReason?: string;
  errorReason?: string;
}): BuyerPostAttemptSnapshot {
  const pingTreeType = params.pingTreeType ?? "Redirect";
  const campaignOrder = params.campaignOrder ?? 0;

  return {
    campaignId: params.campaignId,
    campaignName: params.campaignName,
    buyerId: params.buyerId,
    buyerCompany: params.buyerCompany,
    buyerStatus: params.buyerStatus,
    publisherLead: params.publisherLead,
    systemLead: params.systemLead,
    mappedValues: params.mappedValues,
    requestMappingData:
      params.requestMappingData && Object.keys(params.requestMappingData).length > 0
        ? params.requestMappingData
        : params.request.body,
    campaignValidationChecks: params.campaignValidationChecks ?? [],
    campaignIntakeRuleGroups: params.campaignIntakeRuleGroups ?? [],
    campaignTimezone: params.campaignTimezone ?? "",
    postedToBuyer: true,
    price: params.price ?? null,
    redirectUrl: params.redirectUrl ?? "",
    rejectReason: params.rejectReason ?? "",
    errorReason: params.errorReason ?? "",
    request: params.request,
    response: {
      httpStatus: params.httpStatus,
      headers: params.responseHeaders ?? {},
      body: params.responseBody,
    },
    logId: buildBuyerPostAttemptLogId(pingTreeType, campaignOrder),
    pingTreeType,
    campaignOrder,
    postedAt: params.postedAt,
  };
}

export function buildCampaignValidationFailedAttemptSnapshot(params: {
  campaignId: string;
  campaignName: string;
  buyerId: string;
  buyerCompany: string;
  campaignValidationChecks: BuyerPostValidationCheck[];
  campaignIntakeRuleGroups?: CampaignIntakeRuleGroup[];
  campaignTimezone?: string;
  validationErrors: string[];
  pingTreeType?: PingTreeCampaignType;
  campaignOrder?: number;
  postedAt?: string;
}): BuyerPostAttemptSnapshot {
  const rejectResponse = buildLeadRejectResponse(params.validationErrors);
  const responseBody = JSON.stringify(rejectResponse);
  const pingTreeType = params.pingTreeType ?? "Redirect";
  const campaignOrder = params.campaignOrder ?? 0;

  return {
    campaignId: params.campaignId,
    campaignName: params.campaignName,
    buyerId: params.buyerId,
    buyerCompany: params.buyerCompany,
    buyerStatus: "Skipped",
    publisherLead: {},
    systemLead: {},
    mappedValues: {},
    requestMappingData: {},
    campaignValidationChecks: params.campaignValidationChecks,
    campaignIntakeRuleGroups: params.campaignIntakeRuleGroups ?? [],
    campaignTimezone: params.campaignTimezone ?? "",
    postedToBuyer: false,
    request: null,
    response: {
      httpStatus: 400,
      headers: {},
      body: responseBody,
    },
    logId: buildBuyerPostAttemptLogId(pingTreeType, campaignOrder),
    pingTreeType,
    campaignOrder,
    postedAt: params.postedAt,
  };
}

export function resolvePrimaryBuyerPostAttempt(attempts: BuyerPostAttemptSnapshot[]) {
  if (attempts.length === 0) return null;
  return attempts.find((attempt) => attempt.buyerStatus === "Accept") ?? attempts[attempts.length - 1];
}
