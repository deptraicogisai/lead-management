import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import { ensureVerticalMappingReferencesMigrated, VerticalMappingModel } from "@/lib/models/vertical-mapping";
import { getEffectiveMappingFields } from "@/lib/mapping-fields";

type Params = { params: Promise<{ id: string; verticalId: string }> };

type MappingFieldDoc = {
  _id?: { toString(): string } | string;
  sourceVerticalFieldId?: string | null;
  fieldName: string;
  description: string;
  type: string;
  required: boolean;
  format?: string | null;
};

type VerticalFieldDoc = {
  _id?: { toString(): string } | string;
  fieldName: string;
  description: string;
  type: string;
  required: boolean;
  format?: string | null;
};

export async function GET(_: Request, context: Params) {
  try {
    const { id, verticalId } = await context.params;
    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    await ensureVerticalMappingReferencesMigrated();

    const mapping = await VerticalMappingModel.findOne({
      sellerRef: id,
      verticalRef: verticalId,
    }).lean();

    if (!mapping) {
      return NextResponse.json({ message: "Vertical mapping not found." }, { status: 404 });
    }

    const vertical = mapping.verticalRef ? await VerticalModel.findById(mapping.verticalRef).lean() : null;
    if (!vertical) {
      return NextResponse.json({ message: "Vertical not found." }, { status: 404 });
    }

    return NextResponse.json(
      getEffectiveMappingFields(
        (vertical?.fields as VerticalFieldDoc[] | undefined) ?? [],
        (mapping.fields as MappingFieldDoc[] | undefined) ?? []
      )
    );
  } catch {
    return NextResponse.json({ message: "Failed to fetch mapping fields." }, { status: 500 });
  }
}
