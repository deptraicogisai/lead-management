import { Types } from "mongoose";
import { resolveBuyerMockPostUrl, isBuyerLeadMockEndpoint } from "@/lib/buyer-lead-api";
import { CampaignModel } from "@/lib/models/campaign";
import { BuyerModel } from "@/lib/models/buyer";
import { IntegrationBuilderModel } from "@/lib/models/integration-builder";
import { ensureDefaultPingTrees, PingTreeModel } from "@/lib/models/ping-tree";
import { LeadDeliveryModel, type BuyerLeadStatus } from "@/lib/models/lead-delivery";
import { SellerLeadModel } from "@/lib/models/seller-lead";
import { toIntegrationBuilderRecord, buildVerticalIndexMap } from "@/lib/integration-builder";
import { VerticalModel } from "@/lib/models/industry";
import {
  attachDuplicateFingerprint,
  validateCampaignLeadIntake,
} from "@/lib/campaign-lead-validation";
import { createBuyerDeliveryLog, deliverLeadToBuyer, prepareBuyerIntegrationRequest } from "@/lib/buyer-delivery";
import {
  appendBuyerPostTraceStep,
  buildValidationTraceStep,
  errorStepResult,
  skippedStepResult,
  successStepResult,
  type BuyerPostTraceStep,
} from "@/lib/buyer-post-trace";
import type { PingTreeCampaignType } from "@/lib/ping-tree";
import {
  mapPingTreeTypeToProcessingType,
  selectPingTreeConfig,
  type SelectedPingTreeConfig,
} from "@/lib/ping-tree-allocation";
import { resolveBuyerRedirectUrl } from "@/lib/publisher-redirect";
import { normalizeCampaignIntegrationConfigValues } from "@/lib/campaign-integration-config";
import {
  resolvePublisherPingTreeTypes,
  SILENT_API_NO_BUYER_MESSAGE,
  type MappingApiType,
} from "@/lib/mapping-api-type";
import { buildCampaignTemplateContext } from "@/lib/campaign-template";
import {
  defaultMappingRevShareSettings,
  resolvePublisherPriceFromRevShare,
  type MappingRevShareSettingsRecord,
} from "@/lib/mapping-rev-share-settings";
import {
  resolvePublisherBuyerPrice,
  shouldExposePublisherResponsePrice,
} from "@/lib/lead-price";
import type { MockBuyerPostOptions } from "@/lib/mock-buyer-post";
import { mergeMockBuyerPostOptions, normalizeCampaignTestMocks, type CampaignTestMockResponse } from "@/lib/campaign-test-mock";
import type { MappingFieldDoc } from "@/lib/mapping-field-api";
import {
  buildBuyerPostAttemptSnapshot,
  buildBuyerPostAttemptLogId,
  buildBuyerHttpRequestSnapshot,
  buildCampaignValidationFailedAttemptSnapshot,
  buildStructuredBuyerDeliveryPayload,
  type BuyerHttpRequestSnapshot,
  type BuyerPostAttemptSnapshot,
} from "@/lib/buyer-post-request";
import type { BuyerPostValidationCheck } from "@/lib/buyer-post-trace";
import type { CampaignIntakeRuleGroup } from "@/lib/campaign-test-lead-intake";
import { sortBuyerPostAttemptViews, type PendingBuyerPostCampaign } from "@/lib/test-lead-buyer-progress";

export type PublisherLeadStatus = "Sold" | "Reject" | "Post Error" | "Test";

export type CampaignDeliveryLog = {
  campaignId: string;
  campaignName: string;
  buyerId: string;
  buyerCompany: string;
  pingTreeType: PingTreeCampaignType;
  campaignOrder: number;
  buyerStatus: BuyerLeadStatus;
  validationErrors: string[];
  price: number | null;
  redirectUrl: string;
  rejectSign: string;
  rejectReason: string;
  errorReason: string;
  postLeadUrl: string;
  httpStatus: number;
  traceSteps: BuyerPostTraceStep[];
  publisherLead?: Record<string, unknown>;
  systemLead?: Record<string, unknown>;
  mappedValues?: Record<string, string>;
  buyerRequest?: BuyerHttpRequestSnapshot;
  requestPayload?: Record<string, unknown> | null;
  responseBody?: string;
  responseHeaders?: Record<string, string>;
  campaignValidationChecks?: BuyerPostValidationCheck[];
  campaignIntakeRuleGroups?: CampaignIntakeRuleGroup[];
  campaignTimezone?: string;
  campaignMinPrice?: number;
  postedAt?: string;
  responseTimeMs?: number | null;
};

export type LeadDistributionResult = {
  publisherStatus: PublisherLeadStatus;
  redirectUrl: string;
  soldPrice: number | null;
  publisherResponsePrice: number | null;
  campaignDeliveries: CampaignDeliveryLog[];
  buyerPostAttempts: BuyerPostAttemptSnapshot[];
  buyerPostHint?: string;
  message: string;
};

function isTestLeadPayload(payload: Record<string, unknown>) {
  const testValue = payload.test ?? payload.Test;
  if (testValue === 0 || testValue === "0" || testValue === false || testValue === "false") {
    return true;
  }
  return false;
}

function orderPingTreeActiveCampaignIds(activeCampaignIds: string[]) {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const rawId of activeCampaignIds) {
    const campaignId = rawId?.trim() ?? "";
    if (!campaignId || seen.has(campaignId)) {
      continue;
    }

    seen.add(campaignId);
    ordered.push(campaignId);
  }

  return ordered;
}

function hasRedirectDeliveries(deliveries: CampaignDeliveryLog[]) {
  return deliveries.some((entry) => entry.pingTreeType === "Redirect");
}

function toPublisherStatus(deliveries: CampaignDeliveryLog[], hadPostError: boolean): PublisherLeadStatus {
  if (deliveries.some((entry) => entry.pingTreeType === "Redirect" && entry.buyerStatus === "Accept")) {
    return "Sold";
  }

  if (deliveries.some((entry) => entry.pingTreeType === "Silent" && entry.buyerStatus === "Accept")) {
    return "Sold";
  }

  if (hadPostError) {
    return "Post Error";
  }

  return "Reject";
}

function findAcceptedDelivery(deliveries: CampaignDeliveryLog[]) {
  const redirectAccept = deliveries.find(
    (entry) => entry.pingTreeType === "Redirect" && entry.buyerStatus === "Accept"
  );
  if (redirectAccept) {
    return redirectAccept;
  }

  return deliveries.find((entry) => entry.pingTreeType === "Silent" && entry.buyerStatus === "Accept");
}

function resolvePublisherPostError(deliveries: CampaignDeliveryLog[]) {
  if (hasRedirectDeliveries(deliveries)) {
    return deliveries.some(
      (entry) =>
        entry.pingTreeType === "Redirect" &&
        (entry.buyerStatus === "Error" || entry.buyerStatus === "Timeout")
    );
  }

  return deliveries.some((entry) => entry.buyerStatus === "Error" || entry.buyerStatus === "Timeout");
}

