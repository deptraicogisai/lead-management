import type { TestLeadValidationCheck } from "@/lib/mapping-test-lead-intake";
import { buildLeadRejectResponse, formatLeadRejectResponseBody, formatBuyerPostResponseBody, formatPublisherReasons } from "@/lib/mapping-lead-validation";
import type {
  BuyerHttpRequestSnapshot,
  BuyerHttpResponseSnapshot,
  BuyerPostAttemptSnapshot,
} from "@/lib/buyer-post-request";
import { resolvePrimaryBuyerPostAttempt } from "@/lib/buyer-post-request";
import type { BuyerPostTraceStep, BuyerPostValidationCheck } from "@/lib/buyer-post-trace";

const CAMPAIGN_VALIDATION_DISPLAY_CATEGORIES = ["Duplicates", "Filters", "Schedule", "PL/DNPL", "Publisher"] as const;

export type MappingTestLeadLogRecord = {
  id: string;
  submittedAt: string;
  saveLead: boolean;
  postToBuyer: boolean;
  leadSaved: boolean;
  endpointUrl: string;
  requestBody: Record<string, unknown>;
  buyerPostAttempts: BuyerPostAttemptSnapshot[];
  postedBuyerRequest: BuyerHttpRequestSnapshot | null;
  postedBuyerResponse: BuyerHttpResponseSnapshot | null;
  publisherStatus: number;
  publisherResponse: Record<string, unknown>;
  status: number;
  responseBody: unknown;
  validationChecks: TestLeadValidationCheck[];
  validationPassed: boolean;
  buyerPostHint?: string | null;
  buyerStatus?: number | null;
  buyerResponse?: Record<string, unknown> | null;
};

function readLeadIdFromResponseBody(responseBody: unknown) {
  if (!responseBody || typeof responseBody !== "object" || Array.isArray(responseBody)) {
    return "";
  }

  const leadId = (responseBody as { lead_id?: unknown }).lead_id;
  return typeof leadId === "string" ? leadId : "";
}

export function resolvePublisherLogSnapshot(log: {
  validationPassed: boolean;
  publisherStatus?: number | null;
  publisherResponse?: Record<string, unknown> | null;
  status: number;
  responseBody: unknown;
  saveLead: boolean;
  leadSaved: boolean;
}) {
  if (log.publisherResponse && typeof log.publisherResponse === "object") {
    return {
      status: typeof log.publisherStatus === "number" ? log.publisherStatus : log.validationPassed ? 200 : 400,
      responseBody: log.publisherResponse,
      passed: log.validationPassed,
    };
  }

  if (log.validationPassed) {
    const leadId = readLeadIdFromResponseBody(log.responseBody);
    return {
      status: 200,
      responseBody: {
        status: 1,
        status_text: "Accepted",
        message: log.saveLead
          ? log.leadSaved
            ? "Lead passed publisher validation."
            : "Lead passed publisher validation. Save was requested but lead was not persisted."
          : "Lead passed publisher validation. Test lead data was not saved.",
        ...(leadId ? { lead_id: leadId } : {}),
      },
      passed: true,
    };
  }

  return {
    status: log.status >= 400 ? log.status : 400,
    responseBody:
      log.responseBody && typeof log.responseBody === "object" && !Array.isArray(log.responseBody)
        ? (log.responseBody as Record<string, unknown>)
        : {
            status: 2,
            status_text: "Rejected",
            reasons: formatPublisherReasons(["Publisher intake validation failed."]),
          },
    passed: false,
  };
}

export function resolvePrimaryCampaignValidationChecks(log: {
  buyerPostAttempts?: BuyerPostAttemptSnapshot[];
}) {
  const primaryAttempt = resolvePrimaryBuyerPostAttempt(log.buyerPostAttempts ?? []);
  return primaryAttempt?.campaignValidationChecks ?? [];
}

