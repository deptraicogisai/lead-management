type BuyerDeliveryLogLike = {
  requestType?: string;
  sellerRef?: unknown;
  sellerLeadRef?: unknown;
  campaignRef?: unknown;
  buyerRef?: unknown;
  postLeadUrl?: string;
  httpStatus?: number;
  responseBody?: string | null;
  requestPayload?: unknown;
  createdAt?: Date | string;
};

function toIdString(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "toString" in value) {
    return (value as { toString(): string }).toString();
  }
  return "";
}

function stablePayloadKey(payload: unknown) {
  try {
    return JSON.stringify(payload ?? {});
  } catch {
    return String(payload ?? "");
  }
}

export function buildBuyerDeliveryLogDedupeKey(log: BuyerDeliveryLogLike) {
  const sellerLeadRef = toIdString(log.sellerLeadRef);
  const campaignRef = toIdString(log.campaignRef);

  if (sellerLeadRef && campaignRef) {
    return `lead:${sellerLeadRef}:campaign:${campaignRef}`;
  }

  return [
    toIdString(log.sellerRef),
    toIdString(log.buyerRef),
    log.postLeadUrl?.trim() ?? "",
    String(log.httpStatus ?? 0),
    log.responseBody ?? "",
    stablePayloadKey(log.requestPayload),
  ].join("\0");
}

export function dedupeBuyerRequestLogDocs<T extends BuyerDeliveryLogLike>(logs: T[]): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];

  for (const log of logs) {
    if (log.requestType !== "buyer-delivery") {
      deduped.push(log);
      continue;
    }

    const key = buildBuyerDeliveryLogDedupeKey(log);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(log);
  }

  return deduped;
}
