import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import { SellerModel } from "@/lib/models/seller";
import { ensureVerticalMappingReferencesMigrated, VerticalMappingModel } from "@/lib/models/vertical-mapping";
import { generateUniqueMappingApiRequest } from "@/lib/mapping-api-request";
import { buildCopiedFieldsFromVertical } from "@/lib/mapping-fields";
import { sortNewestFirst } from "@/lib/list-sort";

type Params = { params: Promise<{ id: string }> };

type CreateSellerVerticalPayload = {
  apiName?: string;
  verticalId?: string;
  status?: "Active" | "Inactive";
};

function toSellerVerticalResponse(mapping: {
  _id?: { toString(): string };
  apiName?: string | null;
  status?: string | null;
  apiRequest?: {
    apiKey: string;
    url: string;
    method: string;
  } | null;
  verticalId: string;
  verticalName: string;
}) {
  return {
    id: mapping._id?.toString() ?? "",
    verticalId: mapping.verticalId,
    verticalName: mapping.verticalName,
    apiName: mapping.apiName?.trim() || mapping.verticalName,
    status: mapping.status === "Inactive" ? "Inactive" : "Active",
    apiRequest: mapping.apiRequest,
  };
}

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

    const mappings = await VerticalMappingModel.find({ sellerRef: seller._id }).sort(sortNewestFirst).lean();
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

          return toSellerVerticalResponse({
            _id: mapping._id,
            apiName: mapping.apiName,
            status: mapping.status,
            apiRequest: mapping.apiRequest,
            verticalId: vertical.id,
            verticalName: vertical.name,
          });
        })
        .filter((mapping): mapping is NonNullable<typeof mapping> => Boolean(mapping))
    );
  } catch {
    return NextResponse.json({ message: "Failed to fetch seller verticals." }, { status: 500 });
  }
}

export async function POST(req: Request, context: Params) {
  try {
    const { id } = await context.params;
    const body = (await req.json()) as CreateSellerVerticalPayload;

    if (!body.apiName?.trim()) {
      return NextResponse.json({ message: "API Name is required." }, { status: 400 });
    }

    if (!body.verticalId?.trim()) {
      return NextResponse.json({ message: "Vertical is required." }, { status: 400 });
    }

    const status = body.status === "Inactive" ? "Inactive" : "Active";

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    await ensureVerticalMappingReferencesMigrated();

    const [seller, vertical] = await Promise.all([
      SellerModel.findById(id),
      VerticalModel.findById(body.verticalId.trim()),
    ]);

    if (!seller) {
      return NextResponse.json({ message: "Seller not found." }, { status: 404 });
    }

    if (!vertical) {
      return NextResponse.json({ message: "Vertical not found." }, { status: 404 });
    }

    const apiRequest = await generateUniqueMappingApiRequest(seller._id.toString());

    const mapping = await VerticalMappingModel.create({
      sellerRef: seller._id,
      verticalRef: vertical._id,
      apiName: body.apiName.trim(),
      status,
      fields: buildCopiedFieldsFromVertical(vertical.fields ?? []),
      apiRequest,
    });

    return NextResponse.json(
      toSellerVerticalResponse({
        _id: mapping._id,
        apiName: mapping.apiName,
        status: mapping.status,
        apiRequest: mapping.apiRequest,
        verticalId: vertical._id.toString(),
        verticalName: vertical.name,
      }),
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNIQUE_API_KEY_FAILED") {
      return NextResponse.json({ message: "Failed to generate a unique API key. Please try again." }, { status: 409 });
    }

    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      const keyPattern = (error as { keyPattern?: Record<string, unknown> }).keyPattern;
      if (keyPattern?.verticalRef && keyPattern?.sellerRef) {
        return NextResponse.json(
          { message: "Database still enforces one API per seller and vertical. Please restart the app or contact support." },
          { status: 409 }
        );
      }

      return NextResponse.json({ message: "Failed to generate a unique API key. Please try again." }, { status: 409 });
    }

    return NextResponse.json({ message: "Failed to create seller API." }, { status: 500 });
  }
}
