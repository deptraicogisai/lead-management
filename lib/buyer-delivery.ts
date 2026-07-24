import { Types } from "mongoose";
import { BuyerRequestLogModel } from "@/lib/models/buyer-request-log";
import type { BuyerLeadStatus } from "@/lib/models/lead-delivery";
import type { IntegrationBuilderRecord } from "@/lib/integration-builder";
import { resolvePingTimeoutMs, resolvePostTimeoutMs } from "@/lib/campaign-integration-config";
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
  isResponseMappingErrorReason,
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
import { resolveBuyerPostErrorReason } from "@/lib/buyer-post-error";
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
  if (
    buyerStatus === "Reject" ||
    buyerStatus === "Ping Reject" ||
    buyerStatus === "Price Reject" ||
    buyerStatus === "Price Conflict"
  ) {
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
  /** Override request mapping (Ping phase uses pingRequestMapping). */
  requestMapping?: IntegrationBuilderRecord["requestMapping"];
}): PreparedBuyerIntegrationRequest {
  const configValues = buildIntegrationRuntimeConfig(params.integration.configFields, params.configValues);
  const systemLead = buildLeadTemplateContext(params.lead);
  const mappedValues = buildMappedValues(params.integration.arrayMappings, params.lead);
  const requestMapping = params.requestMapping ?? params.integration.requestMapping;
  const request = buildIntegrationRequest({
    requestMapping,
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

type BuyerHttpPhaseParams = {
  publisherLead: Record<string, unknown>;
  lead: Record<string, unknown>;
  mappedValues: Record<string, string>;
  requestMapping: IntegrationBuilderRecord["requestMapping"];
  responseMapping: IntegrationBuilderRecord["responseMapping"];
  requestMappingData: Record<string, unknown>;
  buyerRequest: BuyerHttpRequestSnapshot;
  targetUrl: string;
  configValues: Record<string, string>;
  campaign: Record<string, unknown>;
  minPrice: number;
  campaignType: CampaignPriceMode;
  timeoutMs: number;
  mockOptions?: MockBuyerPostOptions;
  /** Skip buyer price floor check (Ping phase). */
  skipPriceValidation?: boolean;
  phase: "ping" | "post";
  missingUrlMessage: string;
  timeoutMessage: string;
  failedMessage: string;
  initialTraceSteps: BuyerPostTraceStep[];
};

async function executeBuyerHttpPhase(params: BuyerHttpPhaseParams): Promise<BuyerDeliveryResult> {
  let traceSteps = params.initialTraceSteps;
  const phaseLabel = params.phase === "ping" ? "Ping" : "Post";
  const targetUrl = params.targetUrl.trim();

  if (!targetUrl) {
    traceSteps = appendBuyerPostTraceStep(traceSteps, {
      key: `resolve-${params.phase}-url`,
      label: `Resolve ${phaseLabel} URL`,
      status: "fail",
      summary: params.missingUrlMessage,
      result: errorStepResult(params.missingUrlMessage),
    });

    return assembleBuyerDeliveryResult({
      publisherLead: params.publisherLead,
      systemLead: params.lead,
      mappedValues: params.mappedValues,
      buyerRequest: buildBuyerHttpRequestSnapshot({
        url: "",
        method: params.buyerRequest.method,
        headers: params.buyerRequest.headers,
        body: params.requestMappingData,
      }),
      buyerStatus: "Error",
      price: null,
      redirectUrl: "",
      rejectSign: "",
      rejectReason: "",
      errorReason: params.missingUrlMessage,
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
        errorReason: params.missingUrlMessage,
        mappingError: true,
      },
      traceSteps,
    });
  }

  const requestDataType = params.requestMapping.dataType?.trim().toUpperCase() || "JSON";
  const outboundRequestBody = params.mockOptions
    ? {
        ...params.requestMappingData,
        [MOCK_BUYER_POST_BODY_KEY]: params.mockOptions,
      }
    : params.requestMappingData;
  const { body, contentType } = buildRequestBody(requestDataType, outboundRequestBody);
  const headers = {
    ...params.buyerRequest.headers,
    "Content-Type": params.buyerRequest.headers["Content-Type"] || contentType,
  };
  const mockHeaders = params.mockOptions ? buildMockBuyerPostHeaders(params.mockOptions) : {};
  const sentHeaders = {
    ...headers,
    ...mockHeaders,
  };
  const outboundRequest = buildBuyerHttpRequestSnapshot({
    url: targetUrl,
    method: params.buyerRequest.method,
    headers: sentHeaders,
    body: outboundRequestBody,
  });
  const timeoutSeconds = params.timeoutMs / 1000;
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), params.timeoutMs);

  traceSteps = appendBuyerPostTraceStep(traceSteps, {
    key: `${params.phase}-timeout`,
    label: `${phaseLabel} Timeout`,
    status: "info",
    summary: `Buyer ${params.phase} timeout is ${timeoutSeconds}s.`,
    result: successStepResult(`Waiting up to ${timeoutSeconds}s for buyer ${params.phase} response.`),
  });

  let httpStatus = 0;
  let responseBody = "";
  let responseHeaders: Record<string, string> = {};
  const requestStartedAt = Date.now();
  let responseTimeMs: number | null = null;

  try {
    const response = await fetch(targetUrl, {
      method: outboundRequest.method || "POST",
      headers: sentHeaders,
      body,
      signal: controller.signal,
    });

    httpStatus = response.status;
    responseBody = await response.text();
    responseHeaders = snapshotFetchResponseHeaders(response);
    responseTimeMs = Date.now() - requestStartedAt;
    const httpErrorReason = response.ok ? "" : resolveBuyerPostErrorReason(httpStatus, responseBody);

    traceSteps = appendBuyerPostTraceStep(traceSteps, {
      key: `http-${params.phase}`,
      label: `HTTP ${phaseLabel} to Buyer`,
      status: response.ok ? "pass" : "error",
      summary: response.ok ? `Buyer returned HTTP ${httpStatus}.` : httpErrorReason,
      result: response.ok
        ? successStepResult(`HTTP ${httpStatus} OK.`)
        : errorStepResult(httpErrorReason, `HTTP ${httpStatus}`),
    });

    const parsed = parseIntegrationResponse(params.responseMapping, responseBody, params.campaign);
    const inferred = inferBuyerStatusFromParsedResponse(
      parsed,
      params.skipPriceValidation ? 0 : params.minPrice,
      params.skipPriceValidation ? "Silent" : params.campaignType
    );
    const parseSuccess = inferred.status === "Accept";
    const parseError = inferred.reason || parsed.rejectReason || parsed.errorReason || undefined;
    const resolvedPrice =
      inferred.status === "Accept" && !params.skipPriceValidation
        ? resolveAcceptedBuyerPrice(parsed, params.minPrice, params.campaignType)
        : parsed.soldPrice;

    traceSteps = appendBuyerPostTraceStep(traceSteps, {
      key: `parse-${params.phase}-response`,
      label: `Parse Buyer ${phaseLabel} Response`,
      status: toTraceStatus(inferred.status),
      summary: inferred.reason || parsed.errorReason || `Buyer ${params.phase} status: ${inferred.status}.`,
      result: parseSuccess
        ? successStepResult(`Buyer ${params.phase} accepted. Status: ${inferred.status}.`)
        : errorStepResult(
            parseError || `Buyer ${params.phase} status: ${inferred.status}.`,
            `Buyer status: ${inferred.status}`
          ),
    });

    if (!response.ok && inferred.status === "Reject" && !parsed.rejectReason) {
      return assembleBuyerDeliveryResult({
        publisherLead: params.publisherLead,
        systemLead: params.lead,
        mappedValues: params.mappedValues,
        buyerRequest: outboundRequest,
        buyerStatus: "Error",
        price: parsed.soldPrice,
        redirectUrl: parsed.redirectUrl,
        rejectSign: parsed.rejectSign,
        rejectReason: parsed.rejectReason,
        errorReason: httpErrorReason,
        postLeadUrl: targetUrl,
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
      (!inferred.reason || isResponseMappingErrorReason(inferred.reason));

    if (ambiguousHttpParseError) {
      return assembleBuyerDeliveryResult({
        publisherLead: params.publisherLead,
        systemLead: params.lead,
        mappedValues: params.mappedValues,
        buyerRequest: outboundRequest,
        buyerStatus: "Error",
        price: parsed.soldPrice,
        redirectUrl: parsed.redirectUrl,
        rejectSign: parsed.rejectSign,
        rejectReason: parsed.rejectReason,
        errorReason: httpErrorReason,
        postLeadUrl: targetUrl,
        responseBody,
        responseHeaders,
        httpStatus,
        parsed,
        traceSteps,
        responseTimeMs,
      });
    }

    const resolvedErrorReason =
      inferred.status === "Error"
        ? inferred.reason || parsed.errorReason || httpErrorReason
        : parsed.errorReason;

    return assembleBuyerDeliveryResult({
      publisherLead: params.publisherLead,
      systemLead: params.lead,
      mappedValues: params.mappedValues,
      buyerRequest: outboundRequest,
      buyerStatus: inferred.status,
      price: resolvedPrice,
      redirectUrl: parsed.redirectUrl,
      rejectSign: parsed.rejectSign,
      rejectReason:
        inferred.status === "Error"
          ? parsed.rejectReason
          : inferred.reason || parsed.rejectReason,
      errorReason: resolvedErrorReason,
      postLeadUrl: targetUrl,
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
    const errorReason = isTimeout ? params.timeoutMessage : params.failedMessage;

    traceSteps = appendBuyerPostTraceStep(traceSteps, {
      key: `http-${params.phase}`,
      label: `HTTP ${phaseLabel} to Buyer`,
      status: "error",
      summary: errorReason,
      result: errorStepResult(errorReason),
    });

    return assembleBuyerDeliveryResult({
      publisherLead: params.publisherLead,
      systemLead: params.lead,
      mappedValues: params.mappedValues,
      buyerRequest: outboundRequest,
      buyerStatus,
      price: null,
      redirectUrl: "",
      rejectSign: "",
      rejectReason: "",
      errorReason,
      postLeadUrl: targetUrl,
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

export async function deliverLeadToBuyer(params: {
  integration: IntegrationBuilderRecord;
  publisherLead: Record<string, unknown>;
  lead: Record<string, unknown>;
  configValues: Record<string, string>;
  campaign?: Record<string, unknown>;
  minPrice: number;
  pingTreeType?: PingTreeCampaignType;
  mockBuyerPostUrl?: string;
  mockBuyerPingUrl?: string;
  mockBuyerPostOptions?: MockBuyerPostOptions;
  mockBuyerPingOptions?: MockBuyerPostOptions;
}): Promise<BuyerDeliveryResult> {
  const campaignType: CampaignPriceMode = resolveDeliveryPriceMode({
    pingTreeType: params.pingTreeType,
    campaignType: params.campaign?.campaignType,
  });
  const campaign = params.campaign ?? {};
  const isPingPost = params.integration.postModel === "Ping Post";

  const postPrepared = prepareBuyerIntegrationRequest({
    integration: params.integration,
    publisherLead: params.publisherLead,
    lead: params.lead,
    configValues: params.configValues,
    campaign,
    mockBuyerPostUrl: params.mockBuyerPostUrl,
    requestMapping: params.integration.requestMapping,
  });
  const { mappedValues, configValues } = postPrepared;

  const mappedSummary =
    Object.keys(mappedValues).length > 0
      ? Object.entries(mappedValues)
          .map(([slug, value]) => `${slug}=${value}`)
          .join(", ")
      : "No array mapping values applied.";

  let traceSteps = appendBuyerPostTraceStep([], {
    key: "prepare-buyer-payload",
    label: "Prepare Buyer Payload",
    status: "info",
    summary: isPingPost
      ? "Request bodies are built from Ping and Post Request Mapping data rows."
      : "Request body is built from Integration Request Mapping data rows.",
    result: successStepResult(mappedSummary),
  });

  const targetsMockEndpoint = Boolean(params.mockBuyerPostUrl?.trim() || params.mockBuyerPingUrl?.trim());
  const mockBuyerPostOptions = targetsMockEndpoint ? params.mockBuyerPostOptions : undefined;
  const mockBuyerPingOptions = targetsMockEndpoint ? params.mockBuyerPingOptions : undefined;

  if (isPingPost) {
    const pingMapping =
      params.integration.pingRequestMapping ?? params.integration.requestMapping;
    const pingResponseMapping =
      params.integration.pingResponseMapping ?? params.integration.responseMapping;
    const pingPrepared = prepareBuyerIntegrationRequest({
      integration: params.integration,
      publisherLead: params.publisherLead,
      lead: params.lead,
      configValues: params.configValues,
      campaign,
      mockBuyerPostUrl: params.mockBuyerPingUrl,
      requestMapping: pingMapping,
    });

    traceSteps = appendBuyerPostTraceStep(traceSteps, {
      key: "build-ping-request",
      label: "Build Ping Request",
      status: "pass",
      result: successStepResult(
        `Ping ready: ${pingPrepared.buyerRequest.method || "POST"} ${
          pingPrepared.postLeadUrl || "(URL from config)"
        }`
      ),
    });

    const pingResult = await executeBuyerHttpPhase({
      publisherLead: params.publisherLead,
      lead: params.lead,
      mappedValues,
      requestMapping: pingMapping,
      responseMapping: pingResponseMapping,
      requestMappingData: pingPrepared.requestMappingData,
      buyerRequest: pingPrepared.buyerRequest,
      targetUrl: pingPrepared.postLeadUrl,
      configValues,
      campaign,
      minPrice: params.minPrice,
      campaignType,
      timeoutMs: resolvePingTimeoutMs(configValues),
      mockOptions: mockBuyerPingOptions,
      skipPriceValidation: true,
      phase: "ping",
      missingUrlMessage: "Ping URL is not configured.",
      timeoutMessage: "Buyer ping request timed out.",
      failedMessage: "Failed to ping buyer.",
      initialTraceSteps: traceSteps,
    });

    if (pingResult.buyerStatus !== "Accept") {
      const bodyLooksLikeReject = (() => {
        try {
          const parsed = JSON.parse(pingResult.responseBody || "{}") as Record<string, unknown>;
          const status = String(parsed.status ?? parsed.status_text ?? "").trim().toLowerCase();
          return status === "reject" || status === "rejected" || status === "declined" || status === "2";
        } catch {
          return /"status"\s*:\s*("reject"|2)/i.test(pingResult.responseBody || "");
        }
      })();

      const isPingReject =
        pingResult.buyerStatus === "Reject" ||
        pingResult.buyerStatus === "Price Reject" ||
        pingResult.buyerStatus === "Ping Reject" ||
        (pingResult.buyerStatus === "Error" && bodyLooksLikeReject);

      const rejectReason =
        pingResult.rejectReason?.trim() ||
        (isPingReject
          ? pingResult.errorReason?.trim() || "Buyer rejected the ping."
          : "") ||
        "Buyer rejected the ping.";

      return {
        ...pingResult,
        buyerStatus: isPingReject
          ? "Ping Reject"
          : pingResult.buyerStatus === "Timeout"
            ? "Timeout"
            : "Error",
        rejectReason: isPingReject ? rejectReason : pingResult.rejectReason,
        errorReason: isPingReject
          ? ""
          : pingResult.errorReason || "Ping failed unexpectedly.",
      };
    }

    traceSteps = appendBuyerPostTraceStep(pingResult.traceSteps, {
      key: "ping-accepted",
      label: "Ping Accepted",
      status: "pass",
      summary: "Ping accepted. Continuing to Post.",
      result: successStepResult("Ping Accept — sending Post request."),
    });
  }

  traceSteps = appendBuyerPostTraceStep(traceSteps, {
    key: "build-request",
    label: "Build Integration Request",
    status: "pass",
    result: successStepResult(
      `Request ready: ${postPrepared.buyerRequest.method || "POST"} ${
        postPrepared.postLeadUrl || "(URL from config)"
      }`
    ),
  });

  return executeBuyerHttpPhase({
    publisherLead: params.publisherLead,
    lead: params.lead,
    mappedValues,
    requestMapping: params.integration.requestMapping,
    responseMapping: params.integration.responseMapping,
    requestMappingData: postPrepared.requestMappingData,
    buyerRequest: postPrepared.buyerRequest,
    targetUrl: postPrepared.postLeadUrl,
    configValues,
    campaign,
    minPrice: params.minPrice,
    campaignType,
    timeoutMs: resolvePostTimeoutMs(configValues),
    mockOptions: mockBuyerPostOptions,
    phase: "post",
    missingUrlMessage: "Post URL is not configured.",
    timeoutMessage: "Buyer post request timed out.",
    failedMessage: "Failed to post lead to buyer.",
    initialTraceSteps: traceSteps,
  });
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
