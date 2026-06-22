export const REV_SHARE_MODEL_OPTIONS = ["system-default", "static-percent", "fixed-price"] as const;

export type RevShareModelType = (typeof REV_SHARE_MODEL_OPTIONS)[number];

export type MappingRevShareSettingsRecord = {
  model: RevShareModelType;
  percent: number | null;
  fixedPrice: number | null;
  rejectIfPingPriceLowerThanFixedPrice: boolean;
  copyToOtherPublishers: boolean;
  copyPublisherIds: string[];
};

type MappingRevShareDoc = Partial<MappingRevShareSettingsRecord> | null | undefined;

export type { MappingRevShareDoc };

export function defaultMappingRevShareSettings(): MappingRevShareSettingsRecord {
  return {
    model: "system-default",
    percent: null,
    fixedPrice: null,
    rejectIfPingPriceLowerThanFixedPrice: true,
    copyToOtherPublishers: false,
    copyPublisherIds: [],
  };
}

function parseOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toMappingRevShareSettings(doc: MappingRevShareDoc): MappingRevShareSettingsRecord {
  const defaults = defaultMappingRevShareSettings();
  const model = REV_SHARE_MODEL_OPTIONS.includes(doc?.model as RevShareModelType)
    ? (doc?.model as RevShareModelType)
    : defaults.model;

  return {
    model,
    percent: parseOptionalNumber(doc?.percent),
    fixedPrice: parseOptionalNumber(doc?.fixedPrice),
    rejectIfPingPriceLowerThanFixedPrice:
      doc?.rejectIfPingPriceLowerThanFixedPrice === undefined
        ? defaults.rejectIfPingPriceLowerThanFixedPrice
        : Boolean(doc.rejectIfPingPriceLowerThanFixedPrice),
    copyToOtherPublishers: Boolean(doc?.copyToOtherPublishers),
    copyPublisherIds: Array.isArray(doc?.copyPublisherIds)
      ? doc.copyPublisherIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : [],
  };
}

export function sanitizeMappingRevShareSettings(
  input: Partial<MappingRevShareSettingsRecord>
): MappingRevShareSettingsRecord {
  const model = REV_SHARE_MODEL_OPTIONS.includes(input.model as RevShareModelType)
    ? (input.model as RevShareModelType)
    : "system-default";

  const percent = parseOptionalNumber(input.percent);
  const fixedPrice = parseOptionalNumber(input.fixedPrice);

  return {
    model,
    percent: model === "static-percent" ? percent : null,
    fixedPrice: model === "fixed-price" ? fixedPrice : null,
    rejectIfPingPriceLowerThanFixedPrice:
      model === "fixed-price"
        ? input.rejectIfPingPriceLowerThanFixedPrice === undefined
          ? true
          : Boolean(input.rejectIfPingPriceLowerThanFixedPrice)
        : false,
    copyToOtherPublishers: Boolean(input.copyToOtherPublishers),
    copyPublisherIds: Array.isArray(input.copyPublisherIds)
      ? [...new Set(input.copyPublisherIds.map((id) => id.trim()).filter(Boolean))]
      : [],
  };
}

export function validateMappingRevShareSettings(settings: MappingRevShareSettingsRecord): string | null {
  if (settings.model === "static-percent") {
    if (settings.percent === null || settings.percent < 0 || settings.percent > 100) {
      return "Please enter a valid percent between 0 and 100.";
    }
  }

  if (settings.model === "fixed-price") {
    if (settings.fixedPrice === null || settings.fixedPrice < 0) {
      return "Please enter a valid fixed price.";
    }
  }

  if (settings.copyToOtherPublishers && settings.copyPublisherIds.length === 0) {
    return "Select at least one publisher to copy settings to.";
  }

  return null;
}

export function formatRevShareModelLabel(model: RevShareModelType) {
  if (model === "static-percent") return "Static Percent";
  if (model === "fixed-price") return "Fixed Price";
  return "System Default";
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export function resolvePublisherPriceFromRevShare(
  buyerPrice: number | null,
  settings: MappingRevShareSettingsRecord = defaultMappingRevShareSettings()
): number | null {
  if (settings.model === "system-default") {
    return buyerPrice;
  }

  if (settings.model === "static-percent") {
    if (buyerPrice === null || !Number.isFinite(buyerPrice)) {
      return null;
    }

    const percent = settings.percent ?? 0;
    return roundCurrency(buyerPrice * (percent / 100));
  }

  const fixedPrice = settings.fixedPrice ?? 0;
  const buyerAmount = buyerPrice !== null && Number.isFinite(buyerPrice) ? buyerPrice : 0;

  if (settings.rejectIfPingPriceLowerThanFixedPrice && buyerAmount < fixedPrice) {
    return 0;
  }

  return fixedPrice;
}
