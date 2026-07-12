import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated } from "@/lib/models/industry";
import {
  ensureVerticalMappingReferencesMigrated,
  VerticalMappingModel,
} from "@/lib/models/vertical-mapping";
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

export async function POST(req: Request, context: Params) {
  try {
    const { id, mappingId } = await context.params;
    const body = (await req.json()) as {
      action?: string;
      targetSellerIds?: string[];
      plDnplListIds?: unknown;
    };

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    await ensureVerticalMappingReferencesMigrated();

    const mapping = await findSellerVerticalMappingById(id, mappingId);
    if (!mapping) {
      return NextResponse.json({ message: "Seller API not found." }, { status: 404 });
    }

    if (body.action !== "copy-pl-dnpl") {
      return NextResponse.json({ message: "Unsupported action." }, { status: 400 });
    }

    const targetSellerIds = Array.isArray(body.targetSellerIds)
      ? body.targetSellerIds.filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0
        )
      : [];

    if (targetSellerIds.length === 0) {
      return NextResponse.json({ message: "Please select at least one publisher." }, { status: 400 });
    }

    if (!mapping.verticalRef) {
      return NextResponse.json(
        { message: "This publisher mapping has no product assigned." },
        { status: 400 }
      );
    }

    const listIds = sanitizePlDnplListIds(
      body.plDnplListIds !== undefined ? body.plDnplListIds : mapping.plDnplListIds
    );

    let updatedCount = 0;

    for (const targetSellerId of targetSellerIds) {
      if (!Types.ObjectId.isValid(targetSellerId) || targetSellerId === id) {
        continue;
      }

      const targetMappings = await VerticalMappingModel.find({
        sellerRef: new Types.ObjectId(targetSellerId),
        verticalRef: mapping.verticalRef,
      });

      for (const targetMapping of targetMappings) {
        targetMapping.set("plDnplListIds", listIds);
        targetMapping.markModified("plDnplListIds");
        await targetMapping.save();
        updatedCount += 1;
      }
    }

    if (updatedCount === 0) {
      return NextResponse.json(
        {
          message:
            "No matching publisher product mappings were updated. Selected publishers may not have this product configured.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: `PL/DNPL settings copied to ${updatedCount} publisher mapping(s).`,
      updatedCount,
    });
  } catch {
    return NextResponse.json({ message: "Failed to copy PL/DNPL settings." }, { status: 500 });
  }
}
