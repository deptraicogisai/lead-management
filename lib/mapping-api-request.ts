import { randomBytes } from "crypto";
import { VerticalMappingModel } from "@/lib/models/vertical-mapping";

export type MappingApiRequest = {
  apiKey: string;
  url: string;
  method: string;
};

type MappingWithApiRequest = {
  sellerRef?: { toString(): string } | string | null;
  apiRequest?: Partial<MappingApiRequest> | null;
  save(): Promise<unknown>;
};

const MAX_API_KEY_ATTEMPTS = 8;

function buildApiKey() {
  return randomBytes(16).toString("hex").toUpperCase();
}

export function buildMappingApiRequest(sellerRef: string, apiKey = buildApiKey()): MappingApiRequest {
  return {
    apiKey,
    url: `/api/${sellerRef}/lead`,
    method: "POST",
  };
}

export async function generateUniqueMappingApiRequest(sellerRef: string): Promise<MappingApiRequest> {
  for (let attempt = 0; attempt < MAX_API_KEY_ATTEMPTS; attempt += 1) {
    const apiRequest = buildMappingApiRequest(sellerRef);
    const existing = await VerticalMappingModel.findOne({ "apiRequest.apiKey": apiRequest.apiKey })
      .select({ _id: 1 })
      .lean();

    if (!existing) {
      return apiRequest;
    }
  }

  throw new Error("UNIQUE_API_KEY_FAILED");
}

function isCompleteApiRequest(apiRequest: Partial<MappingApiRequest> | null | undefined): apiRequest is MappingApiRequest {
  return Boolean(apiRequest?.apiKey && apiRequest.url && apiRequest.method);
}

export async function ensureMappingApiRequest(mapping: MappingWithApiRequest) {
  if (isCompleteApiRequest(mapping.apiRequest)) {
    return mapping.apiRequest;
  }

  const sellerRef = typeof mapping.sellerRef === "string" ? mapping.sellerRef : mapping.sellerRef?.toString();
  if (!sellerRef) {
    return null;
  }

  for (let attempt = 0; attempt < MAX_API_KEY_ATTEMPTS; attempt += 1) {
    const apiRequest = await generateUniqueMappingApiRequest(sellerRef);
    mapping.apiRequest = apiRequest;

    try {
      await mapping.save();
      return apiRequest;
    } catch (error) {
      const isDuplicateKey =
        typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 11000;

      if (!isDuplicateKey || attempt === MAX_API_KEY_ATTEMPTS - 1) {
        throw error;
      }
    }
  }

  return null;
}
