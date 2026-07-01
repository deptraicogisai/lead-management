import type { PingTreeProcessingType } from "@/lib/ping-tree-config";

/** Distribution settings only target two of the ping tree processing types. */
export const PUBLISHER_DISTRIBUTION_TYPES = ["Main processing", "Silent"] as const;

export type PublisherDistributionType = (typeof PUBLISHER_DISTRIBUTION_TYPES)[number];

export function isPublisherDistributionType(value: unknown): value is PublisherDistributionType {
  return (
    typeof value === "string" &&
    (PUBLISHER_DISTRIBUTION_TYPES as readonly string[]).includes(value)
  );
}

/** The processing type is a subset of ping tree processing types. */
export function toPingTreeProcessingType(value: PublisherDistributionType): PingTreeProcessingType {
  return value;
}

export type PublisherDistributionAllocation = {
  configId: string;
  configName: string;
  displayId: number | null;
  percent: number;
};

export type PublisherDistributionRecord = {
  id: string;
  verticalId: string;
  verticalName: string;
  productLabel: string;
  mappingId: string | null;
  channelName: string;
  processingType: PublisherDistributionType;
  allocations: PublisherDistributionAllocation[];
  createdAt: string;
  updatedAt: string;
};

export type DistributionAllocationInput = {
  configId: string;
  percent: number;
};

/** Channel value used in the UI / payload to mean "all publisher channels". */
export const ALL_CHANNELS_VALUE = "all";

export function normalizeAllocationInput(input: unknown): DistributionAllocationInput[] {
  if (!Array.isArray(input)) return [];

  const seen = new Set<string>();
  const result: DistributionAllocationInput[] = [];

  for (const item of input) {
    if (typeof item !== "object" || item === null) continue;
    const rawId = (item as { configId?: unknown }).configId;
    const configId = typeof rawId === "string" ? rawId.trim() : "";
    if (!configId || seen.has(configId)) continue;

    const rawPercent = Number((item as { percent?: unknown }).percent);
    const percent = Number.isFinite(rawPercent)
      ? Math.max(0, Math.min(100, Math.round(rawPercent)))
      : 0;

    seen.add(configId);
    result.push({ configId, percent });
  }

  return result;
}

export function sumAllocationPercent(allocations: DistributionAllocationInput[]): number {
  return allocations.reduce((total, allocation) => total + allocation.percent, 0);
}