function buildPublisherRejectMessage(deliveries: CampaignDeliveryLog[]) {
  const redirectAttempt = deliveries.find(
    (entry) => entry.pingTreeType === "Redirect" && entry.buyerStatus !== "Skipped"
  );
  const silentAttempt = deliveries.find(
    (entry) => entry.pingTreeType === "Silent" && entry.buyerStatus !== "Skipped"
  );
  const primary =
    redirectAttempt ??
    silentAttempt ??
    deliveries.find((entry) => entry.buyerStatus !== "Skipped");

  // No lead actually reached a buyer: campaign is not in the ping tree, every
  // campaign is disabled, the buyer is disabled, or the integration is
  // disabled/missing. Surface a filter/duplicate reason when one exists,
  // otherwise report "Buyer not found." so the publisher always gets a
  // consistent reject reason for these gate conditions.
  if (!primary) {
    const validationSkip = deliveries.find(
      (entry) => entry.buyerStatus === "Skipped" && entry.validationErrors.length > 0
    );
    return validationSkip
      ? validationSkip.validationErrors.join(" | ")
      : SILENT_API_NO_BUYER_MESSAGE;
  }

  if (primary.buyerStatus === "Price Reject" || primary.buyerStatus === "Price Conflict") {
    return primary.rejectReason || "Buyer price did not meet campaign requirements.";
  }

  if (primary.buyerStatus === "Reject") {
    return primary.rejectReason
      ? `Lead was not sold: ${primary.rejectReason}`
      : "Lead was not sold to any buyer.";
  }

  return "Lead was not sold to any buyer.";
}

async function loadVerticalFields(verticalRefId: string) {
  const vertical = await VerticalModel.findById(verticalRefId).lean();
  const fields = (vertical?.fields as MappingFieldDoc[] | undefined) ?? [];
  return fields.map((field) => ({
    _id: field._id,
    fieldName: field.fieldName,
    description: field.description,
    type: field.type,
    required: Boolean(field.required),
    format: field.format,
    dataTypeFilter: field.dataTypeFilter,
    options: field.options,
  })) as MappingFieldDoc[];
}

async function loadIntegrationRecord(integrationId: string) {
  const integrationDoc = await IntegrationBuilderModel.findById(integrationId).lean();
  if (!integrationDoc) return null;

  const verticals = await VerticalModel.find().select({ name: 1 }).lean();
  const verticalIds = verticals.map((entry) => entry._id?.toString() ?? "").filter(Boolean);
  const verticalIndexById = buildVerticalIndexMap(verticalIds);
  const verticalNameById = new Map(
    verticals.map((entry) => [entry._id?.toString() ?? "", entry.name?.trim() || "Unknown"])
  );

  return toIntegrationBuilderRecord(
    integrationDoc as Parameters<typeof toIntegrationBuilderRecord>[0],
    verticalNameById,
    verticalIndexById
  );
}

async function buildCampaignBuyerRequestPreview(params: {
  campaign: {
    integrationRef?: { toString(): string } | string | null;
    integrationSettings?: Parameters<typeof normalizeCampaignIntegrationConfigValues>[0];
  };
  payload: Record<string, unknown>;
  origin: string;
  mockBuyerPost: boolean;
  buyer: {
    _id?: { toString(): string };
    postLeadUrl?: string | null;
    apiKey?: string | null;
  };
  buyerId: string;
}) {
  const integrationId = params.campaign.integrationRef?.toString() ?? "";
  if (!integrationId) return null;

  const integration = await loadIntegrationRecord(integrationId);
  if (!integration) return null;

  const configValues = normalizeCampaignIntegrationConfigValues(params.campaign.integrationSettings);
  const mockBuyerPostUrl = params.mockBuyerPost
    ? resolveBuyerMockPostUrl(params.buyer, params.origin, params.buyerId)
    : undefined;

  return prepareBuyerIntegrationRequest({
    integration,
    publisherLead: params.payload,
    lead: params.payload,
    configValues,
    mockBuyerPostUrl,
  });
}

async function attachMockBuyerRequestPreview(
  delivery: CampaignDeliveryLog,
  options: {
    campaign: {
      integrationRef?: { toString(): string } | string | null;
      integrationSettings?: Parameters<typeof normalizeCampaignIntegrationConfigValues>[0];
    };
    payload: Record<string, unknown>;
    publisherPayload: Record<string, unknown>;
    origin: string;
    mockBuyerPost: boolean;
    buyer: {
      _id?: { toString(): string };
      postLeadUrl?: string | null;
      apiKey?: string | null;
    };
    buyerId: string;
  }
) {
  if (!options.mockBuyerPost || delivery.buyerRequest) {
    return delivery;
  }

  const preview = await buildCampaignBuyerRequestPreview({
    campaign: options.campaign,
    payload: options.payload,
    origin: options.origin,
    mockBuyerPost: options.mockBuyerPost,
    buyer: options.buyer,
    buyerId: options.buyerId,
  });

  if (!preview) {
    return delivery;
  }

  return {
    ...delivery,
    publisherLead: options.publisherPayload,
    systemLead: preview.systemLead,
    mappedValues: preview.mappedValues,
    buyerRequest: preview.buyerRequest,
    requestPayload: preview.requestMappingData,
    postLeadUrl: preview.postLeadUrl,
  };
}

async function resolvePingTreeCampaignIds(params: {
  treeActiveCampaignIds: string[];
  priorities: Map<string, number> | Record<string, number>;
  pingTreeType: PingTreeCampaignType;
  verticalRefId: string;
  mockBuyerPost: boolean;
}) {
  const orderedFromTree = orderPingTreeActiveCampaignIds(params.treeActiveCampaignIds);
  if (orderedFromTree.length > 0 || !params.mockBuyerPost) {
    return orderedFromTree;
  }

  const campaigns = await CampaignModel.find({
    status: "Active",
    campaignType: params.pingTreeType,
    verticalRef: new Types.ObjectId(params.verticalRefId),
  })
    .sort({ displayId: -1 })
    .select({ _id: 1 })
    .lean();

  return campaigns.map((campaign) => campaign._id?.toString() ?? "").filter(Boolean);
}

