import { NextResponse } from "next/server";
import { getPhonexaProductDocument } from "@/lib/phonexa-products";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const productId = Number.parseInt(id, 10);

    if (!Number.isFinite(productId) || productId <= 0) {
      return NextResponse.json({ message: "Invalid product id." }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const forceRefresh = searchParams.get("refresh") === "1";

    const document = await getPhonexaProductDocument(productId, { forceRefresh });
    return NextResponse.json(document);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to load product documentation." },
      { status: 500 }
    );
  }
}
