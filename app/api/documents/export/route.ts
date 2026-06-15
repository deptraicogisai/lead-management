import { NextResponse } from "next/server";
import {
  buildPhonexaDocumentsJsonExport,
  loadAllPhonexaExportProducts,
} from "@/lib/phonexa-documents-export";

export const runtime = "nodejs";

function buildExportFileName() {
  const dateStamp = new Date().toISOString().slice(0, 10);
  return `phonexa-product-documents-${dateStamp}.json`;
}

export async function GET() {
  try {
    const products = await loadAllPhonexaExportProducts();

    if (products.length === 0) {
      return NextResponse.json(
        { message: "No documents in database. Please sync product documentation first." },
        { status: 400 }
      );
    }

    const payload = buildPhonexaDocumentsJsonExport(products);
    const json = JSON.stringify(payload, null, 2);
    const fileName = buildExportFileName();

    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to export Phonexa documents", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to export documents." },
      { status: 500 }
    );
  }
}