async function resolveEligiblePingTreeCampaignIds(params: {
  pingTreeType: PingTreeCampaignType;
  verticalRefId: string;
  mockBuyerPost: boolean;
  selectedConfig?: SelectedPingTreeConfig | null;
}) {
  // When a weighted PingTreeConfig was selected for this bucket, use its own
  // arrangement. Otherwise fall back to the legacy single PingTree per type.
  let treeActiveCampaignIds: string[];
  let priorities: Map<string, number> | Record<string, number>;

  if (params.selectedConfig) {
    treeActiveCampaignIds = params.selectedConfig.activeCampaignIds;
    priorities = params.selectedConfig.campaignPriorities;
  } else {
    await ensureDefaultPingTrees();
    const tree = await PingTreeModel.findOne({ campaignType: params.pingTreeType }).lean();
    if (!tree) {
      return [] as string[];
    }
    treeActiveCampaignIds = tree.activeCampaignIds ?? [];
    priorities =
      tree.campaignPriorities instanceof Map
        ? tree.campaignPriorities
        : new Map(Object.entries((tree.campaignPriorities as Record<string, number> | undefined) ?? {}));
  }

  const orderedCampaignIds = await resolvePingTreeCampaignIds({
    treeActiveCampaignIds,
    priorities,
    pingTreeType: params.pingTreeType,
    verticalRefId: params.verticalRefId,
    mockBuyerPost: params.mockBuyerPost,
  });

  if (orderedCampaignIds.length === 0) {
    return [] as string[];
  }

  const activeCampaigns = await CampaignModel.find({
    _id: { $in: orderedCampaignIds.map((campaignId) => new Types.ObjectId(campaignId)) },
    status: "Active",
    campaignType: params.pingTreeType,
  })
    .select({ _id: 1 })
    .lean();

  const activeCampaignIdSet = new Set(
    activeCampaigns.map((campaign) => campaign._id?.toString() ?? "").filter(Boolean)
  );

  return orderedCampaignIds.filter((campaignId) => activeCampaignIdSet.has(campaignId));
}

async function loadPingTreeCampaignTestMocks(
  pingTreeType: PingTreeCampaignType,
  selectedConfig?: SelectedPingTreeConfig | null
) {
  if (selectedConfig) {
    return selectedConfig.campaignTestMocks;
  }

  await ensureDefaultPingTrees();
  const tree = await PingTreeModel.findOne({ campaignType: pingTreeType }).lean();
  return normalizeCampaignTestMocks(
    tree?.campaignTestMocks as Record<string, unknown> | Map<string, unknown> | undefined
  );
}

async function buildFallbackTestLeadBuyerDelivery(params: {
  verticalRefId: string;
  payload: Record<string, unknown>;
  postedAt: Date;
  origin: string;
  sellerLeadId: string;
  sellerRefId: string;
  mockBuyerPostOptions?: MockBuyerPostOptions;
  publisherApiType?: MappingApiType;
}) {
  const allowedPingTreeTypes = new Set(resolvePublisherPingTreeTypes(params.publisherApiType ?? "Redirect"));
  const campaigns = await CampaignModel.find({
    status: "Active",
    verticalRef: new Types.ObjectId(params.verticalRefId),
  })
    .sort({ displayId: -1 })
    .lean();

  for (const campaign of campaigns) {
    const campaignId = campaign._id?.toString() ?? "";
    if (!campaignId) continue;

    const pingTreeType = campaign.campaignType === "Silent" ? "Silent" : "Redirect";
    if (!allowedPingTreeTypes.has(pingTreeType)) {
      continue;
    }
    const campaignTestMocks = await loadPingTreeCampaignTestMocks(pingTreeType);

    const result = await processCampaignAttempt({
      campaignId,
      campaignOrder: 1,
      pingTreeType,
      sellerLeadId: params.sellerLeadId,
      sellerRefId: params.sellerRefId,
      verticalRefId: params.verticalRefId,
      payload: params.payload,
      postedAt: params.postedAt,
      origin: params.origin,
      mockBuyerPost: true,
      mockBuyerPostOptions: params.mockBuyerPostOptions,
      campaignTestMocks,
    });

    if (result?.campaignValidationChecks?.length) {
      return result;
    }
  }

  return null;
}

