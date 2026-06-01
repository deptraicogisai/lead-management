import { NextResponse } from "next/server";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import { connectToDatabase } from "@/lib/mongodb";
import { SellerModel } from "@/lib/models/seller";
import { ensureVerticalMappingReferencesMigrated, VerticalMappingModel } from "@/lib/models/vertical-mapping";
import { generateApiDocumentationPdfBuffer, type DocumentationField } from "@/lib/api-documentation";
import { getEffectiveMappingFields } from "@/lib/mapping-fields";
import { ensureMappingApiRequest } from "@/lib/mapping-api-request";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

type MappingFieldDoc = {
  _id?: { toString(): string };
  sourceVerticalFieldId?: string | null;
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
};

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
};

function toDocumentationField(field: {
  id: string;
  fieldName: string;
  description: string;
  type: string;
  required: boolean;
  format: string;
  emailDuplicateRule?: {
    mode: "days" | "forever";
    days?: number;
  };
  ignoreValues?: string[];
}): DocumentationField {
  return {
    id: field.id,
    fieldName: field.fieldName,
    description: field.description,
    type: field.type,
    required: field.required,
    format: field.format ?? "",
    emailDuplicateRule: field.emailDuplicateRule,
    ignoreValues: field.ignoreValues ?? [],
  };
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

export async function GET(req: Request, context: Params) {
  try {
    const { id } = await context.params;
    const requestUrl = new URL(req.url);
    const { searchParams } = requestUrl;
    const shouldDownload = searchParams.get("download") === "1";

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

    const verticalName = vertical.name;
    const fields = getEffectiveMappingFields(
      (vertical?.fields as VerticalFieldDoc[] | undefined) ?? [],
      (mapping.fields as MappingFieldDoc[] | undefined) ?? []
    ).map(toDocumentationField);

    if (fields.length === 0) {
      return NextResponse.json(
        { message: "No field configuration found for this API mapping." },
        { status: 400 }
      );
    }

    const pdfBuffer = await generateApiDocumentationPdfBuffer(
      {
        sellerId: seller.name,
        sellerName: seller.name,
        verticalId: vertical.name,
        verticalName,
        baseUrl: requestUrl.origin,
        endpointUrl: apiRequest.url,
        apiKey: apiRequest.apiKey,
        method: apiRequest.method,
      },
      fields
    );

    const fileName = `${sanitizeFileName(`api-documentation-${seller.name}-${vertical.name}`)}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${shouldDownload ? "attachment" : "inline"}; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to generate API documentation PDF", error);
    return NextResponse.json({ message: "Failed to generate API documentation." }, { status: 500 });
  }
}
