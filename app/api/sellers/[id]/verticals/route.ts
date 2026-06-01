import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import { SellerModel } from "@/lib/models/seller";
import { ensureVerticalMappingReferencesMigrated, VerticalMappingModel } from "@/lib/models/vertical-mapping";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Params) {
  try {
    const { id } = await context.params;
    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    await ensureVerticalMappingReferencesMigrated();

    const seller = await SellerModel.findById(id, { _id: 1 }).lean();
    if (!seller) {
      return NextResponse.json({ message: "Seller not found." }, { status: 404 });
    }

    const mappings = await VerticalMappingModel.find({ sellerRef: seller._id }).sort({ createdAt: 1 }).lean();
    const verticalRefs = mappings.map((mapping) => mapping.verticalRef).filter(Boolean);

    if (verticalRefs.length === 0) {
      return NextResponse.json([]);
    }

    const verticals = await VerticalModel.find({ _id: { $in: verticalRefs } }).lean();
    const verticalMap = new Map(
      verticals.map((vertical) => [
        vertical._id.toString(),
        { id: vertical._id.toString(), name: vertical.name },
      ])
    );

    return NextResponse.json(
      mappings
        .map((mapping) => {
          const vertical = mapping.verticalRef ? verticalMap.get(mapping.verticalRef.toString()) : undefined;
          if (!vertical) return null;

          return {
            id: mapping._id.toString(),
            verticalId: vertical.id,
            verticalName: vertical.name,
            apiRequest: mapping.apiRequest,
          };
        })
        .filter((mapping): mapping is NonNullable<typeof mapping> => Boolean(mapping))
    );
  } catch {
    return NextResponse.json({ message: "Failed to fetch seller verticals." }, { status: 500 });
  }
}