async function processCampaignAttempt(params: {
  campaignId: string;
  campaignOrder: number;
  pingTreeType: PingTreeCampaignType;
  sellerLeadId: string;
  sellerRefId: string;
  verticalRefId: string;
  payload: Record<string, unknown>;
  postedAt: Date;
  origin: string;
  mockBuyerPost: boolean;
  mockBuyerPostOptions?: MockBuyerPostOptions;
  campaignTestMocks?: Record<string, CampaignTestMockResponse>;
}) {
  let traceSteps: BuyerPostTraceStep[] = [];

  const campaign = await CampaignModel.findById(params.campaignId).lean();
  if (!campaign || campaign.status !== "Active") {
    traceSteps = appendBuyerPostTraceStep(traceSteps, {
      key: "campaign-lookup",
      label: "Campaign Lookup",
      status: "skip",
      summary: !campaign
        ? "Campaign not found."
        : `Campaign status is "${campaign.status}". Only Active campaigns are attempted.`,
      result: errorStepResult(
        !campaign
          ? "Campaign not found."
          : `Campaign status is "${campaign.status}". Only Active campaigns are attempted.`
      ),
    });

    return {
      campaignId: params.campaignId,
      campaignName: campaign?.name?.trim() || "Campaign",
      buyerId: campaign?.buyerRef?.toString() ?? "",
      buyerCompany: "Buyer",
      pingTreeType: params.pingTreeType,
      campaignOrder: params.campaignOrder,
      buyerStatus: "Skipped" as const,
      validationErrors: [],
      price: null,
      redirectUrl: "",
      rejectSign: "",
      rejectReason: "",
      errorReason: traceSteps[traceSteps.length - 1]?.summary ?? "Campaign is not active.",
      postLeadUrl: "",
      httpStatus: 0,
      traceSteps,
      campaignMinPrice: campaign?.minPrice ?? 0,
    };
  }

  const campaignVerticalId = campaign.verticalRef?.toString() ?? "";
  if (campaignVerticalId && campaignVerticalId !== params.verticalRefId) {
    traceSteps = appendBuyerPostTraceStep(traceSteps, {
      key: "campaign-vertical",
      label: "Campaign Vertical Match",
      status: "skip",
      summary: "Campaign vertical does not match seller lead vertical.",
      result: errorStepResult("Campaign vertical does not match seller lead vertical."),
    });

    return attachMockBuyerRequestPreview(
      {
        campaignId: params.campaignId,
        campaignName: campaign.name?.trim() || "Campaign",
        buyerId: campaign.buyerRef?.toString() ?? "",
        buyerCompany: "Buyer",
        pingTreeType: params.pingTreeType,
        campaignOrder: params.campaignOrder,
        buyerStatus: "Skipped" as const,
        validationErrors: [],
        price: null,
        redirectUrl: "",
        rejectSign: "",
        rejectReason: "",
        errorReason: "Campaign vertical does not match seller lead vertical.",
        postLeadUrl: "",
        httpStatus: 0,
        traceSteps,
        campaignMinPrice: campaign.minPrice ?? 0,
      },
      {
        campaign,
        payload: params.payload,
        publisherPayload: params.payload,
        origin: params.origin,
        mockBuyerPost: params.mockBuyerPost,
        buyer: { _id: { toString: () => campaign.buyerRef?.toString() ?? "" } },
        buyerId: campaign.buyerRef?.toString() ?? "",
      }
    );
  }

  const buyer = await BuyerModel.findById(campaign.buyerRef).lean();
  if (!buyer || buyer.status !== "Active") {
    traceSteps = appendBuyerPostTraceStep(traceSteps, {
      key: "buyer-lookup",
      label: "Buyer Lookup",
      status: "skip",
      summary: !buyer
        ? "Buyer not found."
        : `Buyer status is "${buyer.status}". Only Active buyers are attempted.`,
      result: errorStepResult(
        !buyer
          ? "Buyer not found."
          : `Buyer status is "${buyer.status}". Only Active buyers are attempted.`
      ),
    });

    return attachMockBuyerRequestPreview(
      {
        campaignId: params.campaignId,
        campaignName: campaign.name?.trim() || "Campaign",
        buyerId: buyer?._id?.toString() ?? campaign.buyerRef?.toString() ?? "",
        buyerCompany: buyer?.company?.trim() || "Buyer",
        pingTreeType: params.pingTreeType,
        campaignOrder: params.campaignOrder,
        buyerStatus: "Skipped" as const,
        validationErrors: [],
        price: null,
        redirectUrl: "",
        rejectSign: "",
        rejectReason: "",
        errorReason: traceSteps[traceSteps.length - 1]?.summary ?? "Buyer is not active.",
        postLeadUrl: "",
        httpStatus: 0,
        traceSteps,
        campaignMinPrice: campaign.minPrice ?? 0,
      },
      {
        campaign,
        payload: params.payload,
        publisherPayload: params.payload,
        origin: params.origin,
        mockBuyerPost: params.mockBuyerPost,
        buyer: buyer ?? { _id: { toString: () => campaign.buyerRef?.toString() ?? "" } },
        buyerId: buyer?._id?.toString() ?? campaign.buyerRef?.toString() ?? "",
      }
    );
  }

  traceSteps = appendBuyerPostTraceStep(traceSteps, {
    key: "campaign-lookup",
    label: "Campaign Lookup",
    status: "pass",
    summary: `Campaign "${campaign.name?.trim() || "Campaign"}" is active.`,
    result: successStepResult(`Campaign "${campaign.name?.trim() || "Campaign"}" is active.`),
  });

  traceSteps = appendBuyerPostTraceStep(traceSteps, {
    key: "buyer-lookup",
    label: "Buyer Lookup",
    status: "pass",
    summary: `Buyer "${buyer.company?.trim() || "Buyer"}" is active.`,
    result: successStepResult(`Buyer "${buyer.company?.trim() || "Buyer"}" is active.`),
  });

  const campaignFields = await loadVerticalFields(campaignVerticalId || params.verticalRefId);
  let validation = await validateCampaignLeadIntake({
    campaign,
    campaignFields,
    buyer,
    sellerRefId: params.sellerRefId,
    payload: params.payload,
    postedAt: params.postedAt,
  });

  traceSteps = appendBuyerPostTraceStep(
    traceSteps,
    buildValidationTraceStep(validation.passed, validation.validationChecks, validation.reasons)
  );

  const bypassCampaignValidation = params.mockBuyerPost && isTestLeadPayload(params.payload);
  if (bypassCampaignValidation && !validation.passed) {
    traceSteps = appendBuyerPostTraceStep(traceSteps, {
      key: "test-lead-campaign-validation",
      label: "Test Lead Mock Post",
      status: "info",
      summary: "Campaign validation failed in production but was bypassed for test lead mock post.",
      result: successStepResult(
        validation.reasons.join(" | ") || "Campaign validation bypassed for test lead mock post."
      ),
    });
    validation = {
      ...validation,
      passed: true,
      reasons: [],
    };
  }

  const payloadWithFingerprint = attachDuplicateFingerprint(params.payload, validation.intakeSettings.duplicates);
  const duplicateFingerprint = payloadWithFingerprint.__duplicateFingerprint as string;

  const campaignName = campaign.name?.trim() || "Campaign";
  const buyerId = buyer._id?.toString() ?? "";
  const buyerCompany = buyer.company?.trim() || "Buyer";
  const campaignValidationChecks = validation.validationChecks;
  const campaignIntakeRuleGroups = validation.intakeRuleGroups;
  const campaignTimezone = validation.intakeSettings.timezone;
  const campaignMinPrice = campaign.minPrice ?? 0;

  if (!validation.passed) {
    const skipped: CampaignDeliveryLog = {
      campaignId: params.campaignId,
      campaignName,
      buyerId,
      buyerCompany,
      pingTreeType: params.pingTreeType,
      campaignOrder: params.campaignOrder,
      buyerStatus: "Skipped",
      validationErrors: validation.reasons,
      price: null,
      redirectUrl: "",
      rejectSign: "",
      rejectReason: "",
      errorReason: validation.reasons.join(" | "),
      postLeadUrl: "",
      httpStatus: 0,
      traceSteps,
      campaignValidationChecks,
      campaignIntakeRuleGroups,
      campaignTimezone,
      campaignMinPrice,
      postedAt: params.postedAt.toISOString(),
    };

    await LeadDeliveryModel.create({
      sellerLeadRef: new Types.ObjectId(params.sellerLeadId),
      sellerRef: new Types.ObjectId(params.sellerRefId),
      verticalRef: new Types.ObjectId(params.verticalRefId),
      campaignRef: new Types.ObjectId(params.campaignId),
      buyerRef: new Types.ObjectId(buyerId),
      pingTreeType: params.pingTreeType,
      campaignOrder: params.campaignOrder,
      buyerStatus: "Skipped",
      validationErrors: validation.reasons,
      errorReason: validation.reasons.join(" | "),
      deliveryTrace: traceSteps,
      duplicateFingerprint,
      postedAt: params.postedAt,
    });

    return skipped;
  }

  const integrationId = campaign.integrationRef?.toString() ?? "";
  if (!integrationId) {
    const errorReason = "Campaign integration is not configured.";
    traceSteps = appendBuyerPostTraceStep(traceSteps, {
      key: "integration-config",
      label: "Integration Configuration",
      status: "skip",
      summary: errorReason,
      result: skippedStepResult(errorReason),
    });

    const log: CampaignDeliveryLog = {
      campaignId: params.campaignId,
      campaignName,
      buyerId,
      buyerCompany,
      pingTreeType: params.pingTreeType,
      campaignOrder: params.campaignOrder,
      buyerStatus: "Skipped",
      validationErrors: [],
      price: null,
      redirectUrl: "",
      rejectSign: "",
      rejectReason: "",
      errorReason,
      postLeadUrl: "",
      httpStatus: 0,
      traceSteps,
      campaignValidationChecks,
      campaignIntakeRuleGroups,
      campaignTimezone,
      campaignMinPrice,
      postedAt: params.postedAt.toISOString(),
    };

    await LeadDeliveryModel.create({
      sellerLeadRef: new Types.ObjectId(params.sellerLeadId),
      sellerRef: new Types.ObjectId(params.sellerRefId),
      verticalRef: new Types.ObjectId(params.verticalRefId),
      campaignRef: new Types.ObjectId(params.campaignId),
      buyerRef: new Types.ObjectId(buyerId),
      pingTreeType: params.pingTreeType,
      campaignOrder: params.campaignOrder,
      buyerStatus: "Skipped",
      errorReason,
      deliveryTrace: traceSteps,
      duplicateFingerprint,
      postedAt: params.postedAt,
    });

    return log;
  }

  const integration = await loadIntegrationRecord(integrationId);
  if (!integration) {
    const errorReason = "Integration builder record not found.";
    traceSteps = appendBuyerPostTraceStep(traceSteps, {
      key: "integration-config",
      label: "Integration Configuration",
      status: "skip",
      summary: errorReason,
      result: skippedStepResult(errorReason),
    });

    return {
      campaignId: params.campaignId,
      campaignName,
      buyerId,
      buyerCompany,
      pingTreeType: params.pingTreeType,
      campaignOrder: params.campaignOrder,
      buyerStatus: "Skipped" as const,
      validationErrors: [],
      price: null,
      redirectUrl: "",
      rejectSign: "",
      rejectReason: "",
      errorReason,
      postLeadUrl: "",
      httpStatus: 0,
      traceSteps,
      campaignValidationChecks,
      campaignIntakeRuleGroups,
      campaignTimezone,
      campaignMinPrice,
    };
  }

  if (integration.status !== "Active") {
    const errorReason = `Integration "${integration.name}" is "${integration.status}". Only Active integrations post to the buyer.`;
    traceSteps = appendBuyerPostTraceStep(traceSteps, {
      key: "integration-config",
      label: "Integration Configuration",
      status: "skip",
      summary: errorReason,
      result: skippedStepResult(errorReason),
    });

    return {
      campaignId: params.campaignId,
      campaignName,
      buyerId,
      buyerCompany,
      pingTreeType: params.pingTreeType,
      campaignOrder: params.campaignOrder,
      buyerStatus: "Skipped" as const,
      validationErrors: [],
      price: null,
      redirectUrl: "",
      rejectSign: "",
      rejectReason: "",
      errorReason,
      postLeadUrl: "",
      httpStatus: 0,
      traceSteps,
      campaignValidationChecks,
      campaignIntakeRuleGroups,
      campaignTimezone,
      campaignMinPrice,
    };
  }

  const configValues = normalizeCampaignIntegrationConfigValues(campaign.integrationSettings);
  traceSteps = appendBuyerPostTraceStep(traceSteps, {
    key: "integration-config",
    label: "Integration Configuration",
    status: "pass",
    summary: `Integration "${integration.name}" is configured.`,
    result: successStepResult(`Integration "${integration.name}" is configured.`),
  });

  const mockBuyerPostUrl = params.mockBuyerPost
    ? resolveBuyerMockPostUrl(buyer, params.origin, buyerId)
    : undefined;
  const campaignMockOptions = mergeMockBuyerPostOptions(
    params.mockBuyerPostOptions,
    params.campaignTestMocks?.[params.campaignId] ?? null
  );
  const resolvedPostUrl =
    mockBuyerPostUrl?.trim() ||
    normalizeCampaignIntegrationConfigValues(campaign.integrationSettings).url?.trim() ||
    buyer.postLeadUrl?.trim() ||
    "";
  const usesMockEndpoint = Boolean(mockBuyerPostUrl) || isBuyerLeadMockEndpoint(resolvedPostUrl);

  if (usesMockEndpoint) {
    traceSteps = appendBuyerPostTraceStep(traceSteps, {
      key: "mock-buyer-endpoint",
      label: "Mock Buyer Endpoint",
      status: "info",
      summary: "Test mode is using the internal mock buyer endpoint.",
      result: skippedStepResult("Using internal mock buyer endpoint."),
    });
  }

  const buyerApiKey = buyer.apiKey?.trim() ?? "";

  const delivery = await deliverLeadToBuyer({
    integration,
    publisherLead: params.payload,
    lead: payloadWithFingerprint,
    configValues,
    campaign: buildCampaignTemplateContext({
      id: params.campaignId,
      displayId: campaign.displayId,
      name: campaign.name,
      status: campaign.status,
      campaignType: campaign.campaignType,
      timezone: campaignTimezone,
      minPrice: campaign.minPrice,
      buyerId,
      buyerLabel: buyerCompany,
      buyerApiKey,
      verticalId: campaign.verticalRef?.toString() ?? "",
      integrationId,
    }),
    minPrice: campaign.minPrice ?? 0,
    pingTreeType: params.pingTreeType,
    mockBuyerPostUrl,
    mockBuyerPostOptions: usesMockEndpoint ? campaignMockOptions : undefined,
  });

  traceSteps = [...traceSteps, ...delivery.traceSteps];
  const buyerPostedAt = new Date().toISOString();

  await createBuyerDeliveryLog({
    sellerLeadRef: params.sellerLeadId,
    campaignRef: params.campaignId,
    sellerRef: params.sellerRefId,
    verticalRef: params.verticalRefId,
    buyerRef: buyerId,
    buyerCompany,
    campaignName,
    campaignType: params.pingTreeType,
    postLeadUrl: delivery.postLeadUrl,
    publisherLead: delivery.publisherLead,
    systemLead: delivery.systemLead,
    mappedValues: delivery.mappedValues,
    buyerRequest: delivery.buyerRequest,
    requestPayload: delivery.requestPayload,
    responseBody: delivery.responseBody,
    responseHeaders: delivery.responseHeaders,
    errorMessage: delivery.errorReason || delivery.rejectReason,
    deliveryStatus: delivery.buyerStatus === "Accept" ? "success" : "fail",
    httpStatus: delivery.httpStatus,
    deliveryTrace: traceSteps,
  });

  const structuredRequestPayload = buildStructuredBuyerDeliveryPayload({
    publisherLead: delivery.publisherLead,
    systemLead: delivery.systemLead,
    mappedValues: delivery.mappedValues,
    request: delivery.buyerRequest,
  });

  await LeadDeliveryModel.create({
    sellerLeadRef: new Types.ObjectId(params.sellerLeadId),
    sellerRef: new Types.ObjectId(params.sellerRefId),
    verticalRef: new Types.ObjectId(params.verticalRefId),
    campaignRef: new Types.ObjectId(params.campaignId),
    buyerRef: new Types.ObjectId(buyerId),
    integrationRef: new Types.ObjectId(integrationId),
    pingTreeType: params.pingTreeType,
    campaignOrder: params.campaignOrder,
    buyerStatus: delivery.buyerStatus,
    price: delivery.price,
    redirectUrl: delivery.redirectUrl,
    rejectSign: delivery.rejectSign,
    rejectReason: delivery.rejectReason,
    errorReason: delivery.errorReason,
    postLeadUrl: delivery.postLeadUrl,
    requestPayload: structuredRequestPayload,
    responseBody: delivery.responseBody,
    responseHeaders: delivery.responseHeaders ?? {},
    httpStatus: delivery.httpStatus,
    deliveryTrace: traceSteps,
    responseTimeMs: delivery.responseTimeMs,
    duplicateFingerprint,
    postedAt: new Date(buyerPostedAt),
  });

  return {
    campaignId: params.campaignId,
    campaignName,
    buyerId,
    buyerCompany,
    pingTreeType: params.pingTreeType,
    campaignOrder: params.campaignOrder,
    buyerStatus: delivery.buyerStatus,
    validationErrors: [],
    price: delivery.price,
    redirectUrl: delivery.redirectUrl,
    rejectSign: delivery.rejectSign,
    rejectReason: delivery.rejectReason,
    errorReason: delivery.errorReason,
    postLeadUrl: delivery.postLeadUrl,
    httpStatus: delivery.httpStatus,
    traceSteps,
    publisherLead: delivery.publisherLead,
    systemLead: delivery.systemLead,
    mappedValues: delivery.mappedValues,
    buyerRequest: delivery.buyerRequest,
    requestPayload: delivery.requestPayload,
    responseBody: delivery.responseBody,
    responseHeaders: delivery.responseHeaders,
    campaignValidationChecks,
    campaignIntakeRuleGroups,
    campaignTimezone,
    campaignMinPrice,
    postedAt: buyerPostedAt,
    responseTimeMs: delivery.responseTimeMs,
  } satisfies CampaignDeliveryLog;
}

