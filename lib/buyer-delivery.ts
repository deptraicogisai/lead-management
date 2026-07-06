import { Types } from "mongoose";
import { BuyerRequestLogModel } from "@/lib/models/buyer-request-log";
import type { BuyerLeadStatus } from "@/lib/models/lead-delivery";
import type { IntegrationBuilderRecord } from "@/lib/integration-builder";
import { resolvePostTimeoutMs } from "@/lib/campaign-integration-config";
import {
  appendBuyerPostTraceStep,
  errorStepResult,
  successStepResult,
  type BuyerPostTraceStep,
  type BuyerPostTraceStepStatus,
} from "@/lib/buyer-post-trace";
import {
  buildBuyerHttpRequestSnapshot,
  buildStructuredBuyerDeliveryPayload,
  type BuyerHttpRequestSnapshot,
} from "@/lib/buyer-post-request";
import { snapshotFetchResponseHeaders } from "@/lib/buyer-http-log";
import {
  buildIntegrationRequest,
  buildIntegrationRuntimeConfig,
  buildLeadTemplateContext,
  buildMappedValues,
  inferBuyerStatusFromParsedResponse,
  parseIntegrationResponse,
  type ParsedBuyerResponse,
} from "@/lib/integration-runtime";
import {
  resolveAcceptedBuyerPrice,
  resolveDeliveryPriceMode,
  type CampaignPriceMode,
} from "@/lib/lead-price";
import type { PingTreeCampaignType } from "@/lib/ping-tree";
import {
  buildMockBuyerPostHeaders,
  MOCK_BUYER_POST_BODY_KEY,
  type MockBuyerPostOptions,
} from "@/lib/mock-buyer-post";
import { resolveBuyerRedirectUrl } from "@/lib/publisher-redirect";

export type BuyerDeliveryResult = {
  buyerStatus: BuyerLeadStatus;
  price: number | null;
  redirectUrl: string;
  rejectSign: string;
  rejectReason: string;
  errorReason: string;
  postLeadUrl: string;
  requestPayload: Record<string, unknown>;
  publisherLead: Record<string, unknown>;
  systemLead: Record<string, unknown>;
  mappedValues: Record<string, string>;
  buyerRequest: BuyerHttpRequestSnapshot;
  responseBody: string;
  responseHeaders: Record<string, string>;
  httpStatus: number;
  parsed: ParsedBuyerResponse;
  traceSteps: BuyerPostTraceStep[];
  responseTimeMs: number | null;
};

function toTraceStatus(buyerStatus: BuyerLeadStatus): BuyerPostTraceStepStatus {
  if (buyerStatus === "Accept") return "pass";
  if (buyerStatus === "Reject" || buyerStatus === "Price Reject" || buyerStatus === "Price Conflict") {
    return "fail";
  }
  return "error";
}

function buildRequestBody(
  dataType: string,
  body: Record<string, unknown>
): { body: BodyInit | undefined; contentType: string } {
  const normalized = dataType.trim().toUpperCase();
  if (normalized === "FORM" || normalized === "FORM-DATA" || normalized === "X-WWW-FORM-URLENCODED") {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(body)) {
      params.set(key, value === undefined || value === null ? "" : String(value));
    }
    return { body: params, contentType: "application/x-www-form-urlencoded" };
  }

  return { body: JSON.stringify(body), contentType: "application/json" };
}

