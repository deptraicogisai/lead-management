import { Types } from "mongoose";
import {
  resolveBuyerMockPingUrl,
  resolveBuyerMockPostUrl,
  isBuyerLeadMockEndpoint,
} from "@/lib/buyer-lead-api";
import { createBuyerDeliveryLog, deliverLeadToBuyer } from "@/lib/buyer-delivery";
import {
  buildStructuredBuyerDeliveryPayload,
} from "@/lib/buyer-post-request";
import {
  appendBuyerPostTraceStep,
  skippedStepResult,
  successStepResult,
  type BuyerPostTraceStep,
} from "@/lib/buyer-post-trace";
import { normalizeCampaignIntegrationConfigValues } from "@/lib/campaign-integration-config";
import { buildCampaignTemplateContext } from "@/lib/campaign-template";
import { toIntegrationBuilderRecord, buildVerticalIndexMap } from "@/lib/integration-builder";
import { shouldApplyPublisherPayout } from "@/lib/lead-price";
import {
  defaultMappingRevShareSettings,
  resolvePublisherPriceFromRevShare,
  type MappingRevShareSettingsRecord,
} from "@/lib/mapping-rev-share-settings";
import type { MappingApiType } from "@/lib/mapping-api-type";
import type { MockBuyerPostOptions } from "@/lib/mock-buyer-post";
import {
  campaignTestMockToPingMockBuyerPostOptions,
  mergeMockBuyerPostOptions,
  type CampaignTestMockResponse,
} from "@/lib/campaign-test-mock";
import { BuyerModel } from "@/lib/models/buyer";
import { CampaignModel } from "@/lib/models/campaign";
import { IntegrationBuilderModel } from "@/lib/models/integration-builder";
import { LeadDeliveryModel } from "@/lib/models/lead-delivery";
import { ensureDefaultPingTrees, PingTreeModel } from "@/lib/models/ping-tree";
import { PingTreeConfigModel } from "@/lib/models/ping-tree-config";
import { SellerLeadModel } from "@/lib/models/seller-lead";
import { VerticalModel } from "@/lib/models/industry";
import { connectToDatabase } from "@/lib/mongodb";
import { resolveCampaignTimezone } from "@/lib/timezones";

export const DELAYED_SILENT_POST_KIND = "delayed_silent_post" as const;

export type DelayedSilentPostContext = {
  kind: typeof DELAYED_SILENT_POST_KIND;
  origin: string;
  mockBuyerPost: boolean;
  mockBuyerPostOptions?: MockBuyerPostOptions;
  campaignTestMocks?: Record<string, CampaignTestMockResponse>;
  revShareSettings?: MappingRevShareSettingsRecord;
  publisherApiType?: MappingApiType;
};

export function isDelayedSilentPostContext(value: unknown): value is DelayedSilentPostContext {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.kind === DELAYED_SILENT_POST_KIND && typeof record.origin === "string";
}

export function buildDelayedSilentPostRequestPayload(
  context: DelayedSilentPostContext
): Record<string, unknown> {
  return { __delayScheduling: context };
}

export function readDelayedSilentPostContext(
  requestPayload: unknown
): DelayedSilentPostContext | null {
  if (!requestPayload || typeof requestPayload !== "object" || Array.isArray(requestPayload)) {
    return null;
  }
  const nested = (requestPayload as Record<string, unknown>).__delayScheduling;
  return isDelayedSilentPostContext(nested) ? nested : null;
}