async function processPingTree(params: {
  pingTreeType: PingTreeCampaignType;
  sellerLeadId: string;
  sellerRefId: string;
  verticalRefId: string;
  payload: Record<string, unknown>;
  postedAt: Date;
  origin: string;
  mockBuyerPost: boolean;
  mockBuyerPostOptions?: MockBuyerPostOptions;
  stopOnAccept: boolean;
  progress?: LeadDistributionProgressHandlers;
  selectedConfig?: SelectedPingTreeConfig | null;
}) {
  const filteredCampaignIds = await resolveEligiblePingTreeCampaignIds({
    pingTreeType: params.pingTreeType,
    verticalRefId: params.verticalRefId,
    mockBuyerPost: params.mockBuyerPost,
    selectedConfig: params.selectedConfig,
  });
  if (filteredCampaignIds.length === 0) {
    return [] as CampaignDeliveryLog[];
  }

  const campaignTestMocks = await loadPingTreeCampaignTestMocks(
    params.pingTreeType,
    params.selectedConfig
  );
  const deliveries: CampaignDeliveryLog[] = [];
  const parallelPosts = params.pingTreeType === "Silent";

  if (parallelPosts) {
    if (params.progress?.onBuyerPostProcessing) {
      await Promise.all(
        filteredCampaignIds.map((campaignId, index) =>
          params.progress!.onBuyerPostProcessing!({
            campaignId,
            pingTreeType: params.pingTreeType,
            campaignOrder: index + 1,
          })
        )
      );
    }

    const results = await Promise.all(
      filteredCampaignIds.map((campaignId, index) =>
        processCampaignAttempt({
          campaignId,
          campaignOrder: index + 1,
          pingTreeType: params.pingTreeType,
          sellerLeadId: params.sellerLeadId,
          sellerRefId: params.sellerRefId,
          verticalRefId: params.verticalRefId,
          payload: params.payload,
          postedAt: params.postedAt,
          origin: params.origin,
          mockBuyerPost: params.mockBuyerPost,
          mockBuyerPostOptions: params.mockBuyerPostOptions,
          campaignTestMocks,
        })
      )
    );

    for (const result of results) {
      if (!result) continue;
      deliveries.push(result);

      if (params.progress?.onBuyerPostAttempt) {
        const attempts = buildDeliveryProgressAttempts(result);
        for (const attempt of attempts) {
          await params.progress.onBuyerPostAttempt(attempt);
        }
      }
    }

    return deliveries;
  }

  for (let index = 0; index < filteredCampaignIds.length; index += 1) {
    const campaignId = filteredCampaignIds[index];

    if (params.progress?.onBuyerPostProcessing) {
      await params.progress.onBuyerPostProcessing({
        campaignId,
        pingTreeType: params.pingTreeType,
        campaignOrder: index + 1,
      });
    }

    const result = await processCampaignAttempt({
      campaignId,
      campaignOrder: index + 1,
      pingTreeType: params.pingTreeType,
      sellerLeadId: params.sellerLeadId,
      sellerRefId: params.sellerRefId,
      verticalRefId: params.verticalRefId,
      payload: params.payload,
      postedAt: params.postedAt,
      origin: params.origin,
      mockBuyerPost: params.mockBuyerPost,
      mockBuyerPostOptions: params.mockBuyerPostOptions,
      campaignTestMocks,
    });

    if (!result) continue;
    deliveries.push(result);

    if (params.progress?.onBuyerPostAttempt) {
      const attempts = buildDeliveryProgressAttempts(result);
      for (const attempt of attempts) {
        await params.progress.onBuyerPostAttempt(attempt);
      }
    }

    if (params.stopOnAccept && result.buyerStatus === "Accept") {
      break;
    }
  }

  return deliveries;
}