function assembleBuyerDeliveryResult(params: {
  publisherLead: Record<string, unknown>;
  systemLead: Record<string, unknown>;
  mappedValues: Record<string, string>;
  buyerRequest: BuyerHttpRequestSnapshot;
  buyerStatus: BuyerLeadStatus;
  price: number | null;
  redirectUrl: string;
  rejectSign: string;
  rejectReason: string;
  errorReason: string;
  postLeadUrl: string;
  responseBody: string;
  responseHeaders: Record<string, string>;
  httpStatus: number;
  parsed: ParsedBuyerResponse;
  traceSteps: BuyerPostTraceStep[];
  responseTimeMs?: number | null;
}): BuyerDeliveryResult {
  const redirectUrl = resolveBuyerRedirectUrl(
    params.redirectUrl,
    params.buyerStatus === "Accept"
  );
  const parsed =
    redirectUrl !== params.redirectUrl.trim()
      ? { ...params.parsed, redirectUrl }
      : params.parsed;

  return {
    buyerStatus: params.buyerStatus,
    price: params.price,
    redirectUrl,
    rejectSign: params.rejectSign,
    rejectReason: params.rejectReason,
    errorReason: params.errorReason,
    postLeadUrl: params.postLeadUrl,
    requestPayload: params.buyerRequest.body,
    publisherLead: params.publisherLead,
    systemLead: params.systemLead,
    mappedValues: params.mappedValues,
    buyerRequest: params.buyerRequest,
    responseBody: params.responseBody,
    responseHeaders: params.responseHeaders,
    httpStatus: params.httpStatus,
    parsed,
    traceSteps: params.traceSteps,
    responseTimeMs: params.responseTimeMs ?? null,
  };
}

export type PreparedBuyerIntegrationRequest = {
  systemLead: Record<string, unknown>;
  mappedValues: Record<string, string>;
  requestMappingData: Record<string, unknown>;
  buyerRequest: BuyerHttpRequestSnapshot;
  postLeadUrl: string;
  configValues: Record<string, string>;
};

export function prepareBuyerIntegrationRequest(params: {
  integration: IntegrationBuilderRecord;
  publisherLead: Record<string, unknown>;
  lead: Record<string, unknown>;
  configValues: Record<string, string>;
  campaign?: Record<string, unknown>;
  mockBuyerPostUrl?: string;
}): PreparedBuyerIntegrationRequest {
  const systemLead = buildLeadTemplateContext(params.lead);
  const mappedValues = buildMappedValues(params.integration.arrayMappings, params.lead);
  const configValues = buildIntegrationRuntimeConfig(params.integration.configFields, params.configValues);
  const request = buildIntegrationRequest({
    requestMapping: params.integration.requestMapping,
    lead: systemLead,
    config: configValues,
    mapped: mappedValues,
    campaign: params.campaign ?? {},
  });
  const postLeadUrl = params.mockBuyerPostUrl?.trim() || request.url.trim();

  return {
    systemLead: params.lead,
    mappedValues,
    requestMappingData: request.body,
    postLeadUrl,
    configValues,
    buyerRequest: buildBuyerHttpRequestSnapshot({
      url: postLeadUrl,
      method: request.method,
      headers: request.headers,
      body: request.body,
    }),
  };
}

