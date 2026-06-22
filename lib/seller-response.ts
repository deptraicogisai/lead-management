import { normalizePublisherTag } from "@/lib/publisher-tag";

type SellerApiFieldDoc = {
  _id?: { toString(): string };
  fieldName: string;
  description: string;
  type: string;
  required: boolean;
  format?: string | null;
};

export type SellerDocInput = {
  _id?: { toString(): string };
  name: string;
  email: string;
  region?: string | null;
  publisherTag?: string | null;
  status: "Active" | "Inactive";
  createdAt?: Date | string;
  apiFields?: unknown;
};

export type SellerResponse = {
  id: string;
  displayId?: number;
  name: string;
  email: string;
  region: string;
  publisherTag: string;
  status: "Active" | "Inactive";
  createdAt: string | null;
  apiFields: Array<{
    id: string;
    fieldName: string;
    description: string;
    type: string;
    required: boolean;
    format?: string;
  }>;
};

function normalizeApiFields(apiFields: unknown) {
  if (!Array.isArray(apiFields)) {
    return [];
  }

  return apiFields.map((field) => {
    const row = field as SellerApiFieldDoc;

    return {
      id: row._id?.toString() ?? "",
      fieldName: row.fieldName,
      description: row.description,
      type: row.type,
      required: row.required,
      format: row.format ?? undefined,
    };
  });
}

export function toSellerResponse(doc: SellerDocInput, options?: { displayId?: number }): SellerResponse {
  const createdAt =
    doc.createdAt instanceof Date
      ? doc.createdAt.toISOString()
      : typeof doc.createdAt === "string"
        ? doc.createdAt
        : null;

  return {
    id: doc._id?.toString() ?? "",
    displayId: options?.displayId,
    name: doc.name,
    email: doc.email,
    region: doc.region?.trim() ?? "",
    publisherTag: normalizePublisherTag(doc.publisherTag),
    status: doc.status,
    createdAt,
    apiFields: normalizeApiFields(doc.apiFields),
  };
}