function buildDeliveryProgressAttempts(delivery: CampaignDeliveryLog): BuyerPostAttemptSnapshot[] {
  const attempts = buildBuyerPostAttemptsFromDeliveries([delivery]);
  if (attempts.length > 0) {
    return attempts;
  }

  const validationErrors =
    delivery.validationErrors.length > 0
      ? delivery.validationErrors
      : delivery.errorReason
        ? [delivery.errorReason]
        : [];

  if (validationErrors.length > 0) {
    return [
      buildCampaignValidationFailedAttemptSnapshot({
        campaignId: delivery.campaignId,
        campaignName: delivery.campaignName,
        buyerId: delivery.buyerId,
        buyerCompany: delivery.buyerCompany,
        campaignValidationChecks: delivery.campaignValidationChecks ?? [],
        campaignIntakeRuleGroups: delivery.campaignIntakeRuleGroups ?? [],
        campaignTimezone: delivery.campaignTimezone ?? "",
        validationErrors,
        pingTreeType: delivery.pingTreeType,
        campaignOrder: delivery.campaignOrder,
        postedAt: delivery.postedAt,
      }),
    ];
  }

  if (!delivery.campaignId) {
    return [];
  }

  return [
    buildBuyerPostAttemptSnapshot({
      campaignId: delivery.campaignId,
      campaignName: delivery.campaignName,
      buyerId: delivery.buyerId,
      buyerCompany: delivery.buyerCompany,
      buyerStatus: delivery.buyerStatus,
      publisherLead: delivery.publisherLead ?? {},
      systemLead: delivery.systemLead ?? {},
      mappedValues: delivery.mappedValues ?? {},
      requestMappingData:
        delivery.requestPayload && typeof delivery.requestPayload === "object" && !Array.isArray(delivery.requestPayload)
          ? (delivery.requestPayload as Record<string, unknown>)
          : (delivery.buyerRequest?.body ?? {}),
      campaignValidationChecks: delivery.campaignValidationChecks ?? [],
      campaignIntakeRuleGroups: delivery.campaignIntakeRuleGroups ?? [],
      campaignTimezone: delivery.campaignTimezone ?? "",
      pingTreeType: delivery.pingTreeType,
      campaignOrder: delivery.campaignOrder,
      postedAt: delivery.postedAt,
      request:
        delivery.buyerRequest ??
        buildBuyerHttpRequestSnapshot({
          url: delivery.postLeadUrl,
          method: "POST",
          headers: {},
          body: {},
        }),
        httpStatus: delivery.httpStatus,
        responseBody: delivery.responseBody ?? "",
        responseHeaders: delivery.responseHeaders,
        price: delivery.price,
      redirectUrl: delivery.redirectUrl,
      rejectReason: delivery.rejectReason,
      errorReason: delivery.errorReason,
    }),
  ];
}

