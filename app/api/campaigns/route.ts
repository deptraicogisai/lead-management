import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { buildCampaignLookupContext } from "@/lib/campaign-context";
import {
  buildGeneralFiltersFromVerticalFields,
  buildCampaignListStatusFilter,
  defaultCampaignDuplicates,
  toCampaignListRecord,
  toCampaignRecord,
  type CampaignStatus,
  type CampaignType,
} from "@/lib/campaign";
import { buildCampaignImportCreateData, buildCampaignImportName, parseCampaignImportSchema } from "@/lib/campaign-import";
import type { CampaignExportPayload } from "@/lib/campaign-export";
import { CampaignModel, ensureCampaignStatusMigrated, getNextCampaignDisplayId } from "@/lib/models/campaign";
import { BuyerModel, ensureBuyerFieldsMigrated } from "@/lib/models/buyer";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import { IntegrationBuilderModel } from "@/lib/models/integration-builder";
import { connectToDatabase } from "@/lib/mongodb";
import { normalizeSearchParam, parsePageParam } from "@/lib/pagination";
import { sortNewestDisplayIdFirst } from "@/lib/list-sort";
type CampaignPayload = {
  createType?: "new" | "import";
  importSchema?: CampaignExportPayload;
  name?: string;
  verticalId?: string;
  buyerId?: string;
  campaignType?: CampaignType;
  timezone?: string;
  minPrice?: number | string;
  status?: CampaignStatus;
};

function parsePageSize(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 15;
  return Math.min(parsed, 1000);
}

