import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { SellerModel } from "@/lib/models/seller";
import { ensureVerticalMappingReferencesMigrated, VerticalMappingModel } from "@/lib/models/vertical-mapping";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import { ensureMappingApiRequest } from "@/lib/mapping-api-request";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: Params) {
  try {
    const { id } = await context.params;

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    await ensureVerticalMappingReferencesMigrated();

    const mapping = await VerticalMappingModel.findById(id);
    if (!mapping) {
      return NextResponse.json({ message: "Vertical mapping not found." }, { status: 404 });
    }

    const [seller, vertical] = await Promise.all([
      mapping.sellerRef ? SellerModel.findById(mapping.sellerRef, { name: 1 }).lean() : null,
      mapping.verticalRef ? VerticalModel.findById(mapping.verticalRef, { name: 1 }).lean() : null,
    ]);

    if (!seller || !vertical) {
      return NextResponse.json({ message: "Vertical mapping references are invalid." }, { status: 400 });
    }

    const apiRequest = await ensureMappingApiRequest(mapping);
    if (!apiRequest) {
      return NextResponse.json({ message: "Vertical mapping references are invalid." }, { status: 400 });
    }

    return NextResponse.json({
      id: mapping._id.toString(),
      verticalId: vertical._id.toString(),
      sellerId: seller._id.toString(),
      apiRequest,
    });
  } catch {
    return NextResponse.json({ message: "Failed to generate API request." }, { status: 500 });
  }
}
