import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { LeadDeliveryModel } from "@/lib/models/lead-delivery";
import { CampaignModel } from "@/lib/models/campaign";
import { BuyerModel } from "@/lib/models/buyer";
import { normalizeSearchParam, parsePageParam } from "@/lib/pagination";

function parsePageSize(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 100;
  return Math.min(parsed, 1000);
}

function buildLeadIdCondition(leadId: string) {
  if (Types.ObjectId.isValid(leadId) && leadId.length === 24) {
    return { sellerLeadRef: new Types.ObjectId(leadId) };
  }

  return null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const leadId = normalizeSearchParam(searchParams.get("leadId"));
    const buyerId = normalizeSearchParam(searchParams.get("buyerId"));
    const campaignId = normalizeSearchParam(searchParams.get("campaignId"));
    const status = normalizeSearchParam(searchParams.get("status"));
    const page = parsePageParam(searchParams.get("page"), 1);
    const pageSize = parsePageSize(searchParams.get("pageSize"));
    const skip = (page - 1) * pageSize;

    await connectToDatabase();

    const filter: Record<string, unknown> = {};

    if (leadId) {
      const leadCondition = buildLeadIdCondition(leadId);
      if (!leadCondition) {
        return NextResponse.json({ rows: [], total: 0, page, pageSize });
      }
      Object.assign(filter, leadCondition);
    }

    if (buyerId && Types.ObjectId.isValid(buyerId)) {
      filter.buyerRef = new Types.ObjectId(buyerId);
    }

    if (campaignId && Types.ObjectId.isValid(campaignId)) {
      filter.campaignRef = new Types.ObjectId(campaignId);
    }

    if (status) {
      filter.buyerStatus = status;
    }

    const [docs, total] = await Promise.all([
      LeadDeliveryModel.find(filter).sort({ postedAt: -1, campaignOrder: 1 }).skip(skip).limit(pageSize).lean(),
      LeadDeliveryModel.countDocuments(filter),
    ]);

    const campaignIds = [...new Set(docs.map((doc) => doc.campaignRef?.toString()).filter(Boolean))];
    const buyerIds = [...new Set(docs.map((doc) => doc.buyerRef?.toString()).filter(Boolean))];

    const [campaigns, buyers] = await Promise.all([
      campaignIds.length > 0
        ? CampaignModel.find({ _id: { $in: campaignIds } }).select({ name: 1, displayId: 1 }).lean()
        : [],
      buyerIds.length > 0
        ? BuyerModel.find({ _id: { $in: buyerIds } }).select({ company: 1 }).lean()
        : [],
    ]);

    const campaignById = new Map(campaigns.map((entry) => [entry._id?.toString() ?? "", entry]));
    const buyerById = new Map(buyers.map((entry) => [entry._id?.toString() ?? "", entry]));

    const rows = docs.map((doc) => {
      const campaign = campaignById.get(doc.campaignRef?.toString() ?? "");
      const buyer = buyerById.get(doc.buyerRef?.toString() ?? "");

      return {
        id: doc._id?.toString() ?? "",
        leadId: doc.sellerLeadRef?.toString() ?? "",
        campaignId: doc.campaignRef?.toString() ?? "",
        campaignName: campaign?.name ?? "",
        campaignDisplayId: campaign?.displayId ?? 0,
        buyerId: doc.buyerRef?.toString() ?? "",
        buyerCompany: buyer?.company ?? "",
        pingTreeType: doc.pingTreeType,
        campaignOrder: doc.campaignOrder,
        buyerStatus: doc.buyerStatus,
        validationErrors: doc.validationErrors ?? [],
        price: doc.price,
        redirectUrl: doc.redirectUrl ?? "",
        rejectSign: doc.rejectSign ?? "",
        rejectReason: doc.rejectReason ?? "",
        errorReason: doc.errorReason ?? "",
        postLeadUrl: doc.postLeadUrl ?? "",
        httpStatus: doc.httpStatus ?? 0,
        postedAt: doc.postedAt ? new Date(doc.postedAt).toISOString() : "",
      };
    });

    return NextResponse.json({ rows, total, page, pageSize });
  } catch {
    return NextResponse.json({ message: "Failed to load buyer lead details." }, { status: 500 });
  }
}
