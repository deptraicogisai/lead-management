import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/mongodb";

import { ensureVerticalCollectionMigrated } from "@/lib/models/industry";

import { ensureVerticalMappingReferencesMigrated } from "@/lib/models/vertical-mapping";

import { getEffectiveMappingFields } from "@/lib/mapping-fields";

import { ensureSellerVerticalMappingFieldsSeeded } from "@/lib/seller-vertical-mapping";



type Params = { params: Promise<{ id: string; verticalId: string }> };



export async function GET(_: Request, context: Params) {

  try {

    const { id, verticalId } = await context.params;

    await connectToDatabase();

    await ensureVerticalCollectionMigrated();

    await ensureVerticalMappingReferencesMigrated();



    const seeded = await ensureSellerVerticalMappingFieldsSeeded(id, verticalId);

    if (!seeded) {

      return NextResponse.json({ message: "Vertical mapping not found." }, { status: 404 });

    }



    return NextResponse.json(getEffectiveMappingFields(seeded.verticalFields, seeded.mappingFields));

  } catch {

    return NextResponse.json({ message: "Failed to fetch mapping fields." }, { status: 500 });

  }

}

