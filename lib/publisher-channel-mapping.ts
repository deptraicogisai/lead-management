import { Types } from "mongoose";
import { VerticalMappingModel } from "@/lib/models/vertical-mapping";
import type { PublisherChannelMappingInfo } from "@/lib/publisher-lead-details";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function refToId(value: { toString(): string } | string | null | undefined) {
  if (!value) return "";
  return typeof value === "string" ? value : value.toString();
}

/** Resolve Vertical Mapping docs keyed by id (Publisher Channel from intake API key). */
export async function loadPublisherChannelMappingsByIds(
  mappingIds: Array<string | null | undefined>
): Promise<Map<string, PublisherChannelMappingInfo>> {
  const uniqueIds = [
    ...new Set(
      mappingIds
        .map((id) => (typeof id === "string" ? id.trim() : ""))
        .filter((id) => id && Types.ObjectId.isValid(id))
    ),
  ];

  if (uniqueIds.length === 0) {
    return new Map();
  }

  const mappings = await VerticalMappingModel.find({
    _id: { $in: uniqueIds.map((id) => new Types.ObjectId(id)) },
  })
    .select({ displayId: 1, apiName: 1 })
    .lean();

  return new Map(
    mappings.map((mapping) => [
      mapping._id.toString(),
      {
        displayId: typeof mapping.displayId === "number" ? mapping.displayId : null,
        apiName: typeof mapping.apiName === "string" ? mapping.apiName : "",
      },
    ])
  );
}

/**
 * Filter values from the UI are Publisher Channel `apiName`s.
 * Returns matching VerticalMapping ObjectIds (matched via API key mapping records).
 */
export async function findVerticalMappingIdsByChannelNames(channelNames: string[]) {
  const names = channelNames.map((name) => name.trim()).filter(Boolean);
  if (names.length === 0) return [] as Types.ObjectId[];

  const mappings = await VerticalMappingModel.find({
    $or: names.map((name) => ({
      apiName: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
    })),
  })
    .select({ _id: 1 })
    .lean();

  return mappings.map((mapping) => mapping._id as Types.ObjectId);
}

export function getChannelMappingForLeadRef(
  mappingById: Map<string, PublisherChannelMappingInfo>,
  mappingRef: { toString(): string } | string | null | undefined
) {
  const id = refToId(mappingRef);
  if (!id) return null;
  return mappingById.get(id) ?? null;
}