function buildBuyerPostAttemptsFromDeliveries(deliveries: CampaignDeliveryLog[]): BuyerPostAttemptSnapshot[] {
  const attempts = deliveries.flatMap((delivery) => {
    const campaignValidationChecks = delivery.campaignValidationChecks ?? [];
    const validationFailed =
      delivery.buyerStatus === "Skipped" &&
      campaignValidationChecks.length > 0 &&
      delivery.validationErrors.length > 0;

    if (validationFailed) {
      return [
        buildCampaignValidationFailedAttemptSnapshot({
          campaignId: delivery.campaignId,
          campaignName: delivery.campaignName,
          buyerId: delivery.buyerId,
          buyerCompany: delivery.buyerCompany,
          campaignValidationChecks,
          campaignIntakeRuleGroups: delivery.campaignIntakeRuleGroups ?? [],
          campaignTimezone: delivery.campaignTimezone ?? "",
          validationErrors: delivery.validationErrors,
          pingTreeType: delivery.pingTreeType,
          campaignOrder: delivery.campaignOrder,
          postedAt: delivery.postedAt,
        }),
      ];
    }

    if (!delivery.buyerRequest || !delivery.publisherLead || !delivery.systemLead) {
      const validationErrors =
        delivery.validationErrors.length > 0
          ? delivery.validationErrors
          : delivery.errorReason
            ? [delivery.errorReason]
            : [];

      if (validationErrors.length === 0) {
        return [];
      }

      return [
        buildCampaignValidationFailedAttemptSnapshot({
          campaignId: delivery.campaignId,
          campaignName: delivery.campaignName,
          buyerId: delivery.buyerId,
          buyerCompany: delivery.buyerCompany,
          campaignValidationChecks: delivery.campaignValidationChecks ?? [],
          campaignIntakeRuleGroups: delivery.campaignIntakeRuleGroups ?? [],
          campaignTimezone: delivery.campaignTimezone ?? "",
          validationErrors,
          pingTreeType: delivery.pingTreeType,
          campaignOrder: delivery.campaignOrder,
          postedAt: delivery.postedAt,
        }),
      ];
    }

    return [
      buildBuyerPostAttemptSnapshot({
        campaignId: delivery.campaignId,
        campaignName: delivery.campaignName,
        buyerId: delivery.buyerId,
        buyerCompany: delivery.buyerCompany,
        buyerStatus: delivery.buyerStatus,
        publisherLead: delivery.publisherLead,
        systemLead: delivery.systemLead,
        mappedValues: delivery.mappedValues ?? {},
        requestMappingData:
          delivery.requestPayload && typeof delivery.requestPayload === "object" && !Array.isArray(delivery.requestPayload)
            ? (delivery.requestPayload as Record<string, unknown>)
            : delivery.buyerRequest.body,
        request: delivery.buyerRequest,
        httpStatus: delivery.httpStatus,
        responseBody: delivery.responseBody ?? "",
        campaignValidationChecks,
        campaignIntakeRuleGroups: delivery.campaignIntakeRuleGroups ?? [],
        campaignTimezone: delivery.campaignTimezone ?? "",
        pingTreeType: delivery.pingTreeType,
        campaignOrder: delivery.campaignOrder,
        postedAt: delivery.postedAt,
        price: delivery.price,
        redirectUrl: delivery.redirectUrl,
        rejectReason: delivery.rejectReason,
        errorReason: delivery.errorReason,
      }),
    ];
  });

  return sortBuyerPostAttemptViews(attempts) as BuyerPostAttemptSnapshot[];
}

export type LeadDistributionProgressHandlers = {
  onBuyerPostProcessing?: (info: {
    campaignId: string;
    pingTreeType: PingTreeCampaignType;
    campaignOrder: number;
  }) => void | Promise<void>;
  onBuyerPostAttempt?: (attempt: BuyerPostAttemptSnapshot) => void | Promise<void>;
};

export type { PendingBuyerPostCampaign };

