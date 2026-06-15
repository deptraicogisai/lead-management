import { connectToDatabase } from "@/lib/mongodb";
import { PhonexaProductModel } from "@/lib/models/phonexa-product";
import { PHONEXA_PRODUCT_CATALOG } from "@/lib/phonexa-product-catalog";
import type { PhonexaProductField } from "@/lib/phonexa-products";

export type PhonexaExportProduct = {
  productId: number;
  name: string;
  category: string;
  postingUrl: string | null;
  requestLinks: Record<string, string> | null;
  fields: PhonexaProductField[];
  pingData: PhonexaProductField[];
  pingpostData: PhonexaProductField[];
  requestSamples: Record<string, Record<string, string>> | null;
  responseSamples: Record<string, string> | null;
  syncedAt: string;
};

export type PhonexaDocumentsExportPayload = {
  exportedAt: string;
  productCount: number;
  products: PhonexaExportProduct[];
};

type ProductDoc = {
  productId: number;
  name: string;
  category: string;
  postingUrl?: string | null;
  requestLinks?: Record<string, string> | null;
  fields?: PhonexaProductField[];
  pingData?: PhonexaProductField[];
  pingpostData?: PhonexaProductField[];
  requestSamples?: Record<string, Record<string, string>> | null;
  responseSamples?: Record<string, string> | null;
  syncedAt: Date;
};

function toExportProduct(doc: ProductDoc): PhonexaExportProduct {
  return {
    productId: doc.productId,
    name: doc.name,
    category: doc.category,
    postingUrl: doc.postingUrl ?? null,
    requestLinks: doc.requestLinks ?? null,
    fields: doc.fields ?? [],
    pingData: doc.pingData ?? [],
    pingpostData: doc.pingpostData ?? [],
    requestSamples: doc.requestSamples ?? null,
    responseSamples: doc.responseSamples ?? null,
    syncedAt: doc.syncedAt.toISOString(),
  };
}

function getCatalogSortOrder() {
  const order = new Map<number, number>();
  let index = 0;

  for (const category of PHONEXA_PRODUCT_CATALOG) {
    for (const product of category.subCategories) {
      order.set(product.id, index);
      index += 1;
    }
  }

  return order;
}

function sortProductsByCatalog<T extends { productId: number }>(products: T[]) {
  const order = getCatalogSortOrder();

  return [...products].sort((left, right) => {
    const leftOrder = order.get(left.productId) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = order.get(right.productId) ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder;
  });
}

export async function loadAllPhonexaExportProducts() {
  await connectToDatabase();
  const products = await PhonexaProductModel.find().lean();
  return sortProductsByCatalog(products.map((product) => toExportProduct(product as ProductDoc)));
}

export function buildPhonexaDocumentsJsonExport(products: PhonexaExportProduct[]): PhonexaDocumentsExportPayload {
  return {
    exportedAt: new Date().toISOString(),
    productCount: products.length,
    products,
  };
}
