import { NextResponse } from "next/server";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import { connectToDatabase } from "@/lib/mongodb";
import { SellerModel } from "@/lib/models/seller";
import { ensureVerticalMappingReferencesMigrated, VerticalMappingModel } from "@/lib/models/vertical-mapping";
import { toDocumentationField } from "@/lib/api-documentation-field";
import { buildFullEndpointUrl } from "@/lib/api-documentation-content";
import { getEffectiveMappingFields } from "@/lib/mapping-fields";
import { ensureMappingApiRequest } from "@/lib/mapping-api-request";
import type { MappingFieldDoc } from "@/lib/mapping-field-api";
import { toMappingIntakeSettings } from "@/lib/mapping-intake-settings";

type Params = { params: Promise<{ id: string }> };

type VerticalFieldDoc = {
  _id?: { toString(): string } | string;
  fieldName: string;
  description: string;
  type: string;
  required: boolean;
  format?: string | null;
  emailDuplicateRule?: {
    mode?: "days" | "forever" | null;
    days?: number | null;
  } | null;
  ignoreValues?: string[] | null;
  options?: Array<{ label?: string | null; value?: string | null }> | null;
};

export async function GET(req: Request, context: Params) {
  try {
    const { id } = await context.params;
    const baseUrl = new URL(req.url).origin;

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    await ensureVerticalMappingReferencesMigrated();

    const mapping = await VerticalMappingModel.findById(id);
    if (!mapping) {
      return NextResponse.json({ message: "Vertical mapping not found." }, { status: 404 });
    }

    const apiRequest = await ensureMappingApiRequest(mapping);
    if (!apiRequest) {
      return NextResponse.json({ message: "Vertical mapping references are invalid." }, { status: 400 });
    }

    const [seller, vertical] = await Promise.all([
      mapping.sellerRef ? SellerModel.findById(mapping.sellerRef, { name: 1 }).lean() : null,
      mapping.verticalRef ? VerticalModel.findById(mapping.verticalRef).lean() : null,
    ]);

    if (!seller || !vertical) {
      return NextResponse.json({ message: "Vertical mapping references are invalid." }, { status: 400 });
    }

    const mappingFields = (mapping.fields as MappingFieldDoc[] | undefined) ?? [];
    const fields = getEffectiveMappingFields(
      (vertical.fields as VerticalFieldDoc[] | undefined) ?? [],
      mappingFields
    ).map(toDocumentationField);

    if (fields.length === 0) {
      return NextResponse.json(
        { message: "No field configuration found for this API mapping." },
        { status: 400 }
      );
    }

    const intakeSettings = toMappingIntakeSettings(mapping.toObject(), mappingFields);

    return NextResponse.json({
      sellerName: seller.name,
      verticalName: vertical.name,
      endpointUrl: buildFullEndpointUrl(baseUrl, apiRequest.url),
      apiKey: apiRequest.apiKey,
      method: apiRequest.method,
      fields,
      intakeSettings,
    });
  } catch {
    return NextResponse.json({ message: "Failed to load API documentation content." }, { status: 500 });
  }
}
