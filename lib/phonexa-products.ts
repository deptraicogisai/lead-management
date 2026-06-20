import { connectToDatabase } from "@/lib/mongodb";
import { PhonexaProductModel } from "@/lib/models/phonexa-product";
import { findCatalogProduct } from "@/lib/phonexa-product-catalog";

const PHONEXA_PRODUCT_API_URL = "https://developers.phonexa.com/get_products.php";

export type PhonexaProductField = {
  fieldName: string;
  required: string;
  description: string;
  format: string | null;
  example: string | null;
  options: Record<string, string> | null;
};

export type PhonexaProductDocument = {
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
  codeSnippets: Array<{
    language: string;
    request: string | null;
    response: string | null;
  }>;
  syncedAt: string;
  fromCache: boolean;
};

type RawPhonexaField = {
  inputName?: string;
  required?: string;
  description?: string;
  format?: string | null;
  example?: string | null;
  options?: Record<string, string> | null;
};

type RawPhonexaResponse = {
  response?: {
    data?: Record<string, RawPhonexaField>;
    pingData?: RawPhonexaField[];
    pingpostData?: RawPhonexaField[];
    requestLinks?: Record<string, string>;
    requestSamples?: Record<string, Record<string, string>>;
    responseSamples?: Record<string, string>;
    requestSample?: Record<string, Record<string, string>> | Record<string, string> | string;
    responseSample?: Record<string, string> | string;
  };
  code?: number;
  status?: number;
};

function normalizeRequestSamples(value: unknown): Record<string, Record<string, string>> | null {
  if (!value || typeof value !== "object") return null;

  const input = value as Record<string, unknown>;
  const normalized: Record<string, Record<string, string>> = {};

  for (const [language, sample] of Object.entries(input)) {
    if (!sample) continue;

    if (typeof sample === "string") {
      normalized[language] = { sample };
      continue;
    }

    if (typeof sample !== "object") continue;

    const sampleObject = sample as Record<string, unknown>;
    const entries = Object.entries(sampleObject).filter(([, content]) => typeof content === "string");
    if (entries.length === 0) continue;
    normalized[language] = Object.fromEntries(entries) as Record<string, string>;
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

function normalizeResponseSamples(value: unknown): Record<string, string> | null {
  if (!value) return null;

  if (typeof value === "string") {
    return { default: value };
  }

  if (typeof value !== "object") return null;
  const entries = Object.entries(value as Record<string, unknown>).filter(([, content]) => typeof content === "string");
  if (entries.length === 0) return null;
  return Object.fromEntries(entries) as Record<string, string>;
}

function buildCodeSnippets(
  requestSamples: Record<string, Record<string, string>> | null,
  responseSamples: Record<string, string> | null
) {
  const languages = new Set<string>([
    ...Object.keys(requestSamples ?? {}),
    ...Object.keys(responseSamples ?? {}),
  ]);

  return [...languages]
    .sort((left, right) => left.localeCompare(right))
    .map((language) => ({
      language,
      request: requestSamples?.[language]
        ? Object.entries(requestSamples[language])
            .map(([key, value]) => `${key}:\n${value}`)
            .join("\n\n")
        : null,
      response: responseSamples?.[language] ?? null,
    }));
}

function parseFieldList(source: Record<string, RawPhonexaField> | RawPhonexaField[] | undefined) {
  if (!source) return [];

  const values = Array.isArray(source) ? source : Object.values(source);

  return values
    .filter((field): field is RawPhonexaField => Boolean(field?.inputName))
    .map((field) => ({
      fieldName: field.inputName!.trim(),
      required: field.required?.trim() || "NO",
      description: field.description?.trim() || "",
      format: field.format?.trim() || null,
      example: field.example?.trim() || null,
      options: field.options && typeof field.options === "object" ? field.options : null,
    }));
}

function toDocumentResponse(
  doc: {
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
  },
  fromCache: boolean
): PhonexaProductDocument {
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
    codeSnippets: buildCodeSnippets(doc.requestSamples ?? null, doc.responseSamples ?? null),
    syncedAt: doc.syncedAt.toISOString(),
    fromCache,
  };
}

async function fetchFromPhonexaApi(productId: number) {
  const response = await fetch(`${PHONEXA_PRODUCT_API_URL}?type=product&id=${productId}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`Phonexa API returned status ${response.status}.`);
  }

  const payload = (await response.json()) as RawPhonexaResponse;
  if (!payload.response?.data) {
    throw new Error("Phonexa API response is missing product data.");
  }

  return payload.response;
}

export async function getPhonexaProductDocument(
  productId: number,
  options: { forceRefresh?: boolean } = {}
): Promise<PhonexaProductDocument> {
  const catalogProduct = findCatalogProduct(productId);
  if (!catalogProduct) {
    throw new Error("Product is not in the documentation catalog.");
  }

  await connectToDatabase();

  if (!options.forceRefresh) {
    const cached = await PhonexaProductModel.findOne({ productId }).lean();
    if (cached) {
      return toDocumentResponse(cached, true);
    }
  }

  const remote = await fetchFromPhonexaApi(productId);
  const syncedAt = new Date();
  const requestSamples = normalizeRequestSamples(remote.requestSamples ?? remote.requestSample ?? null);
  const responseSamples = normalizeResponseSamples(remote.responseSamples ?? remote.responseSample ?? null);
  const document = {
    productId,
    name: catalogProduct.name,
    category: catalogProduct.category,
    postingUrl: remote.requestLinks?.post ?? remote.requestLinks?.fullpost ?? null,
    requestLinks: remote.requestLinks ?? null,
    fields: parseFieldList(remote.data),
    pingData: parseFieldList(remote.pingData),
    pingpostData: parseFieldList(remote.pingpostData),
    requestSamples,
    responseSamples,
    syncedAt,
  };

  const saved = await PhonexaProductModel.findOneAndUpdate({ productId }, document, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  }).lean();

  if (!saved) {
    throw new Error("Unable to save product documentation.");
  }

  return toDocumentResponse(saved, false);
}

export async function syncAllPhonexaProducts() {
  const { getAllCatalogProductIds } = await import("@/lib/phonexa-product-catalog");
  const productIds = getAllCatalogProductIds();
  const results: Array<{ productId: number; status: "synced" | "failed"; message?: string }> = [];

  for (const productId of productIds) {
    try {
      await getPhonexaProductDocument(productId, { forceRefresh: true });
      results.push({ productId, status: "synced" });
    } catch (error) {
      results.push({
        productId,
        status: "failed",
        message: error instanceof Error ? error.message : "Sync failed.",
      });
    }
  }

  return {
    total: productIds.length,
    synced: results.filter((item) => item.status === "synced").length,
    failed: results.filter((item) => item.status === "failed").length,
    results,
  };
}