function parseBuyerValidationResponseBody(response: BuyerHttpResponseSnapshot | null) {
  if (!response?.body) {
    return null;
  }

  try {
    const parsed = JSON.parse(response.body) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
}

export function resolveBuyerResponseSnapshot(log: {
  postToBuyer: boolean;
  validationPassed: boolean;
  buyerPostAttempts?: BuyerPostAttemptSnapshot[];
  postedBuyerResponse?: BuyerHttpResponseSnapshot | null;
  buyerResponse?: Record<string, unknown> | null;
  buyerStatus?: number | null;
}) {
  if (!log.postToBuyer || !log.validationPassed) {
    return {
      status: 0,
      responseBody: null as Record<string, unknown> | null,
      campaignIntakePassed: false,
      postedToBuyer: false,
    };
  }

  if (log.buyerResponse && typeof log.buyerResponse === "object") {
    const primaryAttempt = resolvePrimaryBuyerPostAttempt(log.buyerPostAttempts ?? []);
    const responseBody =
      primaryAttempt?.postedToBuyer === false
        ? formatLeadRejectResponseBody(log.buyerResponse)
        : log.buyerResponse;

    return {
      status: 0,
      responseBody,
      campaignIntakePassed: isCampaignIntakeValidationPassed(
        resolvePrimaryCampaignValidationChecks(log)
      ),
      postedToBuyer: primaryAttempt?.postedToBuyer !== false,
    };
  }

  const primaryAttempt = resolvePrimaryBuyerPostAttempt(log.buyerPostAttempts ?? []);
  if (!primaryAttempt) {
    return {
      status: 0,
      responseBody: null,
      campaignIntakePassed: true,
      postedToBuyer: false,
    };
  }

  const campaignIntakePassed = isCampaignIntakeValidationPassed(primaryAttempt.campaignValidationChecks ?? []);
  if (primaryAttempt.postedToBuyer === false) {
    const responseBody = formatLeadRejectResponseBody(
      parseBuyerValidationResponseBody(primaryAttempt.response) ??
        (buildLeadRejectResponse(
          primaryAttempt.campaignValidationChecks
            .filter((check) => !check.passed)
            .flatMap((check) => check.messages)
        ) as Record<string, unknown>)
    );

    return {
      status: 0,
      responseBody,
      campaignIntakePassed: false,
      postedToBuyer: false,
    };
  }

  return {
    status: 0,
    responseBody: formatBuyerPostResponseBody({
      buyerStatus: primaryAttempt.buyerStatus,
      price: primaryAttempt.price,
      redirectUrl: primaryAttempt.redirectUrl,
      rejectReason: primaryAttempt.rejectReason,
      errorReason: primaryAttempt.errorReason,
    }),
    campaignIntakePassed,
    postedToBuyer: true,
  };
}

export function normalizeCampaignValidationChecksForDisplay(
  checks: BuyerPostValidationCheck[]
): BuyerPostValidationCheck[] {
  if (checks.length === 0) {
    return [];
  }

  const byCategory = new Map(checks.map((check) => [check.category, check]));

  if (byCategory.has("Duplicates")) {
    return CAMPAIGN_VALIDATION_DISPLAY_CATEGORIES.map((category) => byCategory.get(category)).filter(
      (check): check is BuyerPostValidationCheck => Boolean(check)
    );
  }

  const duplicateSold = byCategory.get("Duplicate Sold");
  const duplicatePosted = byCategory.get("Duplicate Posted");
  const duplicatesPassed =
    (duplicateSold?.passed ?? true) && (duplicatePosted?.passed ?? true);
  const duplicateFailureMessages = [
    ...(duplicateSold && !duplicateSold.passed ? duplicateSold.messages : []),
    ...(duplicatePosted && !duplicatePosted.passed ? duplicatePosted.messages : []),
  ];
  const duplicateMessages = duplicatesPassed
    ? duplicateFailureMessages.length > 0
      ? ["Passed."]
      : ["Passed."]
    : duplicateFailureMessages;

  const normalized: BuyerPostValidationCheck[] = [
    {
      category: "Duplicates",
      passed: duplicatesPassed,
      messages: duplicateMessages.length > 0 ? duplicateMessages : ["Passed."],
    },
  ];

  for (const category of CAMPAIGN_VALIDATION_DISPLAY_CATEGORIES.slice(1)) {
    const check = byCategory.get(category);
    if (check) {
      normalized.push(check);
    }
  }

  return normalized;
}

export function isCampaignIntakeValidationPassed(checks: BuyerPostValidationCheck[]) {
  const displayChecks = normalizeCampaignValidationChecksForDisplay(checks);
  if (displayChecks.length === 0) {
    return true;
  }

  return displayChecks.every((check) => check.passed);
}

export function buildSystemBuyerValidationStep(params: {
  checks: BuyerPostValidationCheck[];
  buyerPostHint?: string | null;
  label?: string;
}): BuyerPostTraceStep {
  const displayChecks = normalizeCampaignValidationChecksForDisplay(params.checks);
  const hasChecks = displayChecks.length > 0;
  const validationPassed = params.checks.length > 0 && params.checks.every((check) => check.passed);
  const failedMessages = params.checks
    .filter((check) => !check.passed)
    .flatMap((check) => check.messages);

  return {
    key: "system-buyer-campaign-validation",
    label: params.label ?? "System → Buyer",
    status: !hasChecks ? "skip" : validationPassed ? "pass" : "fail",
    summary: !hasChecks
      ? params.buyerPostHint ?? "Campaign validation was not run."
      : validationPassed
        ? "Campaign validation passed (duplicates, filters, schedule, PL/DNPL)."
        : "Campaign validation failed.",
    validationChecks: displayChecks,
    result: validationPassed
      ? { success: true, message: "Campaign validation passed." }
      : {
          success: false,
          error: failedMessages.join(" | ") || "Campaign validation failed.",
        },
  };
}

export function resolveBuyerLogSnapshot(log: {
  postToBuyer: boolean;
  validationPassed: boolean;
  buyerPostAttempts?: BuyerPostAttemptSnapshot[];
  postedBuyerRequest?: BuyerHttpRequestSnapshot | null;
  postedBuyerResponse?: BuyerHttpResponseSnapshot | null;
  buyerPostHint?: string | null;
  buyerResponse?: Record<string, unknown> | null;
  buyerStatus?: number | null;
}) {
  if (!log.postToBuyer) {
    return {
      enabled: false,
      skipped: false,
      request: null as BuyerHttpRequestSnapshot | null,
      response: null as BuyerHttpResponseSnapshot | null,
      passed: false,
      campaignIntakePassed: false,
      postedToBuyer: false,
      rejectResponseBody: null as Record<string, unknown> | null,
    };
  }

  if (!log.validationPassed) {
    return {
      enabled: true,
      skipped: true,
      request: null,
      response: null,
      passed: false,
      campaignIntakePassed: false,
      postedToBuyer: false,
      rejectResponseBody: null,
    };
  }

  const buyerResponseSnapshot = resolveBuyerResponseSnapshot(log);
  if (!buyerResponseSnapshot.postedToBuyer) {
    return {
      enabled: true,
      skipped: false,
      request: null,
      response: null,
      passed: false,
      campaignIntakePassed: false,
      postedToBuyer: false,
      rejectResponseBody: buyerResponseSnapshot.responseBody,
    };
  }

  const primaryAttempt = resolvePrimaryBuyerPostAttempt(log.buyerPostAttempts ?? []);
  const request = log.postedBuyerRequest ?? primaryAttempt?.request ?? null;
  const response = log.postedBuyerResponse ?? primaryAttempt?.response ?? null;
  const passed =
    primaryAttempt?.buyerStatus === "Accept" ||
    (response !== null && response.httpStatus >= 200 && response.httpStatus < 300);

  return {
    enabled: true,
    skipped: false,
    request,
    response,
    passed,
    hint: request ? null : log.buyerPostHint ?? null,
    campaignIntakePassed: buyerResponseSnapshot.campaignIntakePassed,
    postedToBuyer: true,
    rejectResponseBody: null,
  };
}
