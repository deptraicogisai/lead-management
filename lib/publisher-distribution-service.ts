import { Types } from "mongoose";
import { VerticalMappingModel } from "@/lib/models/vertical-mapping";
import { VerticalModel } from "@/lib/models/industry";
import { PingTreeConfigModel } from "@/lib/models/ping-tree-config";
import { PublisherDistributionModel } from "@/lib/models/publisher-distribution";
import { buildPingTreeProductMap } from "@/lib/ping-tree-config-products";
import {
  isPublisherDistributionType,
  normalizeAllocationInput,
  sumAllocationPercent,
  ALL_CHANNELS_VALUE,
  type DistributionAllocationInput,
  type PublisherDistributionAllocation,
  type PublisherDistributionRecord,
  type PublisherDistributionType,
} from "@/lib/publisher-distribution";

export type DistributionPayload = {
  verticalId?: string;
  mappingId?: string | null;
  processingType?: string;
  allocations?: unknown;
};

export type ValidatedDistribution = {
  verticalRef: Types.ObjectId;
  mappingRef: Types.ObjectId | null;
  processingType: PublisherDistributionType;
  allocations: DistributionAllocationInput[];
};

export type ValidationResult =
  | { ok: true; data: ValidatedDistribution }
  | { ok: false; message: string; status: number };

/**
 * Validate a create/update distribution payload: product, channel, type and the
 * per-tree percentages (which must total 100% and reference valid ping trees).
 */
export async function validateDistributionPayload(
  sellerId: string,
  body: DistributionPayload
): Promise<ValidationResult> {
  const verticalId = body.verticalId?.trim() ?? "";
  if (!verticalId || !Types.ObjectId.isValid(verticalId)) {
    return { ok: false, message: "A valid product is required.", status: 400 };
  }

  if (!isPublisherDistributionType(body.processingType)) {
    return { ok: false, message: "A valid type is required (Main processing or Silent).", status: 400 };
  }
  const processingType = body.processingType;

  const vertical = await VerticalModel.findById(verticalId, { _id: 1 }).lean();
  if (!vertical) {
    return { ok: false, message: "Product not found.", status: 404 };
  }

  let mappingRef: Types.ObjectId | null = null;
  const rawMappingId = (body.mappingId ?? "").toString().trim();
  if (rawMappingId && rawMappingId !== ALL_CHANNELS_VALUE) {
    if (!Types.ObjectId.isValid(rawMappingId)) {
      return { ok: false, message: "Invalid channel.", status: 400 };
    }
    const mapping = await VerticalMappingModel.findOne(
      { _id: rawMappingId, sellerRef: new Types.ObjectId(sellerId) },
      { _id: 1, verticalRef: 1 }
    ).lean();
    if (!mapping) {
      return { ok: false, message: "Channel not found for this publisher.", status: 404 };
    }
    if (mapping.verticalRef && mapping.verticalRef.toString() !== verticalId) {
      return { ok: false, message: "Channel does not belong to the selected product.", status: 400 };
    }
    mappingRef = mapping._id as Types.ObjectId;
  }

  const allocations = normalizeAllocationInput(body.allocations);
  if (allocations.length === 0) {
    return { ok: false, message: "Select at least one ping tree and set its percentage.", status: 400 };
  }

  const configIds = allocations.map((allocation) => allocation.configId);
  if (configIds.some((id) => !Types.ObjectId.isValid(id))) {
    return { ok: false, message: "One or more ping trees are invalid.", status: 400 };
  }

  const configs = await PingTreeConfigModel.find(
    { _id: { $in: configIds }, status: { $ne: "Deleted" } },
    { _id: 1, verticalRef: 1, processingType: 1 }
  ).lean();
  const configMap = new Map(configs.map((config) => [config._id.toString(), config]));

  for (const allocation of allocations) {
    const config = configMap.get(allocation.configId);
    if (!config) {
      return { ok: false, message: "One or more ping trees no longer exist.", status: 400 };
    }
    if (config.verticalRef?.toString() !== verticalId) {
      return { ok: false, message: "Ping trees must belong to the selected product.", status: 400 };
    }
    if (config.processingType !== processingType) {
      return { ok: false, message: "Ping trees must match the selected type.", status: 400 };
    }
  }

  const total = sumAllocationPercent(allocations);
  if (total !== 100) {
    return {
      ok: false,
      message: `Total percent is ${total}%. The total for all ping trees must equal 100%.`,
      status: 400,
    };
  }

  return {
    ok: true,
    data: {
      verticalRef: new Types.ObjectId(verticalId),
      mappingRef,
      processingType,
      allocations,
    },
  };
}

