import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import {
  toBuyerListRecord,
  type BuyerDoc,
  type BuyerStatus,
} from "@/lib/buyer";
import { sortNewestDisplayIdFirst } from "@/lib/list-sort";
import { BuyerModel, ensureBuyerFieldsMigrated } from "@/lib/models/buyer";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import {
  getAvailableIntegrationOptions,
  resolveBuyerIntegrations,
} from "@/lib/buyer-integrations";
import { normalizeSearchParam, parsePageParam, parsePageSizeParam } from "@/lib/pagination";
import { buildMongoStatusFilter, mergeMongoFilters } from "@/lib/soft-delete";
import { buildBuyerLeadPostUrl, generateBuyerApiKey } from "@/lib/buyer-lead-api";

type LegacyBuyerPayload = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  verticalId?: string;
  apiKey?: string;
  postLeadUrl?: string;
  status?: BuyerStatus;
  mappings?: Array<{
    source?: string;
    destination?: string;
  }>;
};

type CreateBuyerPayload = {
  name?: string;
  email?: string;
  status?: "Active" | "Inactive";
};

function sanitizeMappings(payloadMappings: LegacyBuyerPayload["mappings"]) {
  return (payloadMappings ?? [])
    .map((mapping) => ({
      source: mapping.source?.trim() ?? "",
      destination: mapping.destination?.trim() ?? "",
    }))
    .filter((mapping) => mapping.source && mapping.destination);
}

async function mapBuyerRecord(buyer: BuyerDoc) {
  const options = await getAvailableIntegrationOptions();
  const { integrationIds, integrationLabels } = resolveBuyerIntegrations(buyer, options);
  return toBuyerListRecord(buyer, integrationLabels, integrationIds);
}

function isLegacyBuyerPayload(body: LegacyBuyerPayload & CreateBuyerPayload) {
  return Boolean(
    body.firstName ||
      body.lastName ||
      body.phone ||
      body.company ||
      body.verticalId ||
      body.mappings
  );
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const hasListParams = searchParams.has("page") || searchParams.has("pageSize") || searchParams.has("search");
    const page = parsePageParam(searchParams.get("page"), 1);
    const pageSize = parsePageSizeParam(searchParams.get("pageSize"), 15);
    const search = normalizeSearchParam(searchParams.get("search"));

    const statusFilter = normalizeSearchParam(searchParams.get("status"));

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    await ensureBuyerFieldsMigrated();

    let verticalIds: Array<{ toString(): string }> = [];
    if (search) {
      const matchingVerticals = await VerticalModel.find(
        { name: { $regex: search, $options: "i" } },
        { _id: 1 }
      ).lean();
      verticalIds = matchingVerticals.map((vertical) => vertical._id);
    }

    const filter = mergeMongoFilters(
      buildMongoStatusFilter(statusFilter || "All"),
      search
        ? {
            $or: [
              { name: { $regex: search, $options: "i" } },
              { company: { $regex: search, $options: "i" } },
              { firstName: { $regex: search, $options: "i" } },
              { lastName: { $regex: search, $options: "i" } },
              { email: { $regex: search, $options: "i" } },
              { phone: { $regex: search, $options: "i" } },
              { buyerLabel: { $regex: search, $options: "i" } },
              { buyerType: { $regex: search, $options: "i" } },
              { personalManagerName: { $regex: search, $options: "i" } },
              { status: { $regex: search, $options: "i" } },
              ...(verticalIds.length > 0 ? [{ verticalRef: { $in: verticalIds.map((id) => id.toString()) } }] : []),
            ],
          }
        : {}
    );

    const totalItems = hasListParams ? await BuyerModel.countDocuments(filter) : 0;
    const buyers = await BuyerModel.find(filter)
      .sort(sortNewestDisplayIdFirst)
      .skip(hasListParams ? (page - 1) * pageSize : 0)
      .limit(hasListParams ? pageSize : 0)
      .lean();

    const integrationOptions = await getAvailableIntegrationOptions();
    const mapBuyer = (buyer: unknown) => {
      const doc = buyer as BuyerDoc;
      const { integrationIds, integrationLabels } = resolveBuyerIntegrations(doc, integrationOptions);
      return toBuyerListRecord(doc, integrationLabels, integrationIds);
    };

    if (!hasListParams) {
      return NextResponse.json(buyers.map(mapBuyer));
    }

    return NextResponse.json({
      items: buyers.map(mapBuyer),
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    });
  } catch {
    return NextResponse.json({ message: "Failed to fetch buyers." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as LegacyBuyerPayload & CreateBuyerPayload;

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    await ensureBuyerFieldsMigrated();

    if (isLegacyBuyerPayload(body)) {
      if (
        !body.firstName?.trim() ||
        !body.lastName?.trim() ||
        !body.email?.trim() ||
        !body.phone?.trim() ||
        !body.company?.trim() ||
        !body.verticalId?.trim() ||
        !body.apiKey?.trim() ||
        !body.postLeadUrl?.trim() ||
        !body.status
      ) {
        return NextResponse.json({ message: "Missing required fields." }, { status: 400 });
      }

      const vertical = await VerticalModel.findById(body.verticalId.trim()).lean();
      if (!vertical) {
        return NextResponse.json({ message: "Vertical not found." }, { status: 404 });
      }

      const latest = await BuyerModel.findOne().sort({ displayId: -1 }).select({ displayId: 1 }).lean();
      const nextDisplayId = (latest?.displayId ?? 0) + 1;

      const buyer = await BuyerModel.create({
        displayId: nextDisplayId,
        name: body.company.trim(),
        company: body.company.trim(),
        firstName: body.firstName.trim(),
        lastName: body.lastName.trim(),
        email: body.email.trim(),
        phone: body.phone.trim(),
        verticalRef: vertical._id,
        apiKey: body.apiKey.trim(),
        postLeadUrl: body.postLeadUrl.trim(),
        status: body.status,
        mappings: sanitizeMappings(body.mappings),
      });

      return NextResponse.json(await mapBuyerRecord(buyer.toObject() as BuyerDoc), { status: 201 });
    }

    if (!body.name?.trim()) {
      return NextResponse.json({ message: "Name is required." }, { status: 400 });
    }

    const latest = await BuyerModel.findOne().sort({ displayId: -1 }).select({ displayId: 1 }).lean();
    const nextDisplayId = (latest?.displayId ?? 0) + 1;
    const trimmedName = body.name.trim();
    const apiKey = body.apiKey?.trim() || generateBuyerApiKey();
    const requestUrl = new URL(req.url);
    const postLeadUrl = body.postLeadUrl?.trim() || buildBuyerLeadPostUrl(requestUrl.origin);

    const buyer = await BuyerModel.create({
      displayId: nextDisplayId,
      name: trimmedName,
      company: trimmedName,
      email: body.email?.trim() ?? "",
      status: body.status ?? "Active",
      apiKey,
      postLeadUrl,
      buyerLabel: "-",
      buyerType: "-",
      personalManagerId: "",
      personalManagerName: "",
      questionnaireStatus: "Pending",
      quality: "M",
    });

    return NextResponse.json(await mapBuyerRecord(buyer.toObject() as BuyerDoc), { status: 201 });
  } catch {
    return NextResponse.json({ message: "Failed to create buyer." }, { status: 500 });
  }
}
