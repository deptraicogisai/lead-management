import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import {
  buildNextDuplicateBuyerName,
  normalizeBuyerStatus,
  resolveBuyerDuplicateNameRoot,
  toBuyerListRecord,
  type BuyerDoc,
} from "@/lib/buyer";
import {
  getAvailableIntegrationOptions,
  resolveBuyerIntegrations,
} from "@/lib/buyer-integrations";
import { buildBuyerLeadPostUrl, generateBuyerApiKey } from "@/lib/buyer-lead-api";
import { BuyerModel, ensureBuyerFieldsMigrated } from "@/lib/models/buyer";
import { ensureVerticalCollectionMigrated } from "@/lib/models/industry";

type Params = { params: Promise<{ id: string }> };

async function mapBuyerResponse(buyer: BuyerDoc) {
  const options = await getAvailableIntegrationOptions();
  const { integrationIds, integrationLabels } = resolveBuyerIntegrations(buyer, options);
  return toBuyerListRecord(buyer, integrationLabels, integrationIds);
}

export async function POST(req: Request, context: Params) {
  try {
    const { id } = await context.params;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Buyer not found." }, { status: 404 });
    }

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    await ensureBuyerFieldsMigrated();

    const source = await BuyerModel.findById(id).lean();
    if (!source) {
      return NextResponse.json({ message: "Buyer not found." }, { status: 404 });
    }

    const sourceName = source.name?.trim() || source.company?.trim() || "Unnamed Buyer";
    const nameRoot = resolveBuyerDuplicateNameRoot(sourceName);
    const escapedRoot = nameRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const relatedBuyers = await BuyerModel.find({
      name: { $regex: `^${escapedRoot}( \\d+)?$`, $options: "i" },
    })
      .select({ name: 1 })
      .lean();
    const duplicateName = buildNextDuplicateBuyerName(
      sourceName,
      relatedBuyers.map((buyer) => buyer.name?.trim() ?? "").filter(Boolean)
    );

    const latest = await BuyerModel.findOne().sort({ displayId: -1 }).select({ displayId: 1 }).lean();
    const nextDisplayId = (latest?.displayId ?? 0) + 1;
    const apiKey = generateBuyerApiKey();
    const requestUrl = new URL(req.url);
    const postLeadUrl = buildBuyerLeadPostUrl(requestUrl.origin);

    const buyer = await BuyerModel.create({
      displayId: nextDisplayId,
      name: duplicateName,
      company: duplicateName,
      firstName: source.firstName ?? "",
      lastName: source.lastName ?? "",
      email: source.email ?? "",
      phone: source.phone ?? "",
      buyerLabel: source.buyerLabel ?? "-",
      buyerType: source.buyerType ?? "-",
      personalManagerId: source.personalManagerId ?? "",
      personalManagerName: source.personalManagerName ?? "",
      prepaid: Boolean(source.prepaid),
      questionnaireStatus: source.questionnaireStatus ?? "Pending",
      quality: source.quality ?? "M",
      verticalRef: source.verticalRef,
      apiKey,
      postLeadUrl,
      status: normalizeBuyerStatus(source.status),
      integrationRefs: source.integrationRefs ?? [],
      allowedPublisherRefs: source.allowedPublisherRefs ?? [],
      blockedPublisherRefs: source.blockedPublisherRefs ?? [],
      plDnplListIds: source.plDnplListIds ?? [],
      copyPlDnplToOtherBuyers: Boolean(source.copyPlDnplToOtherBuyers),
      mappings: source.mappings ?? [],
    });

    return NextResponse.json(await mapBuyerResponse(buyer.toObject() as BuyerDoc), { status: 201 });
  } catch {
    return NextResponse.json({ message: "Failed to duplicate buyer." }, { status: 500 });
  }
}
