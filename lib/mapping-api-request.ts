import { randomBytes } from "crypto";

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

  const apiRequest: MappingApiRequest = {
    apiKey: randomBytes(16).toString("hex").toUpperCase(),
    url: `/api/${sellerRef}/lead`,
    method: "POST",
  };

  mapping.apiRequest = apiRequest;
  await mapping.save();

  return apiRequest;
}
