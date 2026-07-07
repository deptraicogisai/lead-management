import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import {
  getAvailableIntegrationOptions,
  resolveBuyerIntegrations,
} from "@/lib/buyer-integrations";
import {
  normalizeBuyerStatus,
  resolveBuyerName,
  toBuyerListRecord,
  type BuyerDoc,
  type BuyerUpdatePayload,
} from "@/lib/buyer";
import { BuyerModel, ensureBuyerFieldsMigrated } from "@/lib/models/buyer";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import { softDeleteUpdate } from "@/lib/soft-delete";

type Params = { params: Promise<{ id: string }> };

type LegacyBuyerPayload = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  verticalId?: string;
  apiKey?: string;
  postLeadUrl?: string;
  status?: "Active" | "Inactive" | "Disabled" | "Paused";
  mappings?: Array<{
    source?: string;
    destination?: string;
  }>;
};

function sanitizeMappings(payloadMappings: LegacyBuyerPayload["mappings"]) {
  return (payloadMappings ?? [])
    .map((mapping) => ({
      source: mapping.source?.trim() ?? "",
      destination: mapping.destination?.trim() ?? "",
    }))
    .filter((mapping) => mapping.source && mapping.destination);
}

function isLegacyBuyerPayload(body: LegacyBuyerPayload & Partial<BuyerUpdatePayload>) {
  return Boolean(
    body.firstName ||
      body.lastName ||
      body.phone ||
      body.company ||
      body.verticalId ||
      body.mappings
  );
}

async function mapBuyerResponse(buyer: BuyerDoc) {
  const options = await getAvailableIntegrationOptions();
  const { integrationIds, integrationLabels } = resolveBuyerIntegrations(buyer, options);
  return toBuyerListRecord(buyer, integrationLabels, integrationIds);
}

function sanitizeIntegrationIds(integrationIds?: string[]) {
  return (integrationIds ?? []).filter((id) => Types.ObjectId.isValid(id));
}

function sanitizePlDnplListIds(listIds?: string[]) {
  return (listIds ?? []).filter((id) => Types.ObjectId.isValid(id));
}

function sanitizeBlockedPublisherIds(blockedPublisherIds?: string[]) {
  return {
    allowedPublisherRefs: [],
    blockedPublisherRefs: (blockedPublisherIds ?? [])
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id)),
  };
}

export async function GET(_req: Request, context: Params) {
  try {
    const { id } = await context.params;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid buyer id." }, { status: 400 });
    }

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    await ensureBuyerFieldsMigrated();

    const buyer = await BuyerModel.findById(id).lean();
    if (!buyer) {
      return NextResponse.json({ message: "Buyer not found." }, { status: 404 });
    }

    return NextResponse.json(await mapBuyerResponse(buyer as BuyerDoc));
  } catch {
    return NextResponse.json({ message: "Failed to fetch buyer." }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: Params) {
  try {
    const { id } = await context.params;
    const body = (await req.json()) as LegacyBuyerPayload & Partial<BuyerUpdatePayload>;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid buyer id." }, { status: 400 });
    }

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

      const buyer = await BuyerModel.findByIdAndUpdate(
        id,
        {
          name: body.company.trim(),
          company: body.company.trim(),
          firstName: body.firstName.trim(),
          lastName: body.lastName.trim(),
          email: body.email.trim(),
          phone: body.phone.trim(),
          verticalRef: vertical._id,
          apiKey: body.apiKey.trim(),
          postLeadUrl: body.postLeadUrl.trim(),
          status: normalizeBuyerStatus(body.status),
          mappings: sanitizeMappings(body.mappings),
        },
        { new: true }
      ).lean();

      if (!buyer) {
        return NextResponse.json({ message: "Buyer not found." }, { status: 404 });
      }

      return NextResponse.json(await mapBuyerResponse(buyer as BuyerDoc));
    }

    if (
      body.plDnplListIds !== undefined &&
      body.name === undefined &&
      body.integrationIds === undefined &&
      body.blockedPublisherIds === undefined
    ) {
      const buyer = await BuyerModel.findByIdAndUpdate(
        id,
        {
          plDnplListIds: sanitizePlDnplListIds(body.plDnplListIds),
          copyPlDnplToOtherBuyers: Boolean(body.copyPlDnplToOtherBuyers),
        },
        { new: true }
      ).lean();

      if (!buyer) {
        return NextResponse.json({ message: "Buyer not found." }, { status: 404 });
      }

      return NextResponse.json(await mapBuyerResponse(buyer as BuyerDoc));
    }

    if (
      body.blockedPublisherIds !== undefined &&
      body.name === undefined &&
      body.integrationIds === undefined
    ) {
      const publisherSources = sanitizeBlockedPublisherIds(body.blockedPublisherIds);

      const buyer = await BuyerModel.findByIdAndUpdate(id, publisherSources, { new: true }).lean();

      if (!buyer) {
        return NextResponse.json({ message: "Buyer not found." }, { status: 404 });
      }

      return NextResponse.json(await mapBuyerResponse(buyer as BuyerDoc));
    }

    if (body.integrationIds !== undefined && body.name === undefined) {
      const integrationRefs = sanitizeIntegrationIds(body.integrationIds);

      const buyer = await BuyerModel.findByIdAndUpdate(
        id,
        { integrationRefs },
        { new: true }
      ).lean();

      if (!buyer) {
        return NextResponse.json({ message: "Buyer not found." }, { status: 404 });
      }

      return NextResponse.json(await mapBuyerResponse(buyer as BuyerDoc));
    }

    if (!body.name?.trim()) {
      return NextResponse.json({ message: "Name is required." }, { status: 400 });
    }

    const trimmedName = body.name.trim();
    const updatePayload: Record<string, unknown> = {
      name: trimmedName,
      company: trimmedName,
      email: body.email?.trim() ?? "",
      status: body.status ? normalizeBuyerStatus(body.status) : "Active",
    };

    if (body.integrationIds !== undefined) {
      updatePayload.integrationRefs = sanitizeIntegrationIds(body.integrationIds);
    }

    if (body.apiKey !== undefined) {
      updatePayload.apiKey = body.apiKey.trim();
    }

    if (body.postLeadUrl !== undefined) {
      updatePayload.postLeadUrl = body.postLeadUrl.trim();
    }

    const buyer = await BuyerModel.findByIdAndUpdate(id, updatePayload, { new: true }).lean();

    if (!buyer) {
      return NextResponse.json({ message: "Buyer not found." }, { status: 404 });
    }

    return NextResponse.json(await mapBuyerResponse(buyer as BuyerDoc));
  } catch {
    return NextResponse.json({ message: "Failed to update buyer." }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: Params) {
  try {
    const { id } = await context.params;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid buyer id." }, { status: 400 });
    }

    await connectToDatabase();
    await ensureBuyerFieldsMigrated();

    const buyer = await BuyerModel.findByIdAndUpdate(id, softDeleteUpdate(), { new: true }).lean();

    if (!buyer) {
      return NextResponse.json({ message: "Buyer not found." }, { status: 404 });
    }

    return NextResponse.json({ message: "Buyer deleted." });
  } catch {
    return NextResponse.json({ message: "Failed to delete buyer." }, { status: 500 });
  }
}
