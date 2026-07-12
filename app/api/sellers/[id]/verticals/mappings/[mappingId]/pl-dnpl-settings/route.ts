import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated } from "@/lib/models/industry";
import { ensureVerticalMappingReferencesMigrated } from "@/lib/models/vertical-mapping";
import { findSellerVerticalMappingById } from "@/lib/seller-vertical-mapping";

type Params = { params: Promise<{ id: string; mappingId: string }> };

function sanitizePlDnplListIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter(
        (id): id is string => typeof id === "string" && Types.ObjectId.isValid(id.trim())
      )
    ),
  ];
}

export async function GET(_: Request, context: Params) {
  try {
    const { id, mappingId } = await context.params;
    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    await ensureVerticalMappingReferencesMigrated();

    const mapping = await findSellerVerticalMappingById(id, mappingId);
    if (!mapping) {
      return NextResponse.json({ message: "Seller API not found." }, { status: 404 });
    }

    return NextResponse.json({
      plDnplListIds: Array.isArray(mapping.plDnplListIds) ? mapping.plDnplListIds : [],
      verticalId: mapping.verticalRef?.toString() ?? "",
    });
  } catch {
    return NextResponse.json({ message: "Failed to fetch PL/DNPL settings." }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: Params) {
  try {
    const { id, mappingId } = await context.params;
    const body = (await req.json()) as { plDnplListIds?: unknown };

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    await ensureVerticalMappingReferencesMigrated();

    const mapping = await findSellerVerticalMappingById(id, mappingId);
    if (!mapping) {
      return NextResponse.json({ message: "Seller API not found." }, { status: 404 });
    }

    const plDnplListIds = sanitizePlDnplListIds(body.plDnplListIds);
    mapping.set("plDnplListIds", plDnplListIds);
    mapping.markModified("plDnplListIds");
    await mapping.save();

    return NextResponse.json({
      plDnplListIds,
      verticalId: mapping.verticalRef?.toString() ?? "",
    });
  } catch {
    return NextResponse.json({ message: "Failed to update PL/DNPL settings." }, { status: 500 });
  }
}
