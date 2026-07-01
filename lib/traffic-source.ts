import type { Types } from "mongoose";
import {
  getNextTrafficSourceDisplayId,
  TrafficSourceModel,
} from "@/lib/models/traffic-source";

/** Payload keys that are treated as the publisher sub id (Traffic Source name). */
const SUB_ID_KEYS = ["subid", "sub_id", "sub-id", "sub"];

/**
 * Resolve the sub id from a lead payload.
 * Matching is case-insensitive and ignores common separators so `subId`, `sub_id`,
 * `SubID`, etc. all map to the same value.
 */
export function extractSubId(payload: Record<string, unknown>): string | null {
  for (const [key, value] of Object.entries(payload)) {
    const normalizedKey = key.trim().toLowerCase().replace(/[\s_-]/g, "");
    if (normalizedKey !== "subid" && !SUB_ID_KEYS.includes(key.trim().toLowerCase())) {
      continue;
    }

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
}

type EnsureTrafficSourceParams = {
  sellerRef: Types.ObjectId;
  verticalRef?: Types.ObjectId | null;
  mappingRef?: Types.ObjectId | string | { toString(): string } | null;
  sourceName: string;
};

/**
 * Auto-create a Traffic Source for a publisher based on the lead's sub id.
 * Reuses the existing record when one already matches (sellerRef + sourceName),
 * so the same sub id never produces duplicate Traffic Sources.
 */
export async function ensureTrafficSourceForLead({
  sellerRef,
  verticalRef,
  mappingRef,
  sourceName,
}: EnsureTrafficSourceParams) {
  const normalizedSourceName = sourceName.trim();
  if (!normalizedSourceName) {
    return null;
  }

  const existing = await TrafficSourceModel.findOne({ sellerRef, sourceName: normalizedSourceName });
  if (existing) {
    return existing;
  }

  try {
    return await TrafficSourceModel.create({
      displayId: await getNextTrafficSourceDisplayId(),
      sellerRef,
      verticalRef: verticalRef ?? undefined,
      mappingRef: mappingRef ? mappingRef.toString() : undefined,
      sourceName: normalizedSourceName,
      status: "Active",
    });
  } catch (error) {
    // A concurrent lead with the same sub id may have created it first; reuse that record.
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return TrafficSourceModel.findOne({ sellerRef, sourceName: normalizedSourceName });
    }
    throw error;
  }
}
