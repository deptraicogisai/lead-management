import type { PingTreeCampaignType } from "@/lib/ping-tree";
import type { ParsedBuyerResponse } from "@/lib/integration-runtime";
import type { MappingApiType } from "@/lib/mapping-api-type";

export type CampaignPriceMode = "Redirect" | "Silent";

/** Publisher-facing reject reason when no valid buyer Accept remains. */
export const PUBLISHER_BUYER_REJECT_REASON = "Buyer Reject";

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

export type DeliveryPriceSource = {
  pingTreeType: PingTreeCampaignType;
  buyerStatus?: string;
  price: number | null;
  campaignMinPrice?: number;
};

/**
 * Silent campaigns with minPrice = 0 still store buyer Accept for reporting,
 * but must never count toward Publisher Accept / price.
 */
export function isSilentZeroMinPriceAccept(delivery: DeliveryPriceSource): boolean {
  return (
    delivery.pingTreeType === "Silent" &&
    delivery.buyerStatus === "Accept" &&
    delivery.campaignMinPrice !== undefined &&
    delivery.campaignMinPrice !== null &&
    delivery.campaignMinPrice === 0
  );
}

/** Accept that can make the Publisher Sold and contribute to publisher price. */
export function isPublisherCountableAccept(delivery: DeliveryPriceSource): boolean {
  return delivery.buyerStatus === "Accept" && !isSilentZeroMinPriceAccept(delivery);
}

/**
 * Whether an Accept delivery should store a non-zero publisher payout (Pub).
 * - Redirect API: only Main Processing (Redirect) Accepts pay the publisher.
 *   Silent Accepts remain Sold in buyer report but Pub is always 0.
 * - Silent API: countable Silent Accepts pay the publisher.
 */
export function shouldApplyPublisherPayout(
  pingTreeType: PingTreeCampaignType,
  apiType: MappingApiType = "Redirect"
): boolean {
  if (apiType === "Silent") {
    return pingTreeType === "Silent";
  }
  return pingTreeType === "Redirect";
}

function silentAcceptRawPrice(delivery: DeliveryPriceSource): number | null {
  return normalizePrice(delivery.campaignMinPrice) ?? normalizePrice(delivery.price);
}

/**
 * Raw buyer-side amount(s) before RevShare — used for the **publisher API**
 * response / seller-lead soldPrice only.
 * - Redirect API: Main Processing (Redirect) Accept price only.
 *   Silent Accepts remain Sold in buyer report with their own delivery price;
 *   they do not change publisher response price or Pub.
 * - Silent API: sum of campaign min prices for every countable Silent Accept.
 */
export function resolvePublisherBuyerPrice(
  deliveries: DeliveryPriceSource[],
  accepted: DeliveryPriceSource | undefined,
  apiType: MappingApiType = "Redirect"
): number | null {
  if (apiType === "Silent") {
    const accepts = deliveries.filter(
      (delivery) => delivery.pingTreeType === "Silent" && isPublisherCountableAccept(delivery)
    );
    if (accepts.length === 0) {
      return null;
    }

    let total = 0;
    for (const delivery of accepts) {
      total += silentAcceptRawPrice(delivery) ?? 0;
    }
    return normalizePrice(total);
  }

  if (!accepted || !isPublisherCountableAccept(accepted) || accepted.pingTreeType !== "Redirect") {
    return null;
  }

  return accepted.price ?? null;
}

export type PublisherScopedDelivery = DeliveryPriceSource & {
  sellerLeadRef?: string;
  buyerStatus?: string;
  buyerRef?: string;
  campaignRef?: string;
};

/** Accept delivery that counts toward publisher-report TTL for the lead's API type. */
export function isPublisherScopedAcceptDelivery(
  delivery: PublisherScopedDelivery,
  apiType: MappingApiType = "Redirect"
): boolean {
  return (
    delivery.buyerStatus === "Accept" &&
    isPublisherCountableAccept(delivery) &&
    shouldApplyPublisherPayout(delivery.pingTreeType, apiType)
  );
}

export function findPublisherScopedAcceptedDelivery(
  deliveries: PublisherScopedDelivery[],
  apiType: MappingApiType = "Redirect"
): PublisherScopedDelivery | null {
  if (apiType === "Redirect") {
    return (
      deliveries.find(
        (delivery) =>
          delivery.pingTreeType === "Redirect" && isPublisherScopedAcceptDelivery(delivery, apiType)
      ) ?? null
    );
  }

  return (
    deliveries.find(
      (delivery) =>
        delivery.pingTreeType === "Silent" && isPublisherScopedAcceptDelivery(delivery, apiType)
    ) ?? null
  );
}

function scopedAcceptRawPrice(delivery: PublisherScopedDelivery, apiType: MappingApiType): number {
  if (apiType === "Silent" && delivery.pingTreeType === "Silent") {
    return silentAcceptRawPrice(delivery) ?? 0;
  }

  return typeof delivery.price === "number" && Number.isFinite(delivery.price) ? delivery.price : 0;
}

/** Sum buyer-side TTL for publisher reports, scoped by mapping API type. */
export function sumPublisherScopedDeliveryRevenue(
  leadId: string,
  deliveries: PublisherScopedDelivery[],
  apiType: MappingApiType = "Redirect"
): number {
  let total = 0;
  for (const delivery of deliveries) {
    const sellerLeadRef = delivery.sellerLeadRef ?? "";
    if (sellerLeadRef !== leadId) continue;
    if (!isPublisherScopedAcceptDelivery(delivery, apiType)) continue;
    total += scopedAcceptRawPrice(delivery, apiType);
  }

  return normalizePrice(total) ?? 0;
}

export function shouldExposePublisherResponsePrice(
  deliveries: DeliveryPriceSource[],
  accepted: DeliveryPriceSource | undefined,
  apiType: MappingApiType = "Redirect"
): boolean {
  if (apiType === "Silent") {
    return deliveries.some(
      (delivery) => delivery.pingTreeType === "Silent" && isPublisherCountableAccept(delivery)
    );
  }

  return Boolean(
    accepted &&
      accepted.pingTreeType === "Redirect" &&
      isPublisherCountableAccept(accepted)
  );
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
