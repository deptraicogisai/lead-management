import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import { BuyerModel } from "@/lib/models/buyer";
import { BuyerRequestLogModel } from "@/lib/models/buyer-request-log";
import { ensureSellerCollectionMigrated, SellerModel } from "@/lib/models/seller";
import { ensureSellerLeadReferencesMigrated, SellerLeadModel } from "@/lib/models/seller-lead";
import { ensureVerticalMappingReferencesMigrated, VerticalMappingModel } from "@/lib/models/vertical-mapping";
import { getEffectiveMappingFields } from "@/lib/mapping-fields";
import type { MappingFieldDoc } from "@/lib/mapping-field-api";
import {
  buildDuplicateExistsQuery,
  buildLeadRejectResponse,
  validateMappingFieldConfiguration,
  validateMappingIntakeSettings,
} from "@/lib/mapping-lead-validation";
import { toMappingIntakeSettings } from "@/lib/mapping-intake-settings";

type Params = { params: Promise<{ sellerId: string }> };

type MappingApiField = {
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

type VerticalApiField = {
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

type MappingApiRequest = {
  apiKey: string;
  url: string;
  method: string;
};

type SellerMapping = {
  _id?: { toString(): string };
  verticalRef?: { toString(): string } | string;
  fields?: MappingApiField[];
  apiRequest?: MappingApiRequest | null;
  timezone?: string | null;
  duplicates?: {
    duplicateMethod?: "Email" | "SSN + Email";
    duplicateSold?: string;
    duplicatePosted?: string;
  } | null;
  generalFilters?: Array<{
    fieldId: string;
    fieldName: string;
    description: string;
    dataTypeFilter: "Text" | "Range" | "Checkbox";
    enabled?: boolean;
    minValue?: string | null;
    maxValue?: string | null;
    selectedValues?: string[] | null;
    textValue?: string | null;
  }> | null;
  scheduleRules?: Array<{
    _id?: { toString(): string };
    active?: boolean;
    action?: "Post" | "Do not post";
    scheduleMethod?: "Days";
    days?: string[];
    startHour?: string;
    startMinute?: string;
    endHour?: string;
    endMinute?: string;
    dailySoldLeadsLimit?: number | null;
    dailyPostLeadsLimit?: number | null;
  }> | null;
};

type BuyerMappingField = {
  source: string;
  destination: string;
};

type BuyerDoc = {
  _id?: { toString(): string };
  company: string;
  verticalRef?: { toString(): string } | string | null;
  apiKey: string;
  postLeadUrl: string;
  status: "Active" | "Paused";
  mappings?: BuyerMappingField[];
};

type RefValue = { toString(): string } | string | null | undefined;

function normalizeRef(value?: RefValue) {
  if (!value) {
    return undefined;
  }

  return typeof value === "string" ? value : value.toString();
}

function isMissingRequired(value: unknown) {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

function isValidByType(type: string, value: unknown) {
  const normalizedType = type.toLowerCase();
  if (normalizedType === "string") return typeof value === "string";
  if (normalizedType === "email") return typeof value === "string";
  if (normalizedType === "boolean") return typeof value === "boolean";
  if (normalizedType === "numberic" || normalizedType === "numeric" || normalizedType === "number") {
    return typeof value === "number" && !Number.isNaN(value);
  }
  if (normalizedType === "date") {
    if (value instanceof Date) return !Number.isNaN(value.getTime());
    if (typeof value === "string") return !Number.isNaN(Date.parse(value));
    return false;
  }
  return true;
}

function isValidByFormat(format: string | undefined, value: unknown) {
  if (value === undefined || value === null || format === undefined) return true;
  if (typeof value !== "string") return false;

  const normalized = format.trim().toLowerCase();
  if (normalized === "email") {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
  if (normalized === "e.164") {
    return /^\+[1-9]\d{1,14}$/.test(value);
  }
  return true;
}

function isPresentValue(value: unknown) {
  return value !== undefined && value !== null && !(typeof value === "string" && value.trim() === "");
}

function normalizeComparableValue(value: unknown) {
  if (typeof value === "string") {
    return value.trim().toLowerCase();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim().toLowerCase();
  }

  return "";
}

function isIgnoredFieldValue(value: unknown, ignoreValues?: string[]) {
  const comparableValue = normalizeComparableValue(value);
  if (!comparableValue) {
    return false;
  }

  return (ignoreValues ?? []).some((item) => item.trim().toLowerCase() === comparableValue);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function violatesEmailDuplicateRule(
  mappingId: string,
  fieldName: string,
  value: unknown,
  rule?: {
    mode?: "days" | "forever" | null;
    days?: number | null;
  } | null
) {
  if (!rule?.mode || typeof value !== "string" || !value.trim()) {
    return false;
  }

  const filter: Record<string, unknown> = {
    mappingRef: mappingId,
    validationStatus: "success",
    [`payload.${fieldName}`]: {
      $regex: new RegExp(`^\\s*${escapeRegExp(value.trim())}\\s*$`, "i"),
    },
  };

  if (rule.mode === "days" && typeof rule.days === "number" && rule.days > 0) {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - rule.days);
    filter.postedAt = { $gte: thresholdDate };
  }

  const matchedLead = await SellerLeadModel.exists(filter);
  return Boolean(matchedLead);
}

function buildBuyerPayload(sourcePayload: Record<string, unknown>, buyer: BuyerDoc) {
  const payload: Record<string, unknown> = {
    apikey: buyer.apiKey,
  };

  for (const mapping of buyer.mappings ?? []) {
    const sourceKey = mapping.source?.trim();
    const destinationKey = mapping.destination?.trim();

    if (!sourceKey || !destinationKey) continue;

    const value = sourcePayload[sourceKey];
    if (!isPresentValue(value)) continue;

    payload[destinationKey] = value;
  }

  return payload;
}

function formatBuyerError(rawResponseText: string) {
  const trimmed = rawResponseText.trim();
  if (!trimmed) {
    return "Unknown buyer response error.";
  }

  try {
    const parsed = JSON.parse(trimmed) as {
      message?: string;
      error?: string;
      reasons?: Array<{ message?: string }>;
    };

    if (Array.isArray(parsed.reasons) && parsed.reasons.length > 0) {
      const messages = parsed.reasons
        .map((reason) => reason.message?.trim())
        .filter((message): message is string => Boolean(message));

      if (messages.length > 0) {
        return messages.join(" | ");
      }
    }

    if (typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message.trim();
    }

    if (typeof parsed.error === "string" && parsed.error.trim()) {
      return parsed.error.trim();
    }
  } catch {
    // Response is plain text; return a shortened version below.
  }

  return trimmed.length > 500 ? `${trimmed.slice(0, 500)}...` : trimmed;
}

function parseBuyerResult(responseOk: boolean, httpStatus: number, rawResponseText: string) {
  const trimmed = rawResponseText.trim();
  let deliveryStatus: "success" | "fail" = responseOk ? "success" : "fail";
  let message = trimmed;

  if (trimmed) {
    try {
      const parsed = JSON.parse(trimmed) as {
        msg?: string;
        descr?: string;
        description?: string;
        message?: string;
        error?: string;
        reasons?: Array<{ message?: string }>;
      };

      const normalizedMsg = parsed.msg?.trim().toLowerCase();
      if (normalizedMsg === "error" || normalizedMsg === "fail" || normalizedMsg === "failed") {
        deliveryStatus = "fail";
      } else if (normalizedMsg === "success" || normalizedMsg === "ok" || normalizedMsg === "passed") {
        deliveryStatus = "success";
      }

      const reasonMessages = Array.isArray(parsed.reasons)
        ? parsed.reasons
            .map((reason) => reason.message?.trim())
            .filter((reason): reason is string => Boolean(reason))
        : [];

      message =
        parsed.descr?.trim() ||
        parsed.description?.trim() ||
        parsed.message?.trim() ||
        parsed.error?.trim() ||
        (reasonMessages.length > 0 ? reasonMessages.join(" | ") : "") ||
        parsed.msg?.trim() ||
        trimmed;
    } catch {
      message = trimmed;
    }
  } else {
    message = responseOk ? "Buyer accepted the lead." : `Buyer returned HTTP ${httpStatus}.`;
  }

  return {
    deliveryStatus,
    message: message.length > 500 ? `${message.slice(0, 500)}...` : message,
  };
}

async function createSellerIntakeLog(params: {
  sellerRef?: RefValue;
  verticalRef?: RefValue;
  endpointUrl: string;
  requestPayload: unknown;
  responseBody: string;
  errorMessage?: string;
  deliveryStatus: "success" | "fail";
  httpStatus: number;
}) {
  await BuyerRequestLogModel.create({
    requestType: "seller-intake",
    sellerRef: normalizeRef(params.sellerRef),
    verticalRef: normalizeRef(params.verticalRef),
    buyerCompany: "",
    targetName: "Seller Intake API",
    postLeadUrl: params.endpointUrl,
    requestPayload: params.requestPayload,
    responseBody: params.responseBody,
    errorMessage: params.errorMessage ?? "",
    deliveryStatus: params.deliveryStatus,
    httpStatus: params.httpStatus,
  });
}

export async function POST(req: Request, context: Params) {
  let requestPayloadForLog: unknown = {};
  let endpointUrl = "";
  let sellerRefForLog: RefValue;
  let verticalRefForLog: RefValue;

  try {
    const { sellerId } = await context.params;
    const body = (await req.json()) as unknown;
    requestPayloadForLog = body;
    const postedAt = new Date();
    const userAgent = req.headers.get("user-agent")?.trim() || "Unknown";
    endpointUrl = new URL(req.url).pathname;
    const requestApiKey =
      req.headers.get("x-api-key")?.trim() ||
      (typeof (body as Record<string, unknown>)?.api_key === "string" ? ((body as Record<string, unknown>).api_key as string).trim() : "") ||
      (typeof (body as Record<string, unknown>)?.apikey === "string" ? ((body as Record<string, unknown>).apikey as string).trim() : "");

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      await connectToDatabase();

      const responsePayload = {
        status: "error",
        reasons: [{ message: "Payload must be a JSON object." }],
      };

      await createSellerIntakeLog({
        endpointUrl,
        requestPayload: body,
        responseBody: JSON.stringify(responsePayload),
        errorMessage: responsePayload.reasons[0].message,
        deliveryStatus: "fail",
        httpStatus: 400,
      });

      return NextResponse.json(responsePayload, { status: 400 });
    }

    const payload = body as Record<string, unknown>;

    await connectToDatabase();
    await ensureSellerCollectionMigrated();
    await ensureVerticalCollectionMigrated();
    await ensureVerticalMappingReferencesMigrated();
    await ensureSellerLeadReferencesMigrated();

    if (!Types.ObjectId.isValid(sellerId)) {
      const responsePayload = {
        status: "error",
        reasons: [{ message: "Seller not found." }],
      };

      await createSellerIntakeLog({
        endpointUrl,
        requestPayload: payload,
        responseBody: JSON.stringify(responsePayload),
        errorMessage: responsePayload.reasons[0].message,
        deliveryStatus: "fail",
        httpStatus: 404,
      });

      return NextResponse.json(responsePayload, { status: 404 });
    }

    const seller = await SellerModel.findById(sellerId).lean();
    if (!seller) {
      const responsePayload = {
        status: "error",
        reasons: [{ message: "Seller not found." }],
      };

      await createSellerIntakeLog({
        endpointUrl,
        requestPayload: body,
        responseBody: JSON.stringify(responsePayload),
        errorMessage: responsePayload.reasons[0].message,
        deliveryStatus: "fail",
        httpStatus: 404,
      });

      return NextResponse.json(responsePayload, { status: 404 });
    }
    sellerRefForLog = seller._id;

    if (!requestApiKey) {
      const responsePayload = {
        status: "error" as const,
        reasons: [{ message: "Authentication failed. API key is required." }],
      };

      await createSellerIntakeLog({
        sellerRef: seller._id,
        endpointUrl,
        requestPayload: body,
        responseBody: JSON.stringify(responsePayload),
        errorMessage: responsePayload.reasons[0].message,
        deliveryStatus: "fail",
        httpStatus: 401,
      });

      return NextResponse.json(responsePayload, { status: 401 });
    }

    const matchedMapping = await VerticalMappingModel.findOne({
      sellerRef: seller._id,
      "apiRequest.apiKey": requestApiKey,
    }).lean() as SellerMapping | null;

    if (!matchedMapping) {
      const responsePayload = {
        status: "error" as const,
        reasons: [{ message: "Authentication failed. Invalid API key." }],
      };

      await createSellerIntakeLog({
        sellerRef: seller._id,
        endpointUrl,
        requestPayload: body,
        responseBody: JSON.stringify(responsePayload),
        errorMessage: responsePayload.reasons[0].message,
        deliveryStatus: "fail",
        httpStatus: 401,
      });

      return NextResponse.json(responsePayload, { status: 401 });
    }

    const verticalRefId = matchedMapping.verticalRef?.toString() ?? "";
    const vertical = verticalRefId && Types.ObjectId.isValid(verticalRefId)
      ? await VerticalModel.findById(verticalRefId).lean()
      : null;
    verticalRefForLog = vertical?._id;
    const apiFields = getEffectiveMappingFields(
      (vertical?.fields as VerticalApiField[] | undefined) ?? [],
      (matchedMapping.fields as MappingApiField[] | undefined) ?? []
    );

    if (apiFields.length === 0) {
      const responsePayload = buildLeadRejectResponse(["API mapping does not have any configured fields."]);

      await createSellerIntakeLog({
        sellerRef: seller._id,
        verticalRef: vertical?._id,
        endpointUrl,
        requestPayload: body,
        responseBody: JSON.stringify(responsePayload),
        errorMessage: responsePayload.reasons[0].message,
        deliveryStatus: "fail",
        httpStatus: 400,
      });

      return NextResponse.json(responsePayload, { status: 400 });
    }

    const mappingId = matchedMapping._id?.toString() ?? "";
    const mappingFields = (matchedMapping.fields ?? []) as MappingFieldDoc[];

    const fieldReasons = await validateMappingFieldConfiguration(
      payload,
      apiFields,
      async (fieldName, value, rule) =>
        violatesEmailDuplicateRule(mappingId, fieldName, value, rule ?? undefined)
    );

    const intakeSettings = toMappingIntakeSettings(
      matchedMapping as Parameters<typeof toMappingIntakeSettings>[0],
      mappingFields
    );

    const intakeReasons = await validateMappingIntakeSettings({
      mappingId,
      payload,
      settings: intakeSettings,
      fields: mappingFields,
      postedAt,
      checkDuplicate: async (targetMappingId, duplicateKey, periodDays, validationStatus) => {
        if (!duplicateKey || !Types.ObjectId.isValid(targetMappingId)) return false;

        const threshold = new Date(postedAt);
        threshold.setDate(threshold.getDate() - periodDays);

        const identityQuery = buildDuplicateExistsQuery(payload, mappingFields, duplicateKey);
        if (!identityQuery) return false;

        const baseFilter: Record<string, unknown> = {
          mappingRef: new Types.ObjectId(targetMappingId),
          postedAt: { $gte: threshold },
          ...identityQuery,
        };

        if (validationStatus) {
          baseFilter.validationStatus = validationStatus;
        }

        return Boolean(await SellerLeadModel.exists(baseFilter));
      },
      countLeads: async (targetMappingId, from, to, validationStatus) => {
        if (!Types.ObjectId.isValid(targetMappingId)) return 0;

        const filter: Record<string, unknown> = {
          mappingRef: new Types.ObjectId(targetMappingId),
          postedAt: { $gte: from, $lt: to },
        };

        if (validationStatus) {
          filter.validationStatus = validationStatus;
        }

        return SellerLeadModel.countDocuments(filter);
      },
    });

    const reasons = [...fieldReasons, ...intakeReasons];

    const validationStatus = reasons.length === 0 ? "success" : "fail";
    const createdLead = await SellerLeadModel.create({
      sellerRef: seller._id,
      verticalRef: vertical?._id,
      mappingRef: matchedMapping._id,
      payload,
      validationStatus,
      validationErrors: reasons,
      postedAt,
      userAgent,
    });

    if (validationStatus === "fail") {
      const responsePayload = buildLeadRejectResponse(reasons);

      await createSellerIntakeLog({
        sellerRef: seller._id,
        verticalRef: vertical?._id,
        endpointUrl,
        requestPayload: payload,
        responseBody: JSON.stringify(responsePayload),
        errorMessage: reasons.join(" | "),
        deliveryStatus: "fail",
        httpStatus: 400,
      });

      return NextResponse.json(responsePayload, { status: 400 });
    }

    const leadId = createdLead._id?.toString() ?? "";
    const responsePayload = {
      status: 1,
      status_text: "sold",
      redirect_url: `${new URL(req.url).origin}/reports/publisher/lead-details?leadId=${encodeURIComponent(leadId)}`,
    };

    await createSellerIntakeLog({
      sellerRef: seller._id,
      verticalRef: vertical?._id,
      endpointUrl,
      requestPayload: payload,
      responseBody: JSON.stringify(responsePayload),
      deliveryStatus: "success",
      httpStatus: 200,
    });

    return NextResponse.json(responsePayload);
  } catch {
    const responsePayload = {
      status: "error",
      reasons: [{ message: "Unexpected server error while processing lead." }],
    };

    try {
      await connectToDatabase();
      await createSellerIntakeLog({
        sellerRef: sellerRefForLog,
        verticalRef: verticalRefForLog,
        endpointUrl: endpointUrl || new URL(req.url).pathname,
        requestPayload: requestPayloadForLog,
        responseBody: JSON.stringify(responsePayload),
        errorMessage: responsePayload.reasons[0].message,
        deliveryStatus: "fail",
        httpStatus: 500,
      });
    } catch {
      // Ignore secondary logging failures so the original 500 response still returns.
    }

    return NextResponse.json(responsePayload, { status: 500 });
  }
}
