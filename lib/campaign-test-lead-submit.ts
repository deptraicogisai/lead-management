import { Types } from "mongoose";
import { deliverLeadToBuyer } from "@/lib/buyer-delivery";
import { buildBuyerHttpRequestSnapshot } from "@/lib/buyer-post-request";
import { buildCampaignLookupContext } from "@/lib/campaign-context";
import { normalizeCampaignIntegrationConfigValues } from "@/lib/campaign-integration-config";
import { appendCampaignTestLeadLog, type CampaignTestLeadLogRecord } from "@/lib/campaign-test-lead-log";
import { toIntegrationBuilderRecord } from "@/lib/integration-builder";
import { CampaignModel } from "@/lib/models/campaign";
import { IntegrationBuilderModel } from "@/lib/models/integration-builder";
import { connectToDatabase } from "@/lib/mongodb";

export type CampaignTestLeadSubmitResult =
  | {
      ok: true;
      log: CampaignTestLeadLogRecord;
    }
  | {
      ok: false;
      message: string;
      log?: CampaignTestLeadLogRecord;
    };

function resolveStatusCode(parsed: {
  rejectSign: string;
  soldSign: string;
  errorReason: string;
}) {
  if (parsed.rejectSign.trim()) {
    return parsed.rejectSign.trim();
  }

  if (parsed.soldSign.trim()) {
    return parsed.soldSign.trim();
  }

  return "";
}

function resolveMessage(
  buyerStatus: string,
  parsed: { rejectReason: string; errorReason: string }
) {
  const normalized = buyerStatus.trim().toLowerCase();

  if (normalized === "error" || normalized === "timeout") {
    return parsed.errorReason.trim() || parsed.rejectReason.trim();
  }

  if (normalized === "reject" || normalized === "price reject" || normalized === "price conflict") {
    return parsed.rejectReason.trim();
  }

  return parsed.rejectReason.trim() || parsed.errorReason.trim();
}

export async function runCampaignTestLeadSubmit(params: {
  campaignId: string;
  payload: Record<string, unknown>;
}): Promise<CampaignTestLeadSubmitResult> {
  if (!Types.ObjectId.isValid(params.campaignId)) {
    return { ok: false, message: "Invalid campaign id." };
  }

  await connectToDatabase();

  const campaign = await CampaignModel.findById(params.campaignId).lean();
  if (!campaign) {
    return { ok: false, message: "Campaign not found." };
  }

  const integrationId = campaign.integrationRef?.toString() ?? "";
  if (!integrationId) {
    return { ok: false, message: "Integration is not configured on this campaign." };
  }

  const integrationDoc = await IntegrationBuilderModel.findById(integrationId).lean();
  if (!integrationDoc) {
    return { ok: false, message: "Integration builder record not found." };
  }

  const lookup = await buildCampaignLookupContext();
  const integration = toIntegrationBuilderRecord(
    integrationDoc as Parameters<typeof toIntegrationBuilderRecord>[0],
    lookup.verticalNameById,
    lookup.verticalIndexById
  );

  const configValues = normalizeCampaignIntegrationConfigValues(campaign.integrationSettings);
  const campaignContext = {
    id: params.campaignId,
    name: campaign.name,
    campaignType: campaign.campaignType,
    minPrice: campaign.minPrice,
    timezone: campaign.timezone,
  };

  const startedAt = Date.now();

  try {
    const delivery = await deliverLeadToBuyer({
      integration,
      publisherLead: params.payload,
      lead: params.payload,
      configValues,
      campaign: campaignContext,
      minPrice: campaign.minPrice ?? 0,
      pingTreeType: campaign.campaignType === "Silent" ? "Silent" : "Redirect",
    });

    const processingTimeSeconds = Number(((Date.now() - startedAt) / 1000).toFixed(2));
    const buyerResponse = {
      httpStatus: delivery.httpStatus,
      headers: delivery.responseHeaders,
      body: delivery.responseBody,
    };

    const log = await appendCampaignTestLeadLog({
      campaignId: params.campaignId,
      leadData: params.payload,
      buyerRequest: delivery.buyerRequest,
      buyerResponse,
      buyerStatus: delivery.buyerStatus,
      statusCode: resolveStatusCode(delivery.parsed),
      message: resolveMessage(delivery.buyerStatus, delivery.parsed),
      price: delivery.price,
      processingTimeSeconds,
      errorReason: delivery.errorReason,
    });

    return { ok: true, log };
  } catch (error) {
    const processingTimeSeconds = Number(((Date.now() - startedAt) / 1000).toFixed(2));
    const message = error instanceof Error ? error.message : "Failed to post test lead to buyer.";
    const log = await appendCampaignTestLeadLog({
      campaignId: params.campaignId,
      leadData: params.payload,
      buyerRequest: buildBuyerHttpRequestSnapshot({
        url: configValues.url ?? "",
        method: "POST",
        headers: {},
        body: {},
      }),
      buyerResponse: {
        httpStatus: 0,
        headers: {},
        body: "",
      },
      buyerStatus: "Error",
      statusCode: "",
      message,
      price: null,
      processingTimeSeconds,
      errorReason: message,
    });

    return { ok: false, message, log };
  }
}