type DistributionDoc = {
  _id: { toString(): string };
  verticalRef?: { toString(): string } | null;
  mappingRef?: { toString(): string } | null;
  processingType: string;
  allocations?: { configId: string; percent: number }[] | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

/** Enrich raw distribution docs into UI records (product label, channel name, tree names). */
export async function buildDistributionRecords(
  docs: DistributionDoc[]
): Promise<PublisherDistributionRecord[]> {
  const productMap = await buildPingTreeProductMap();

  const mappingIds = new Set<string>();
  const configIds = new Set<string>();
  for (const doc of docs) {
    if (doc.mappingRef) mappingIds.add(doc.mappingRef.toString());
    for (const allocation of doc.allocations ?? []) {
      configIds.add(allocation.configId);
    }
  }

  const [mappings, configs] = await Promise.all([
    mappingIds.size
      ? VerticalMappingModel.find({ _id: { $in: Array.from(mappingIds) } }, { _id: 1, apiName: 1 }).lean()
      : Promise.resolve([]),
    configIds.size
      ? PingTreeConfigModel.find({ _id: { $in: Array.from(configIds) } }, { _id: 1, name: 1, displayId: 1 }).lean()
      : Promise.resolve([]),
  ]);

  const mappingMap = new Map(mappings.map((mapping) => [mapping._id.toString(), mapping]));
  const configMap = new Map(configs.map((config) => [config._id.toString(), config]));

  return docs.map((doc) => {
    const verticalId = doc.verticalRef?.toString() ?? "";
    const product = productMap.get(verticalId) ?? {
      verticalId,
      verticalName: "Unknown",
      productLabel: "Unknown",
    };
    const mappingId = doc.mappingRef?.toString() ?? null;
    const channelName = mappingId
      ? mappingMap.get(mappingId)?.apiName?.trim() || "Unknown channel"
      : "All Channels";

    const allocations: PublisherDistributionAllocation[] = (doc.allocations ?? []).map((allocation) => {
      const config = configMap.get(allocation.configId);
      return {
        configId: allocation.configId,
        configName: config?.name ?? "Deleted tree",
        displayId: config?.displayId ?? null,
        percent: allocation.percent,
      };
    });

    return {
      id: doc._id.toString(),
      verticalId,
      verticalName: product.verticalName,
      productLabel: product.productLabel,
      mappingId,
      channelName,
      processingType: (isPublisherDistributionType(doc.processingType)
        ? doc.processingType
        : "Main processing") as PublisherDistributionType,
      allocations,
      createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : "",
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : "",
    };
  });
}

export type ResolvedPublisherDistribution = {
  id: string;
  /** The matched record's channel scope — null means All Channels. */
  mappingRef: string | null;
  weights: Map<string, number>;
};

/**
 * Resolve publisher-specific tree weights for a lead.
 * Priority: exact channel match, then All Channels (mappingRef null).
 */
export async function resolvePublisherDistributionForLead(params: {
  sellerRefId: string;
  verticalRefId: string;
  mappingRefId: string | null;
  processingType: PublisherDistributionType;
}): Promise<ResolvedPublisherDistribution | null> {
  if (!Types.ObjectId.isValid(params.sellerRefId) || !Types.ObjectId.isValid(params.verticalRefId)) {
    return null;
  }

  const sellerRef = new Types.ObjectId(params.sellerRefId);
  const verticalRef = new Types.ObjectId(params.verticalRefId);
  const baseQuery = {
    sellerRef,
    verticalRef,
    processingType: params.processingType,
  };

  let doc: {
    _id: { toString(): string };
    mappingRef?: { toString(): string } | null;
    allocations?: { configId: string; percent: number }[] | null;
  } | null = null;

  if (params.mappingRefId && Types.ObjectId.isValid(params.mappingRefId)) {
    doc = await PublisherDistributionModel.findOne({
      ...baseQuery,
      mappingRef: new Types.ObjectId(params.mappingRefId),
    }).lean();
  }

  if (!doc) {
    doc = await PublisherDistributionModel.findOne({
      ...baseQuery,
      mappingRef: null,
    }).lean();
  }

  if (!doc?.allocations?.length) {
    return null;
  }

  const weights = new Map<string, number>();
  for (const allocation of doc.allocations) {
    const configId = allocation.configId?.trim() ?? "";
    if (configId && allocation.percent > 0) {
      weights.set(configId, allocation.percent);
    }
  }

  if (weights.size === 0) {
    return null;
  }

  return {
    id: doc._id.toString(),
    mappingRef: doc.mappingRef?.toString() ?? null,
    weights,
  };
}