export async function cancelPendingDelayedSilentPosts(
  campaignId: string,
  reason: string
): Promise<number> {
  if (!Types.ObjectId.isValid(campaignId)) return 0;

  const result = await LeadDeliveryModel.updateMany(
    {
      campaignRef: new Types.ObjectId(campaignId),
      buyerStatus: "Delay Posting",
    },
    {
      $set: {
        buyerStatus: "Skipped",
        errorReason: reason,
      },
    }
  );

  return result.modifiedCount ?? 0;
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

async function isCampaignEligibleForSilentPost(
  campaignId: string,
  verticalRefId: string
): Promise<boolean> {
  const configFilter: Record<string, unknown> = {
    processingType: "Silent",
    status: "Active",
    activeCampaignIds: campaignId,
  };
  if (Types.ObjectId.isValid(verticalRefId)) {
    configFilter.verticalRef = new Types.ObjectId(verticalRefId);
  }

  const inConfig = await PingTreeConfigModel.findOne(configFilter).select({ _id: 1 }).lean();
  if (inConfig) return true;

  await ensureDefaultPingTrees();
  const tree = await PingTreeModel.findOne({ campaignType: "Silent" })
    .select({ activeCampaignIds: 1 })
    .lean();
  return (tree?.activeCampaignIds ?? []).includes(campaignId);
}

async function skipDelayedDelivery(
  deliveryId: Types.ObjectId,
  reason: string,
  traceSteps: BuyerPostTraceStep[]
) {
  const nextTrace = appendBuyerPostTraceStep(traceSteps, {
    key: "delay-scheduling-skip",
    label: "Delay Scheduling",
    status: "skip",
    summary: reason,
    result: skippedStepResult(reason),
  });

  await LeadDeliveryModel.updateOne(
    { _id: deliveryId, buyerStatus: "Delay Posting" },
    {
      $set: {
        buyerStatus: "Skipped",
        errorReason: reason,
        deliveryTrace: nextTrace,
      },
    }
  );
}

async function processOneDelayedDelivery(deliveryId: string): Promise<"posted" | "skipped" | "error"> {
  const claimed = await LeadDeliveryModel.findOneAndUpdate(
    { _id: new Types.ObjectId(deliveryId), buyerStatus: "Delay Posting" },
    { $set: { errorReason: "Processing delayed Silent post..." } },
    { new: true }
  ).lean();

  if (!claimed) return "skipped";

  const campaignId = claimed.campaignRef?.toString() ?? "";
  const sellerLeadId = claimed.sellerLeadRef?.toString() ?? "";
  const buyerId = claimed.buyerRef?.toString() ?? "";
  const existingTrace = Array.isArray(claimed.deliveryTrace)
    ? (claimed.deliveryTrace as BuyerPostTraceStep[])
    : [];
  const delayContext = readDelayedSilentPostContext(claimed.requestPayload) ?? {
    kind: DELAYED_SILENT_POST_KIND,
    origin: "",
    mockBuyerPost: false,
  };

  try {
    const campaign = await CampaignModel.findById(campaignId).lean();
    if (!campaign || campaign.status !== "Active") {
      await skipDelayedDelivery(
        claimed._id,
        !campaign
          ? "Campaign not found — delayed post cancelled."
          : `Campaign is "${campaign.status}" — delayed post cancelled.`,
        existingTrace
      );
      return "skipped";
    }

    if (campaign.campaignType !== "Silent") {
      await skipDelayedDelivery(
        claimed._id,
        "Campaign is no longer Silent — delayed post cancelled.",
        existingTrace
      );
      return "skipped";
    }

    if (
      !(await isCampaignEligibleForSilentPost(
        campaignId,
        campaign.verticalRef?.toString() ?? claimed.verticalRef?.toString() ?? ""
      ))
    ) {
      await skipDelayedDelivery(
        claimed._id,
        "Campaign left Silent Ping Tree — delayed post cancelled.",
        existingTrace
      );
      return "skipped";
    }

    const sellerLead = await SellerLeadModel.findById(sellerLeadId).lean();
    if (!sellerLead) {
      await skipDelayedDelivery(claimed._id, "Seller lead not found — delayed post cancelled.", existingTrace);
      return "skipped";
    }

    const buyer = await BuyerModel.findById(buyerId || campaign.buyerRef).lean();
    if (!buyer || buyer.status !== "Active") {
      await skipDelayedDelivery(
        claimed._id,
        !buyer ? "Buyer not found — delayed post cancelled." : `Buyer is "${buyer.status}" — delayed post cancelled.`,
        existingTrace
      );
      return "skipped";
    }

    const integrationId = campaign.integrationRef?.toString() ?? "";
    if (!integrationId) {
      await skipDelayedDelivery(claimed._id, "Campaign integration is not configured.", existingTrace);
      return "skipped";
    }

    const integration = await loadIntegrationRecord(integrationId);
    if (!integration || integration.status !== "Active") {
      await skipDelayedDelivery(
        claimed._id,
        !integration
          ? "Integration builder record not found."
          : `Integration "${integration.name}" is "${integration.status}".`,
        existingTrace
      );
      return "skipped";
    }

    const payload =
      sellerLead.payload && typeof sellerLead.payload === "object" && !Array.isArray(sellerLead.payload)
        ? ({ ...(sellerLead.payload as Record<string, unknown>) } as Record<string, unknown>)
        : {};

    const origin = delayContext.origin?.trim() || "";
    const mockBuyerPost = Boolean(delayContext.mockBuyerPost);
    const buyerCompany = buyer.company?.trim() || "Buyer";
    const campaignName = campaign.name?.trim() || "Campaign";
    const campaignTimezone = resolveCampaignTimezone(campaign.timezone);
    const configValues = normalizeCampaignIntegrationConfigValues(campaign.integrationSettings);

    const mockBuyerPostUrl = mockBuyerPost ? resolveBuyerMockPostUrl(buyer, origin, buyerId) : undefined;
    const mockBuyerPingUrl = mockBuyerPost ? resolveBuyerMockPingUrl(buyer, origin) : undefined;
    const campaignMock = delayContext.campaignTestMocks?.[campaignId] ?? null;
    const campaignMockOptions = mergeMockBuyerPostOptions(delayContext.mockBuyerPostOptions, campaignMock);
    const campaignPingMockOptions = campaignTestMockToPingMockBuyerPostOptions(campaignMock);
    const resolvedPostUrl =
      mockBuyerPostUrl?.trim() ||
      configValues.url?.trim() ||
      configValues.post_url?.trim() ||
      buyer.postLeadUrl?.trim() ||
      "";
    const usesMockEndpoint =
      mockBuyerPost &&
      (Boolean(mockBuyerPostUrl) || Boolean(mockBuyerPingUrl) || isBuyerLeadMockEndpoint(resolvedPostUrl));

    let traceSteps = appendBuyerPostTraceStep(existingTrace, {
      key: "delay-scheduling-due",
      label: "Delay Scheduling",
      status: "pass",
      summary: "Scheduled Silent delay elapsed — posting to buyer now.",
      result: successStepResult("Scheduled Silent delay elapsed — posting to buyer now."),
    });

    const delivery = await deliverLeadToBuyer({
      integration,
      publisherLead: payload,
      lead: payload,
      configValues,
      campaign: buildCampaignTemplateContext({
        id: campaignId,
        displayId: campaign.displayId,
        name: campaign.name,
        status: campaign.status,
        campaignType: campaign.campaignType,
        timezone: campaignTimezone,
        minPrice: campaign.minPrice,
        buyerId: buyer._id?.toString() ?? buyerId,
        buyerLabel: buyerCompany,
        buyerApiKey: buyer.apiKey?.trim() ?? "",
        verticalId: campaign.verticalRef?.toString() ?? "",
        integrationId,
      }),
      minPrice: campaign.minPrice ?? 0,
      pingTreeType: "Silent",
      mockBuyerPostUrl,
      mockBuyerPingUrl: usesMockEndpoint ? mockBuyerPingUrl : undefined,
      mockBuyerPostOptions: usesMockEndpoint ? campaignMockOptions : undefined,
      mockBuyerPingOptions: usesMockEndpoint ? campaignPingMockOptions : undefined,
    });

    traceSteps = [...traceSteps, ...delivery.traceSteps];
    const publisherApiType = delayContext.publisherApiType ?? "Redirect";
    const revShareSettings = delayContext.revShareSettings ?? defaultMappingRevShareSettings();
    const publisherPayout =
      delivery.buyerStatus === "Accept"
        ? shouldApplyPublisherPayout("Silent", publisherApiType)
          ? resolvePublisherPriceFromRevShare(delivery.price, revShareSettings)
          : 0
        : null;

    await createBuyerDeliveryLog({
      sellerLeadRef: sellerLeadId,
      campaignRef: campaignId,
      sellerRef: claimed.sellerRef?.toString() ?? sellerLead.sellerRef?.toString() ?? "",
      verticalRef: claimed.verticalRef?.toString() ?? sellerLead.verticalRef?.toString() ?? "",
      buyerRef: buyer._id?.toString() ?? buyerId,
      buyerCompany,
      campaignName,
      campaignType: "Silent",
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

    // Keep original postedAt (intake / Delay Posting date) — only status and post result change.
    await LeadDeliveryModel.updateOne(
      { _id: claimed._id, buyerStatus: "Delay Posting" },
      {
        $set: {
          buyerStatus: delivery.buyerStatus,
          price: delivery.price,
          publisherPayout,
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
          integrationRef: new Types.ObjectId(integrationId),
          scheduledPostAt: claimed.scheduledPostAt ?? null,
        },
      }
    );

    return "posted";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delayed Silent post failed.";
    const nextTrace = appendBuyerPostTraceStep(existingTrace, {
      key: "delay-scheduling-error",
      label: "Delay Scheduling",
      status: "fail",
      summary: message,
      result: skippedStepResult(message),
    });

    await LeadDeliveryModel.updateOne(
      { _id: claimed._id, buyerStatus: "Delay Posting" },
      {
        $set: {
          buyerStatus: "Error",
          errorReason: message,
          deliveryTrace: nextTrace,
        },
      }
    );
    return "error";
  }
}

export async function processDueDelayedSilentPosts(limit = 25): Promise<{
  processed: number;
  skipped: number;
  errors: number;
}> {
  await connectToDatabase();

  const due = await LeadDeliveryModel.find({
    buyerStatus: "Delay Posting",
    scheduledPostAt: { $lte: new Date() },
  })
    .sort({ scheduledPostAt: 1 })
    .select({ _id: 1 })
    .limit(Math.max(1, Math.min(limit, 100)))
    .lean();

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of due) {
    const result = await processOneDelayedDelivery(row._id.toString());
    if (result === "posted") processed += 1;
    else if (result === "skipped") skipped += 1;
    else errors += 1;
  }

  return { processed, skipped, errors };
}
