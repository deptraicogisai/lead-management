import type { PingTreeCampaignType } from "@/lib/ping-tree";
import type { ParsedBuyerResponse } from "@/lib/integration-runtime";

export type CampaignPriceMode = "Redirect" | "Silent";

function normalizePrice(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }
  return Math.round(value * 100) / 100;
}

export function toCampaignPriceMode(campaignType: unknown): CampaignPriceMode {
  return campaignType === "Silent" ? "Silent" : "Redirect";
}

export function resolveDeliveryPriceMode(params: {
  pingTreeType?: unknown;
  campaignType?: unknown;
}): CampaignPriceMode {
  if (params.pingTreeType === "Redirect" || params.pingTreeType === "Silent") {
    return toCampaignPriceMode(params.pingTreeType);
  }

  return toCampaignPriceMode(params.campaignType);
}

export function resolveAcceptedBuyerPrice(
  parsed: ParsedBuyerResponse,
  minPrice: number,
  campaignType: CampaignPriceMode
): number | null {
  const campaignPrice = normalizePrice(minPrice) ?? 0;

  if (campaignType === "Silent") {
    // Silent campaigns use the campaign min price as the exact purchase price.
    // Buyer response does not need to include a price.
    return campaignPrice;
  }

  const buyerReturnedPrice = normalizePrice(parsed.soldPrice);

  if (buyerReturnedPrice !== null) {
    return buyerReturnedPrice;
  }

  return campaignPrice;
}

type DeliveryPriceSource = {
  pingTreeType: PingTreeCampaignType;
  buyerStatus: string;
  price: number | null;
  campaignMinPrice?: number;
};

export function resolvePublisherBuyerPrice(
  _deliveries: DeliveryPriceSource[],
  accepted?: DeliveryPriceSource
): number | null {
  if (!accepted || accepted.buyerStatus !== "Accept") {
    return null;
  }

  if (accepted.pingTreeType === "Silent") {
    // Silent campaigns always bill at campaign min price, not buyer response price.
    return normalizePrice(accepted.campaignMinPrice) ?? accepted.price ?? null;
  }

  return accepted.price ?? null;
}

export function shouldExposePublisherResponsePrice(
  _deliveries: Array<Pick<DeliveryPriceSource, "pingTreeType">>,
  accepted?: Pick<DeliveryPriceSource, "pingTreeType" | "campaignMinPrice">
): boolean {
  if (!accepted) {
    return false;
  }

  if (accepted.pingTreeType === "Silent") {
    return (accepted.campaignMinPrice ?? 0) !== 0;
  }

  return true;
}

export function validateBuyerPriceAgainstCampaign(params: {
  parsed: ParsedBuyerResponse;
  minPrice: number;
  campaignType: CampaignPriceMode;
}) {
  if (params.campaignType === "Silent") {
    // Silent price is defined by campaign minPrice only; buyer response price is ignored.
    return null;
  }

  const campaignPrice = normalizePrice(params.minPrice) ?? 0;
  const buyerReturnedPrice = normalizePrice(params.parsed.soldPrice);

  if (buyerReturnedPrice !== null && buyerReturnedPrice < campaignPrice) {
    return {
      status: "Price Reject" as const,
      reason: `Buyer price ${buyerReturnedPrice} is below campaign min price ${campaignPrice}.`,
    };
  }

  return null;
}