export async function listPendingBuyerPostCampaigns(
  verticalRefId: string,
  mockBuyerPost = true,
  publisherApiType: MappingApiType = "Redirect"
): Promise<PendingBuyerPostCampaign[]> {
  await ensureDefaultPingTrees();
  const pending: PendingBuyerPostCampaign[] = [];

  for (const pingTreeType of resolvePublisherPingTreeTypes(publisherApiType)) {
    const orderedCampaignIds = await resolveEligiblePingTreeCampaignIds({
      pingTreeType,
      verticalRefId,
      mockBuyerPost,
    });

    if (orderedCampaignIds.length === 0) continue;

    const campaigns = await CampaignModel.find({
      _id: { $in: orderedCampaignIds.map((campaignId) => new Types.ObjectId(campaignId)) },
      status: "Active",
      campaignType: pingTreeType,
    })
      .select({ name: 1, buyerRef: 1, status: 1 })
      .lean();

    const campaignById = new Map(campaigns.map((campaign) => [campaign._id?.toString() ?? "", campaign]));
    const buyerIds = campaigns
      .map((campaign) => campaign.buyerRef?.toString() ?? "")
      .filter((buyerId) => buyerId && Types.ObjectId.isValid(buyerId));

    const buyers = buyerIds.length
      ? await BuyerModel.find({ _id: { $in: buyerIds.map((buyerId) => new Types.ObjectId(buyerId)) } })
          .select({ company: 1 })
          .lean()
      : [];

    const buyerCompanyById = new Map(
      buyers.map((buyer) => [buyer._id?.toString() ?? "", buyer.company?.trim() || "Buyer"])
    );

    orderedCampaignIds.forEach((campaignId, index) => {
      const campaign = campaignById.get(campaignId);
      if (!campaign) return;

      const buyerId = campaign.buyerRef?.toString() ?? "";
      pending.push({
        campaignId,
        campaignName: campaign.name?.trim() || "Campaign",
        buyerId,
        buyerCompany: buyerCompanyById.get(buyerId) ?? "Buyer",
        pingTreeType,
        campaignOrder: index + 1,
        queueOrder: pending.length,
        logId: buildBuyerPostAttemptLogId(pingTreeType, index + 1),
      });
    });
  }

  return pending;
}
export async function distributeLeadAfterIntake(params: {
  sellerLeadId: string;
  sellerRefId: string;
  verticalRefId: string;
  mappingRefId?: string | null;
  payload: Record<string, unknown>;
  postedAt: Date;
  origin: string;
  postToBuyer?: boolean;
  mockBuyerPost?: boolean;
  mockBuyerPostOptions?: MockBuyerPostOptions;
  revShareSettings?: MappingRevShareSettingsRecord;
  progress?: LeadDistributionProgressHandlers;
  publisherApiType?: MappingApiType;
}): Promise<LeadDistributionResult> {
  const isTestLead = isTestLeadPayload(params.payload);
  const publisherApiType = params.publisherApiType ?? "Redirect";
  if (isTestLead && !params.postToBuyer) {
    await SellerLeadModel.updateOne(
      { _id: new Types.ObjectId(params.sellerLeadId) },
      { $set: { publisherStatus: "Test", isTestLead: true } }
    );

    return {
      publisherStatus: "Test",
      redirectUrl: "",
      soldPrice: null,
      publisherResponsePrice: null,
      campaignDeliveries: [],
      buyerPostAttempts: [],
      message: "Test lead received. Lead was not posted to buyers.",
    };
  }

  const pingTreeTypes = resolvePublisherPingTreeTypes(publisherApiType);

  // Pick the weighted PingTreeConfig for each bucket exactly once per lead.
  // Publisher distribution overrides global % when configured; otherwise global
  // Ping Tree Settings apply. Test/mock leads pick without counting.
  const shouldCountAllocation = !isTestLead && !Boolean(params.mockBuyerPost);
  const selectedConfigByType = new Map<PingTreeCampaignType, SelectedPingTreeConfig | null>();
  for (const pingTreeType of pingTreeTypes) {
    const selected = await selectPingTreeConfig({
      verticalRefId: params.verticalRefId,
      processingType: mapPingTreeTypeToProcessingType(pingTreeType),
      count: shouldCountAllocation,
      sellerRefId: params.sellerRefId,
      mappingRefId: params.mappingRefId ?? null,
    });
    selectedConfigByType.set(pingTreeType, selected);
  }

  if (publisherApiType === "Silent") {
    const silentCampaignIds = await resolveEligiblePingTreeCampaignIds({
      pingTreeType: "Silent",
      verticalRefId: params.verticalRefId,
      mockBuyerPost: Boolean(params.mockBuyerPost),
      selectedConfig: selectedConfigByType.get("Silent") ?? null,
    });

    if (silentCampaignIds.length === 0) {
      await SellerLeadModel.updateOne(
        { _id: new Types.ObjectId(params.sellerLeadId) },
        { $set: { publisherStatus: "Reject", isTestLead } }
      );

      return {
        publisherStatus: "Reject",
        redirectUrl: "",
        soldPrice: null,
        publisherResponsePrice: null,
        campaignDeliveries: [],
        buyerPostAttempts: [],
        buyerPostHint: SILENT_API_NO_BUYER_MESSAGE,
        message: SILENT_API_NO_BUYER_MESSAGE,
      };
    }
  }

  const deliveryResults = await Promise.all(
    pingTreeTypes.map((pingTreeType) =>
      processPingTree({
        pingTreeType,
        sellerLeadId: params.sellerLeadId,
        sellerRefId: params.sellerRefId,
        verticalRefId: params.verticalRefId,
        payload: params.payload,
        postedAt: params.postedAt,
        origin: params.origin,
        mockBuyerPost: Boolean(params.mockBuyerPost),
        mockBuyerPostOptions: params.mockBuyerPostOptions,
        stopOnAccept: pingTreeType === "Redirect",
        progress: params.progress,
        selectedConfig: selectedConfigByType.get(pingTreeType) ?? null,
      })
    )
  );

  const coreDeliveries = deliveryResults.flat();

  const accepted = findAcceptedDelivery(coreDeliveries);
  const hadPostError = resolvePublisherPostError(coreDeliveries);
  const publisherStatus = toPublisherStatus(coreDeliveries, hadPostError);

  const redirectUrl = resolveBuyerRedirectUrl(
    accepted?.redirectUrl ?? "",
    accepted?.buyerStatus === "Accept"
  );
  const buyerPrice = resolvePublisherBuyerPrice(coreDeliveries, accepted);
  const revShareSettings = params.revShareSettings ?? defaultMappingRevShareSettings();
  const soldPrice = resolvePublisherPriceFromRevShare(buyerPrice, revShareSettings);
  const publisherResponsePrice = shouldExposePublisherResponsePrice(coreDeliveries, accepted)
    ? soldPrice
    : null;

  const pingTreeAllocations = Array.from(selectedConfigByType.entries())
    .filter((entry): entry is [PingTreeCampaignType, SelectedPingTreeConfig] => entry[1] !== null)
    .map(([pingTreeType, config]) => ({
      pingTreeType,
      configId: config.id,
      configName: config.name,
      displayId: config.displayId,
    }));

  await SellerLeadModel.updateOne(
    { _id: new Types.ObjectId(params.sellerLeadId) },
    {
      $set: {
        publisherStatus,
        isTestLead,
        redirectUrl,
        soldPrice,
        pingTreeAllocations,
      },
    }
  );

  let buyerPostAttempts = buildBuyerPostAttemptsFromDeliveries(coreDeliveries);

  const fallbackDelivery =
    buyerPostAttempts.length === 0 && params.mockBuyerPost
      ? await buildFallbackTestLeadBuyerDelivery({
          verticalRefId: params.verticalRefId,
          payload: params.payload,
          postedAt: params.postedAt,
          origin: params.origin,
          sellerLeadId: params.sellerLeadId,
          sellerRefId: params.sellerRefId,
          mockBuyerPostOptions: params.mockBuyerPostOptions,
          publisherApiType,
        })
      : null;

  const allDeliveries = fallbackDelivery ? [...coreDeliveries, fallbackDelivery] : coreDeliveries;

  if (fallbackDelivery) {
    buyerPostAttempts = buildBuyerPostAttemptsFromDeliveries([fallbackDelivery]);
  }

  const buyerPostHint =
    buyerPostAttempts.length === 0
      ? allDeliveries.find((delivery) => delivery.validationErrors.length > 0)?.errorReason ||
        allDeliveries[0]?.errorReason ||
        "No buyer request was built. Add the campaign to the Ping Tree, configure Integration on the campaign, and ensure the buyer is Active."
      : "";

  const firstPostError = hasRedirectDeliveries(coreDeliveries)
    ? coreDeliveries.find(
        (entry) =>
          entry.pingTreeType === "Redirect" &&
          (entry.buyerStatus === "Error" || entry.buyerStatus === "Timeout")
      )
    : coreDeliveries.find((entry) => entry.buyerStatus === "Error" || entry.buyerStatus === "Timeout");

  return {
    publisherStatus,
    redirectUrl,
    soldPrice,
    publisherResponsePrice,
    campaignDeliveries: allDeliveries,
    buyerPostAttempts,
    buyerPostHint,
    message:
      publisherStatus === "Sold"
        ? "Lead sold to buyer."
        : publisherStatus === "Post Error"
          ? firstPostError?.errorReason?.trim() || "Buyer post failed."
          : publisherStatus === "Test"
            ? "Test lead was not posted to buyers."
            : buildPublisherRejectMessage(coreDeliveries),
  };
}
