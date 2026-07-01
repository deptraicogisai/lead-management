import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { toCampaignTestLeadFields } from "@/lib/campaign-test-lead";
import { clearCampaignTestLeadLogs, listCampaignTestLeadLogs } from "@/lib/campaign-test-lead-log";
import { runCampaignTestLeadSubmit } from "@/lib/campaign-test-lead-submit";
import { CampaignModel } from "@/lib/models/campaign";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import { connectToDatabase } from "@/lib/mongodb";
import { toVerticalFieldResponse } from "@/lib/vertical-field-api";

type Params = { params: Promise<{ id: string }> };

type TestLeadSubmitPayload = {
  payload?: Record<string, unknown>;
};

async function loadCampaignTestLeadContext(campaignId: string) {
  if (!Types.ObjectId.isValid(campaignId)) {
    return null;
  }

  await connectToDatabase();
  await ensureVerticalCollectionMigrated();

  const campaign = await CampaignModel.findById(campaignId).lean();
  if (!campaign) {
    return null;
  }

  const verticalId = campaign.verticalRef?.toString() ?? "";
  const vertical = verticalId ? await VerticalModel.findById(verticalId).lean() : null;
  const verticalFields = Array.isArray(vertical?.fields)
    ? vertical.fields.map((field) => toVerticalFieldResponse(field))
    : [];

  return {
    campaign,
    fields: toCampaignTestLeadFields(verticalFields),
    integrationId: campaign.integrationRef?.toString() ?? "",
  };
}

export async function GET(_: Request, context: Params) {
  try {
    const { id } = await context.params;
    const loaded = await loadCampaignTestLeadContext(id);

    if (!loaded) {
      return NextResponse.json({ message: "Campaign not found." }, { status: 404 });
    }

    const logs = await listCampaignTestLeadLogs(id);

    return NextResponse.json({
      fields: loaded.fields,
      integrationConfigured: Boolean(loaded.integrationId),
      logs,
    });
  } catch {
    return NextResponse.json({ message: "Failed to load campaign test lead settings." }, { status: 500 });
  }
}

export async function POST(req: Request, context: Params) {
  try {
    const { id } = await context.params;
    const body = (await req.json().catch(() => null)) as TestLeadSubmitPayload | null;
    const payload = body?.payload;

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json({ message: "Payload must be a JSON object." }, { status: 400 });
    }

    const loaded = await loadCampaignTestLeadContext(id);
    if (!loaded) {
      return NextResponse.json({ message: "Campaign not found." }, { status: 404 });
    }

    if (!loaded.integrationId) {
      return NextResponse.json({ message: "Integration is not configured on this campaign." }, { status: 400 });
    }

    const result = await runCampaignTestLeadSubmit({
      campaignId: id,
      payload,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          message: result.message,
          log: result.log ?? null,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: "Test lead sent to buyer.",
      log: result.log,
    });
  } catch {
    return NextResponse.json({ message: "Failed to submit campaign test lead." }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: Params) {
  try {
    const { id } = await context.params;
    const loaded = await loadCampaignTestLeadContext(id);

    if (!loaded) {
      return NextResponse.json({ message: "Campaign not found." }, { status: 404 });
    }

    const cleared = await clearCampaignTestLeadLogs(id);
    return NextResponse.json({ deletedCount: cleared.deletedCount, message: "Logs cleared." });
  } catch {
    return NextResponse.json({ message: "Failed to clear campaign test lead logs." }, { status: 500 });
  }
}
