import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated } from "@/lib/models/industry";
import { SellerModel } from "@/lib/models/seller";
import { ensureVerticalMappingReferencesMigrated, VerticalMappingModel } from "@/lib/models/vertical-mapping";

type Params = { params: Promise<{ id: string; mappingId: string }> };

type UpdateSellerVerticalPayload = {
  apiName?: string;
  status?: "Active" | "Inactive";
};

async function findSellerMapping(sellerId: string, mappingId: string) {
  const seller = await SellerModel.findById(sellerId, { _id: 1 }).lean();
  if (!seller) {
    return { error: NextResponse.json({ message: "Seller not found." }, { status: 404 }) };
  }

  const mapping = await VerticalMappingModel.findOne({
    _id: mappingId,
    sellerRef: seller._id,
  });

  if (!mapping) {
    return { error: NextResponse.json({ message: "Seller API not found." }, { status: 404 }) };
  }

  return { mapping };
}

export async function PATCH(req: Request, context: Params) {
  try {
    const { id, mappingId } = await context.params;
    const body = (await req.json()) as UpdateSellerVerticalPayload;

    if (!body.apiName?.trim()) {
      return NextResponse.json({ message: "API Name is required." }, { status: 400 });
    }

    const status = body.status === "Inactive" ? "Inactive" : "Active";

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    await ensureVerticalMappingReferencesMigrated();

    const result = await findSellerMapping(id, mappingId);
    if ("error" in result) {
      return result.error;
    }

    result.mapping.apiName = body.apiName.trim();
    result.mapping.status = status;
    await result.mapping.save();

    return NextResponse.json({ message: "Seller API updated." });
  } catch {
    return NextResponse.json({ message: "Failed to update seller API." }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: Params) {
  try {
    const { id, mappingId } = await context.params;

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    await ensureVerticalMappingReferencesMigrated();

    const result = await findSellerMapping(id, mappingId);
    if ("error" in result) {
      return result.error;
    }

    await result.mapping.deleteOne();

    return NextResponse.json({ message: "Seller API deleted." });
  } catch {
    return NextResponse.json({ message: "Failed to delete seller API." }, { status: 500 });
  }
}