function parseDate(value: string | null) {
  if (!value?.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parsePageParam(searchParams.get("page"), 1);
    const pageSize = parsePageSize(searchParams.get("pageSize"));
    const idFilter = normalizeSearchParam(searchParams.get("id"));
    const nameFilter = normalizeSearchParam(searchParams.get("name"));
    const statusFilter = normalizeSearchParam(searchParams.get("status"));
    const productId = normalizeSearchParam(searchParams.get("productId"));
    const buyerId = normalizeSearchParam(searchParams.get("buyerId"));
    const integrationId = normalizeSearchParam(searchParams.get("integrationId"));
    const typeFilter = normalizeSearchParam(searchParams.get("type"));
    const dateFrom = parseDate(searchParams.get("dateFrom"));
    const dateTo = parseDate(searchParams.get("dateTo"));

    await connectToDatabase();
    await ensureCampaignStatusMigrated();

    const filter: Record<string, unknown> = {};

    if (idFilter && /^\d+$/.test(idFilter)) {
      filter.displayId = Number.parseInt(idFilter, 10);
    }

    if (nameFilter) {
      filter.name = { $regex: nameFilter, $options: "i" };
    }

    if (statusFilter) {
      Object.assign(filter, buildCampaignListStatusFilter(statusFilter));
    } else {
      Object.assign(filter, buildCampaignListStatusFilter("All"));
    }

    if (productId && Types.ObjectId.isValid(productId)) {
      filter.verticalRef = productId;
    }

    if (buyerId && Types.ObjectId.isValid(buyerId)) {
      filter.buyerRef = buyerId;
    }

    if (integrationId && Types.ObjectId.isValid(integrationId)) {
      filter.integrationRef = new Types.ObjectId(integrationId);
    }

    if (typeFilter && typeFilter !== "All") {
      filter.campaignType = typeFilter;
    }

    if (dateFrom || dateTo) {
      filter.createdAt = {
        ...(dateFrom ? { $gte: dateFrom } : {}),
        ...(dateTo ? { $lte: dateTo } : {}),
      };
    }

    const context = await buildCampaignLookupContext();
    const [totalItems, campaigns] = await Promise.all([
      CampaignModel.countDocuments(filter),
      CampaignModel.find(filter)
        .sort(sortNewestDisplayIdFirst)
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    const items = campaigns.map((campaign) =>
      toCampaignListRecord(toCampaignRecord(campaign, context))
    );

    return NextResponse.json({
      items,
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    });
  } catch (error) {
    console.error("Failed to fetch campaigns:", error);
    return NextResponse.json({ message: "Failed to fetch campaigns." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CampaignPayload;
    const isImport = body.createType === "import";

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    await ensureBuyerFieldsMigrated();

    const verticals = await VerticalModel.find().sort({ createdAt: 1 }).select({ _id: 1, name: 1, fields: 1 }).lean();
    const verticalIdsOldestFirst = verticals.map((vertical) => vertical._id.toString());

    if (isImport) {
      if (!body.importSchema) {
        return NextResponse.json({ message: "Import schema is required." }, { status: 400 });
      }

      const parsed = parseCampaignImportSchema(body.importSchema);
      if (!parsed.ok) {
        return NextResponse.json({ message: parsed.message }, { status: 400 });
      }

      let importData: ReturnType<typeof buildCampaignImportCreateData>;
      try {
        importData = buildCampaignImportCreateData(parsed.schema, verticalIdsOldestFirst);
      } catch (error) {
        return NextResponse.json(
          { message: error instanceof Error ? error.message : "Invalid import schema." },
          { status: 400 }
        );
      }

      const [buyer, integrationExists] = await Promise.all([
        BuyerModel.findById(importData.buyerRef).lean(),
        importData.integrationRef
          ? IntegrationBuilderModel.exists({ _id: importData.integrationRef })
          : Promise.resolve(true),
      ]);

      if (!buyer) {
        return NextResponse.json({ message: "Buyer in schema was not found." }, { status: 404 });
      }

      if (!integrationExists) {
        return NextResponse.json({ message: "Integration in schema was not found." }, { status: 404 });
      }

      const existingNames = await CampaignModel.find({}, { name: 1 }).lean();
      const displayId = await getNextCampaignDisplayId();
      const campaign = await CampaignModel.create({
        displayId,
        name: buildCampaignImportName(
          importData.name,
          existingNames.map((entry) => entry.name)
        ),
        status: "Active",
        verticalRef: importData.verticalRef,
        buyerRef: importData.buyerRef,
        integrationRef: importData.integrationRef,
        campaignType: importData.campaignType,
        timezone: importData.timezone,
        minPrice: importData.minPrice,
        duplicates: importData.duplicates,
        generalFilters: importData.generalFilters,
        plDnplListIds: importData.plDnplListIds,
        copyPlDnplToOtherCampaigns: importData.copyPlDnplToOtherCampaigns,
        scheduleRules: importData.scheduleRules,
        integrationSettings: importData.integrationSettings,
      });

      const context = await buildCampaignLookupContext();
      return NextResponse.json(toCampaignRecord(campaign.toObject(), context), { status: 201 });
    }

    if (!body.name?.trim()) {
      return NextResponse.json({ message: "Name is required." }, { status: 400 });
    }

    if (!body.verticalId?.trim() || !Types.ObjectId.isValid(body.verticalId.trim())) {
      return NextResponse.json({ message: "A valid product is required." }, { status: 400 });
    }

    if (!body.buyerId?.trim() || !Types.ObjectId.isValid(body.buyerId.trim())) {
      return NextResponse.json({ message: "A valid buyer is required." }, { status: 400 });
    }

    if (!body.campaignType || !["Redirect", "Silent"].includes(body.campaignType)) {
      return NextResponse.json({ message: "Campaign type is required." }, { status: 400 });
    }

    if (!body.timezone?.trim()) {
      return NextResponse.json({ message: "Timezone is required." }, { status: 400 });
    }

    const [vertical, buyer] = await Promise.all([
      VerticalModel.findById(body.verticalId.trim()).lean(),
      BuyerModel.findById(body.buyerId.trim()).lean(),
    ]);

    if (!vertical) {
      return NextResponse.json({ message: "Selected product was not found." }, { status: 404 });
    }

    if (!buyer) {
      return NextResponse.json({ message: "Selected buyer was not found." }, { status: 404 });
    }

    const minPrice = Number(body.minPrice ?? 0);
    const displayId = await getNextCampaignDisplayId();
    const generalFilters = buildGeneralFiltersFromVerticalFields(
      (vertical.fields ?? []).map((field) => ({
        _id: field._id,
        fieldName: field.fieldName,
        description: field.description,
        dataTypeFilter: field.dataTypeFilter,
      }))
    );

    const campaign = await CampaignModel.create({
      displayId,
      name: body.name.trim(),
      status: body.status ?? "Active",
      verticalRef: body.verticalId.trim(),
      buyerRef: body.buyerId.trim(),
      campaignType: body.campaignType,
      timezone: body.timezone.trim(),
      minPrice: Number.isFinite(minPrice) ? minPrice : 0,
      duplicates: defaultCampaignDuplicates(),
      generalFilters,
      plDnplListIds: [],
      scheduleRules: [],
    });

    const context = await buildCampaignLookupContext();

    return NextResponse.json(toCampaignRecord(campaign.toObject(), context), { status: 201 });
  } catch (error) {
    console.error("Failed to create campaign:", error);
    const message = error instanceof Error ? error.message : "Failed to create campaign.";
    return NextResponse.json({ message }, { status: 500 });
  }
}