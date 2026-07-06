import type { Types } from "mongoose";
import {
  getNextTrafficSourceDisplayId,
  TrafficSourceModel,
} from "@/lib/models/traffic-source";

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
