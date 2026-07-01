import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import { SellerModel } from "@/lib/models/seller";
import {
  ensureTrafficSourceDisplayIdMigrated,
  TrafficSourceModel,
} from "@/lib/models/traffic-source";
import { VerticalMappingModel } from "@/lib/models/vertical-mapping";
import { sortNewestFirst } from "@/lib/list-sort";
import { buildMongoStatusFilter, mergeMongoFilters } from "@/lib/soft-delete";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: Params) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    await ensureTrafficSourceDisplayIdMigrated();

    const seller = await SellerModel.findById(id, { _id: 1 }).lean();
    if (!seller) {
      return NextResponse.json({ message: "Seller not found." }, { status: 404 });
    }

    const sources = await TrafficSourceModel.find(
      mergeMongoFilters(buildMongoStatusFilter(statusFilter || "All"), { sellerRef: seller._id })
    )
      .sort(sortNewestFirst)
      .lean();

    const verticalRefs = sources.map((source) => source.verticalRef).filter(Boolean);
    const verticals = verticalRefs.length
      ? await VerticalModel.find({ _id: { $in: verticalRefs } }, { _id: 1, name: 1 }).lean()
      : [];
    const verticalNameById = new Map(verticals.map((vertical) => [vertical._id.toString(), vertical.name]));

    const mappingRefs = sources.map((source) => source.mappingRef).filter(Boolean);
    const mappings = mappingRefs.length
      ? await VerticalMappingModel.find({ _id: { $in: mappingRefs } }, { _id: 1, apiName: 1 }).lean()
      : [];
    const channelNameById = new Map(
      mappings.map((mapping) => [mapping._id.toString(), mapping.apiName?.trim() || ""])
    );

    return NextResponse.json(
      sources.map((source) => ({
        id: source._id.toString(),
        displayId: source.displayId ?? null,
        sourceName: source.sourceName,
        channelName: source.mappingRef
          ? channelNameById.get(source.mappingRef.toString()) ?? ""
          : "",
        verticalName: source.verticalRef
          ? verticalNameById.get(source.verticalRef.toString()) ?? ""
          : "",
        status:
          source.status === "Deleted"
            ? "Deleted"
            : source.status === "Active"
              ? "Active"
              : "Disabled",
      }))
    );
  } catch {
    return NextResponse.json({ message: "Failed to fetch traffic sources." }, { status: 500 });
  }
}
