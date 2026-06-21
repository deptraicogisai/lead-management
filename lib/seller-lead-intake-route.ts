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
import { buildLeadRejectResponse } from "@/lib/mapping-lead-validation";
import { validateMappingLeadIntake, type MappingIntakeDoc } from "@/lib/mapping-lead-intake";
import { distributeLeadAfterIntake } from "@/lib/lead-distribution";

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
  sellerRef?: { toString(): string } | string;
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
    dataTypeFilter: "Text" | "Range" | "Checkbox" | "Multi Select";
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

export async function handleSellerLeadPost(req: Request) {
  let requestPayloadForLog: unknown = {};
  let endpointUrl = "";
  let sellerRefForLog: RefValue;
  let verticalRefForLog: RefValue;

  try {
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

    if (!requestApiKey) {
      const responsePayload = {
        status: "error" as const,
        reasons: [{ message: "Authentication failed. API key is required." }],
      };

      await createSellerIntakeLog({
        endpointUrl,
        requestPayload: body,
        responseBody: JSON.stringify(responsePayload),
        errorMessage: responsePayload.reasons[0].message,
        deliveryStatus: "fail",
        httpStatus: 401,
      });

      return NextResponse.json(responsePayload, { status: 401 });
    }

    const matchedMapping = (await VerticalMappingModel.findOne({
      "apiRequest.apiKey": requestApiKey,
    }).lean()) as SellerMapping | null;

    if (!matchedMapping) {
      const responsePayload = {
        status: "error" as const,
        reasons: [{ message: "Authentication failed. Invalid API key." }],
      };

      await createSellerIntakeLog({
        endpointUrl,
        requestPayload: body,
        responseBody: JSON.stringify(responsePayload),
        errorMessage: responsePayload.reasons[0].message,
        deliveryStatus: "fail",
        httpStatus: 401,
      });

      return NextResponse.json(responsePayload, { status: 401 });
    }

    const sellerRefId = normalizeRef(matchedMapping.sellerRef as RefValue) ?? "";
    if (!Types.ObjectId.isValid(sellerRefId)) {
      const responsePayload = {
        status: "error",
        reasons: [{ message: "Publisher not found for this API key." }],
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

    const seller = await SellerModel.findById(sellerRefId).lean();
    if (!seller) {
      const responsePayload = {
        status: "error",
        reasons: [{ message: "Publisher not found for this API key." }],
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
    const validationResult = await validateMappingLeadIntake({
      mappingId,
      mappingDoc: matchedMapping as MappingIntakeDoc,
      verticalFields: (vertical?.fields as VerticalApiField[] | undefined) ?? [],
      mappingFields: (matchedMapping.fields as MappingApiField[] | undefined) ?? [],
      payload,
      postedAt,
    });

    const reasons = validationResult.allReasons;

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
    const origin = new URL(req.url).origin;

    const distribution = await distributeLeadAfterIntake({
      sellerLeadId: leadId,
      sellerRefId: seller._id.toString(),
      verticalRefId,
      payload,
      postedAt,
      origin,
    });

    let responsePayload: Record<string, unknown>;

    if (distribution.publisherStatus === "Sold") {
      responsePayload = {
        status: 1,
        status_text: "Accepted",
        redirect_url:
          distribution.redirectUrl ||
          `${origin}/reports/publisher/lead-details?leadId=${encodeURIComponent(leadId)}`,
        price: distribution.soldPrice,
        lead_id: leadId,
      };
    } else if (distribution.publisherStatus === "Test") {
      responsePayload = {
        status: 1,
        status_text: "Accepted",
        message: distribution.message,
        lead_id: leadId,
      };
    } else if (distribution.publisherStatus === "Post Error") {
      const postErrorDelivery = distribution.campaignDeliveries.find(
        (entry) => entry.buyerStatus === "Error" || entry.buyerStatus === "Timeout"
      );
      responsePayload = {
        status: "error",
        reasons: [{ message: distribution.message }],
        lead_id: leadId,
        ...(postErrorDelivery?.errorReason ? { buyer_post_error: postErrorDelivery.errorReason } : {}),
        ...(postErrorDelivery?.postLeadUrl ? { post_lead_url: postErrorDelivery.postLeadUrl } : {}),
        ...(postErrorDelivery?.httpStatus ? { buyer_http_status: postErrorDelivery.httpStatus } : {}),
      };
    } else {
      const redirectAttempt = distribution.campaignDeliveries.find(
        (entry) => entry.pingTreeType === "Redirect" && entry.buyerStatus !== "Skipped"
      );
      const primaryAttempt =
        redirectAttempt ??
        distribution.campaignDeliveries.find((entry) => entry.buyerStatus !== "Skipped");

      responsePayload = {
        status: 0,
        status_text: "Rejected",
        reasons: [{ message: distribution.message }],
        lead_id: leadId,
        ...(primaryAttempt?.rejectReason ? { buyer_reject_reason: primaryAttempt.rejectReason } : {}),
        ...(primaryAttempt?.buyerStatus ? { buyer_status: primaryAttempt.buyerStatus } : {}),
        ...(primaryAttempt?.responseBody
          ? { buyer_response: String(primaryAttempt.responseBody).slice(0, 500) }
          : {}),
      };
    }

    await createSellerIntakeLog({
      sellerRef: seller._id,
      verticalRef: vertical?._id,
      endpointUrl,
      requestPayload: payload,
      responseBody: JSON.stringify(responsePayload),
      deliveryStatus: distribution.publisherStatus === "Sold" || distribution.publisherStatus === "Test" ? "success" : "fail",
      httpStatus: distribution.publisherStatus === "Sold" || distribution.publisherStatus === "Test" ? 200 : 400,
    });

    const httpStatus =
      distribution.publisherStatus === "Sold" || distribution.publisherStatus === "Test"
        ? 200
        : distribution.publisherStatus === "Post Error"
          ? 502
          : 400;

    return NextResponse.json(responsePayload, { status: httpStatus });
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