export async function deliverLeadToBuyer(params: {
  integration: IntegrationBuilderRecord;
  publisherLead: Record<string, unknown>;
  lead: Record<string, unknown>;
  configValues: Record<string, string>;
  campaign?: Record<string, unknown>;
  minPrice: number;
  pingTreeType?: PingTreeCampaignType;
  mockBuyerPostUrl?: string;
  mockBuyerPostOptions?: MockBuyerPostOptions;
}): Promise<BuyerDeliveryResult> {
  const campaignType: CampaignPriceMode = resolveDeliveryPriceMode({
    pingTreeType: params.pingTreeType,
    campaignType: params.campaign?.campaignType,
  });
  let traceSteps: BuyerPostTraceStep[] = [];
  const prepared = prepareBuyerIntegrationRequest({
    integration: params.integration,
    publisherLead: params.publisherLead,
    lead: params.lead,
    configValues: params.configValues,
    campaign: params.campaign ?? {},
    mockBuyerPostUrl: params.mockBuyerPostUrl,
  });
  const { mappedValues, requestMappingData, buyerRequest, postLeadUrl, configValues } = prepared;

  const mappedSummary =
    Object.keys(mappedValues).length > 0
      ? Object.entries(mappedValues)
          .map(([slug, value]) => `${slug}=${value}`)
          .join(", ")
      : "No array mapping values applied.";

  traceSteps = appendBuyerPostTraceStep(traceSteps, {
    key: "prepare-buyer-payload",
    label: "Prepare Buyer Payload",
    status: "info",
    summary: "Request body is built from Integration Request Mapping data rows.",
    result: successStepResult(mappedSummary),
  });

  traceSteps = appendBuyerPostTraceStep(traceSteps, {
    key: "build-request",
    label: "Build Integration Request",
    status: "pass",
    result: successStepResult(
      `Request ready: ${buyerRequest.method || "POST"} ${postLeadUrl || "(URL from config)"}`
    ),
  });

  if (!postLeadUrl) {
    traceSteps = appendBuyerPostTraceStep(traceSteps, {
      key: "resolve-post-url",
      label: "Resolve Post URL",
      status: "fail",
      summary: "Post URL is not configured.",
      result: errorStepResult("Post URL is not configured."),
    });

    return assembleBuyerDeliveryResult({
      publisherLead: params.publisherLead,
      systemLead: params.lead,
      mappedValues,
      buyerRequest: buildBuyerHttpRequestSnapshot({
        url: "",
        method: buyerRequest.method,
        headers: buyerRequest.headers,
        body: requestMappingData,
      }),
      buyerStatus: "Error",
      price: null,
      redirectUrl: "",
      rejectSign: "",
      rejectReason: "",
      errorReason: "Post URL is not configured.",
      postLeadUrl: "",
      responseBody: "",
      responseHeaders: {},
      httpStatus: 0,
      parsed: {
        soldSign: "",
        soldPrice: null,
        redirectUrl: "",
        rejectSign: "",
        rejectReason: "",
        errorReason: "Post URL is not configured.",
        mappingError: true,
      },
      traceSteps,
    });
  }

  const requestDataType = params.integration.requestMapping.dataType?.trim().toUpperCase() || "JSON";
  const outboundRequestBody =
    params.mockBuyerPostUrl && params.mockBuyerPostOptions
      ? {
          ...requestMappingData,
          [MOCK_BUYER_POST_BODY_KEY]: params.mockBuyerPostOptions,
        }
      : requestMappingData;
  const { body, contentType } = buildRequestBody(requestDataType, outboundRequestBody);
  const headers = {
    ...buyerRequest.headers,
    "Content-Type": buyerRequest.headers["Content-Type"] || contentType,
  };
  const mockHeaders = params.mockBuyerPostUrl ? buildMockBuyerPostHeaders(params.mockBuyerPostOptions) : {};
  const sentHeaders = {
    ...headers,
    ...mockHeaders,
  };
  const outboundRequest = buildBuyerHttpRequestSnapshot({
    url: postLeadUrl,
    method: buyerRequest.method,
    headers: sentHeaders,
    body: outboundRequestBody,
  });
  const timeoutMs = resolvePostTimeoutMs(configValues);
  const timeoutSeconds = timeoutMs / 1000;
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  traceSteps = appendBuyerPostTraceStep(traceSteps, {
    key: "post-timeout",
    label: "Post Timeout",
    status: "info",
    summary: `Buyer post timeout is ${timeoutSeconds}s.`,
    result: successStepResult(`Waiting up to ${timeoutSeconds}s for buyer response.`),
  });

  let httpStatus = 0;
  let responseBody = "";
  let responseHeaders: Record<string, string> = {};
  const requestStartedAt = Date.now();
  let responseTimeMs: number | null = null;

  try {
    const response = await fetch(postLeadUrl, {
      method: outboundRequest.method || "POST",
      headers: sentHeaders,
      body,
      signal: controller.signal,
    });

    httpStatus = response.status;
    responseBody = await response.text();
    responseHeaders = snapshotFetchResponseHeaders(response);
    responseTimeMs = Date.now() - requestStartedAt;

    traceSteps = appendBuyerPostTraceStep(traceSteps, {
      key: "http-post",
      label: "HTTP Post to Buyer",
      status: response.ok ? "pass" : "error",
      summary: `Buyer returned HTTP ${httpStatus}.`,
      result: response.ok
        ? successStepResult(`HTTP ${httpStatus} OK.`)
        : errorStepResult(`Buyer returned HTTP ${httpStatus}.`, `HTTP ${httpStatus}`),
    });

    const parsed = parseIntegrationResponse(
      params.integration.responseMapping,
      responseBody,
      params.campaign ?? {}
    );
    const inferred = inferBuyerStatusFromParsedResponse(parsed, params.minPrice, campaignType);
    const parseSuccess = inferred.status === "Accept";
    const parseError =
      inferred.reason || parsed.rejectReason || parsed.errorReason || undefined;
    const resolvedPrice =
      inferred.status === "Accept"
        ? resolveAcceptedBuyerPrice(parsed, params.minPrice, campaignType)
        : parsed.soldPrice;

    traceSteps = appendBuyerPostTraceStep(traceSteps, {
      key: "parse-response",
      label: "Parse Buyer Response",
      status: toTraceStatus(inferred.status),
      summary: inferred.reason || parsed.errorReason || `Buyer status: ${inferred.status}.`,
      result: parseSuccess
        ? successStepResult(`Buyer accepted. Status: ${inferred.status}.`)
        : errorStepResult(
            parseError || `Buyer status: ${inferred.status}.`,
            `Buyer status: ${inferred.status}`
          ),
    });

    if (!response.ok && inferred.status === "Reject" && !parsed.rejectReason) {
      return assembleBuyerDeliveryResult({
        publisherLead: params.publisherLead,
        systemLead: params.lead,
        mappedValues,
        buyerRequest: outboundRequest,
        buyerStatus: "Error",
        price: parsed.soldPrice,
        redirectUrl: parsed.redirectUrl,
        rejectSign: parsed.rejectSign,
        rejectReason: parsed.rejectReason,
        errorReason: `Buyer returned HTTP ${httpStatus}.`,
        postLeadUrl,
        responseBody,
        responseHeaders,
        httpStatus,
        parsed,
        traceSteps,
        responseTimeMs,
      });
    }

    const ambiguousHttpParseError =
      !response.ok &&
      inferred.status === "Error" &&
      (!inferred.reason ||
        inferred.reason === "Unrecognized buyer response status." ||
        inferred.reason === "Empty or unmapped buyer response." ||
        inferred.reason === "Response mapping could not determine buyer status.");

    if (ambiguousHttpParseError) {
      return assembleBuyerDeliveryResult({
        publisherLead: params.publisherLead,
        systemLead: params.lead,
        mappedValues,
        buyerRequest: outboundRequest,
        buyerStatus: "Error",
        price: parsed.soldPrice,
        redirectUrl: parsed.redirectUrl,
        rejectSign: parsed.rejectSign,
        rejectReason: parsed.rejectReason,
        errorReason: `Buyer returned HTTP ${httpStatus}.`,
        postLeadUrl,
        responseBody,
        responseHeaders,
        httpStatus,
        parsed,
        traceSteps,
        responseTimeMs,
      });
    }

    return assembleBuyerDeliveryResult({
      publisherLead: params.publisherLead,
      systemLead: params.lead,
      mappedValues,
      buyerRequest: outboundRequest,
      buyerStatus: inferred.status,
      price: resolvedPrice,
      redirectUrl: parsed.redirectUrl,
      rejectSign: parsed.rejectSign,
      rejectReason: inferred.reason || parsed.rejectReason,
      errorReason: inferred.status === "Error" ? inferred.reason || parsed.errorReason : parsed.errorReason,
      postLeadUrl,
      responseBody,
      responseHeaders,
      httpStatus,
      parsed,
      traceSteps,
      responseTimeMs,
    });
  } catch (error) {
    responseTimeMs = Date.now() - requestStartedAt;
    const isTimeout = error instanceof Error && error.name === "AbortError";
    const buyerStatus = isTimeout ? "Timeout" : "Error";
    const errorReason = isTimeout ? "Buyer post request timed out." : "Failed to post lead to buyer.";

    traceSteps = appendBuyerPostTraceStep(traceSteps, {
      key: "http-post",
      label: "HTTP Post to Buyer",
      status: "error",
      summary: errorReason,
      result: errorStepResult(errorReason),
    });

    return assembleBuyerDeliveryResult({
      publisherLead: params.publisherLead,
      systemLead: params.lead,
      mappedValues,
      buyerRequest: outboundRequest,
      buyerStatus,
      price: null,
      redirectUrl: "",
      rejectSign: "",
      rejectReason: "",
      errorReason,
      postLeadUrl,
      responseBody,
      responseHeaders,
      httpStatus,
      parsed: {
        soldSign: "",
        soldPrice: null,
        redirectUrl: "",
        rejectSign: "",
        rejectReason: "",
        errorReason,
        mappingError: false,
      },
      traceSteps,
      responseTimeMs,
    });
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export async function createBuyerDeliveryLog(params: {
  sellerLeadRef?: string;
  campaignRef?: string;
  sellerRef?: string;
  verticalRef?: string;
  buyerRef?: string;
  buyerCompany?: string;
  campaignName?: string;
  campaignType?: "Redirect" | "Silent";
  postLeadUrl: string;
  publisherLead?: Record<string, unknown>;
  systemLead?: Record<string, unknown>;
  mappedValues?: Record<string, string>;
  buyerRequest?: BuyerHttpRequestSnapshot;
  requestPayload: unknown;
  responseBody: string;
  responseHeaders?: Record<string, string>;
  errorMessage?: string;
  deliveryStatus: "success" | "fail";
  httpStatus: number;
  deliveryTrace?: BuyerPostTraceStep[];
}) {
  const structuredPayload =
    params.publisherLead && params.systemLead && params.buyerRequest
      ? buildStructuredBuyerDeliveryPayload({
          publisherLead: params.publisherLead,
          systemLead: params.systemLead,
          mappedValues: params.mappedValues ?? {},
          request: params.buyerRequest,
        })
      : {
          body: params.requestPayload,
          trace: params.deliveryTrace ?? [],
        };

  const sellerLeadRef =
    params.sellerLeadRef && Types.ObjectId.isValid(params.sellerLeadRef)
      ? new Types.ObjectId(params.sellerLeadRef)
      : undefined;
  const campaignRef =
    params.campaignRef && Types.ObjectId.isValid(params.campaignRef)
      ? new Types.ObjectId(params.campaignRef)
      : undefined;

  if (sellerLeadRef && campaignRef) {
    const existing = await BuyerRequestLogModel.findOne({
      requestType: "buyer-delivery",
      sellerLeadRef,
      campaignRef,
    })
      .select({ _id: 1 })
      .lean();

    if (existing) {
      return;
    }
  }

  try {
    await BuyerRequestLogModel.create({
      requestType: "buyer-delivery",
      sellerLeadRef,
      campaignRef,
      sellerRef: params.sellerRef,
      verticalRef: params.verticalRef,
      buyerRef: params.buyerRef,
      buyerCompany: params.buyerCompany ?? "",
      campaignName: params.campaignName?.trim() ?? "",
      ...(params.campaignType === "Redirect" || params.campaignType === "Silent"
        ? { campaignType: params.campaignType }
        : {}),
      targetName: params.campaignName ?? "Buyer Delivery",
      postLeadUrl: params.postLeadUrl,
      requestPayload: structuredPayload,
      responseBody: params.responseBody,
      responseHeaders: params.responseHeaders ?? {},
      errorMessage: params.errorMessage ?? "",
      deliveryStatus: params.deliveryStatus,
      httpStatus: params.httpStatus,
    });
  } catch (error) {
    if (
      sellerLeadRef &&
      campaignRef &&
      error instanceof Error &&
      "code" in error &&
      (error as { code?: number }).code === 11000
    ) {
      return;
    }

    console.error("Failed to create buyer delivery log:", error);
  }
}
