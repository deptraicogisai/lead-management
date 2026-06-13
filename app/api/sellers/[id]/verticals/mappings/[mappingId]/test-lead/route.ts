import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import { ensureVerticalMappingReferencesMigrated } from "@/lib/models/vertical-mapping";
import { ensureMappingApiRequest, PUBLISHER_LEAD_ENDPOINT_PATH } from "@/lib/mapping-api-request";
import { runMappingTestLeadSubmit } from "@/lib/mapping-lead-intake";
import { listMappingTestLeadLogs } from "@/lib/mapping-test-lead-log";
import { buildTestLeadIntakeRuleGroups, buildTestLeadMultiSelectFilters } from "@/lib/mapping-test-lead-intake";
import { toMappingIntakeSettings } from "@/lib/mapping-intake-settings";
import type { MappingFieldDoc } from "@/lib/mapping-field-api";
import { ensureSellerVerticalMappingFieldsSeededById } from "@/lib/seller-vertical-mapping";
import { ensureSellerCollectionMigrated, SellerModel } from "@/lib/models/seller";

type Params = { params: Promise<{ id: string; mappingId: string }> };

type TestLeadSubmitPayload = {
  payload?: Record<string, unknown>;
  saveLead?: boolean;
};

async function loadMappingContext(sellerId: string, mappingId: string) {
  await connectToDatabase();
  await ensureVerticalCollectionMigrated();
  await ensureVerticalMappingReferencesMigrated();
  await ensureSellerCollectionMigrated();

  const seeded = await ensureSellerVerticalMappingFieldsSeededById(sellerId, mappingId);
  if (!seeded) {
    return null;
  }

  const mapping = seeded.mapping;
  const mappingFields = (seeded.mappingFields as MappingFieldDoc[] | undefined) ?? [];
  const verticalRefId = mapping.verticalRef?.toString() ?? "";
  const vertical = verticalRefId ? await VerticalModel.findById(verticalRefId).lean() : null;
  const intakeSettings = toMappingIntakeSettings(mapping.toObject(), mappingFields);
  const intakeRules = buildTestLeadIntakeRuleGroups(intakeSettings);
  const multiSelectFilters = buildTestLeadMultiSelectFilters(intakeSettings);

  const seller = Types.ObjectId.isValid(sellerId) ? await SellerModel.findById(sellerId).lean() : null;

  return {
    mapping,
    mappingFields,
    vertical,
    intakeSettings,
    intakeRules,
    multiSelectFilters,
    seller,
  };
}

export async function GET(_: Request, context: Params) {
  try {
    const { id, mappingId } = await context.params;
    const loaded = await loadMappingContext(id, mappingId);

    if (!loaded) {
      return NextResponse.json({ message: "Seller API not found." }, { status: 404 });
    }

    const apiRequest = await ensureMappingApiRequest(loaded.mapping);
    if (!apiRequest) {
      return NextResponse.json({ message: "API key is not available for this mapping." }, { status: 404 });
    }

    const logs = await listMappingTestLeadLogs(mappingId);

    return NextResponse.json({
      endpointUrl: PUBLISHER_LEAD_ENDPOINT_PATH,
      apiKey: apiRequest.apiKey,
      method: apiRequest.method,
      intakeRules: loaded.intakeRules,
      multiSelectFilters: loaded.multiSelectFilters,
      timezone: loaded.intakeSettings.timezone,
      logs,
    });
  } catch {
    return NextResponse.json({ message: "Failed to load test lead settings." }, { status: 500 });
  }
}

export async function POST(req: Request, context: Params) {
  try {
    const { id, mappingId } = await context.params;
    const body = (await req.json().catch(() => null)) as TestLeadSubmitPayload | null;
    const payload = body?.payload;
    const saveLead = Boolean(body?.saveLead);

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json({ message: "Payload must be a JSON object." }, { status: 400 });
    }

    const loaded = await loadMappingContext(id, mappingId);
    if (!loaded || !loaded.seller?._id || !loaded.mapping._id) {
      return NextResponse.json({ message: "Seller API not found." }, { status: 404 });
    }

    const result = await runMappingTestLeadSubmit({
      sellerId: id,
      mappingId,
      mappingDoc: loaded.mapping.toObject(),
      verticalFields: (loaded.vertical?.fields as Parameters<typeof runMappingTestLeadSubmit>[0]["verticalFields"]) ?? [],
      mappingFields: loaded.mappingFields as Parameters<typeof runMappingTestLeadSubmit>[0]["mappingFields"],
      sellerRef: loaded.seller._id,
      verticalRef: loaded.vertical?._id,
      mappingRef: loaded.mapping._id,
      payload,
      saveLead,
      endpointUrl: PUBLISHER_LEAD_ENDPOINT_PATH,
      userAgent: req.headers.get("user-agent")?.trim() || "Test Lead UI",
    });

    return NextResponse.json({
      passed: result.passed,
      checks: result.checks,
      reasons: result.reasons,
      status: result.status,
      responseBody: result.responseBody,
      leadSaved: result.leadSaved,
      saveLead,
      log: result.log,
    });
  } catch {
    return NextResponse.json({ message: "Failed to submit test lead." }, { status: 500 });
  }
}
