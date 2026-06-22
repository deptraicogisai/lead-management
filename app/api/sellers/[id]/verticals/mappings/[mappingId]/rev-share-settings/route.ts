import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated } from "@/lib/models/industry";
import { ensureVerticalMappingReferencesMigrated, VerticalMappingModel } from "@/lib/models/vertical-mapping";
import {
  sanitizeMappingRevShareSettings,
  toMappingRevShareSettings,
  validateMappingRevShareSettings,
  type MappingRevShareSettingsRecord,
} from "@/lib/mapping-rev-share-settings";
import { findSellerVerticalMappingById } from "@/lib/seller-vertical-mapping";

type Params = { params: Promise<{ id: string; mappingId: string }> };

function applyRevShareToMapping(
  mapping: {
    set: (path: string, value: unknown) => void;
    markModified: (path: string) => void;
  },
  settings: MappingRevShareSettingsRecord
) {
  mapping.set("revShare", settings);
  mapping.markModified("revShare");
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

    return NextResponse.json(toMappingRevShareSettings(mapping.revShare));
  } catch {
    return NextResponse.json({ message: "Failed to fetch rev-share settings." }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: Params) {
  try {
    const { id, mappingId } = await context.params;
    const body = (await req.json()) as Partial<MappingRevShareSettingsRecord>;

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    await ensureVerticalMappingReferencesMigrated();

    const mapping = await findSellerVerticalMappingById(id, mappingId);
    if (!mapping) {
      return NextResponse.json({ message: "Seller API not found." }, { status: 404 });
    }

    const settings = sanitizeMappingRevShareSettings(body);
    const validationError = validateMappingRevShareSettings(settings);
    if (validationError) {
      return NextResponse.json({ message: validationError }, { status: 400 });
    }

    applyRevShareToMapping(mapping, settings);
    await mapping.save();

    if (settings.copyToOtherPublishers && settings.copyPublisherIds.length > 0) {
      const targetSellerIds = settings.copyPublisherIds.filter(
        (publisherId) => publisherId !== id && Types.ObjectId.isValid(publisherId)
      );

      if (targetSellerIds.length > 0) {
        const copyPayload = {
          ...settings,
          copyToOtherPublishers: false,
          copyPublisherIds: [],
        };

        await VerticalMappingModel.updateMany(
          {
            sellerRef: { $in: targetSellerIds.map((sellerId) => new Types.ObjectId(sellerId)) },
          },
          { $set: { revShare: copyPayload } }
        );
      }
    }

    return NextResponse.json(toMappingRevShareSettings(mapping.revShare));
  } catch {
    return NextResponse.json({ message: "Failed to update rev-share settings." }, { status: 500 });
  }
}
