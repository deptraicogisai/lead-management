import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { PhonexaProductModel } from "@/lib/models/phonexa-product";
import { isDocumentsInitialSyncNeeded } from "@/lib/models/phonexa-sync-state";
import { PHONEXA_PRODUCT_CATALOG } from "@/lib/phonexa-product-catalog";

export async function GET() {
  try {
    await connectToDatabase();
    const cachedProducts = await PhonexaProductModel.find({}, { productId: 1 }).lean();
    const cachedIds = new Set(cachedProducts.map((item) => item.productId));

    const totalCount = PHONEXA_PRODUCT_CATALOG.reduce(
      (count, category) => count + category.subCategories.length,
      0
    );

    const catalog = PHONEXA_PRODUCT_CATALOG.map((category) => ({
      category: category.category,
      subCategories: category.subCategories.map((product) => ({
        id: product.id,
        name: product.name,
        cached: cachedIds.has(product.id),
      })),
    }));

    const needsInitialSync = await isDocumentsInitialSyncNeeded();

    return NextResponse.json({
      catalog,
      cachedCount: cachedIds.size,
      totalCount,
      needsInitialSync,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to load documentation catalog." },
      { status: 500 }
    );
  }
}
