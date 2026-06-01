import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { BuyerRequestLogModel } from "@/lib/models/buyer-request-log";
import { BuyerModel } from "@/lib/models/buyer";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import { ensureSellerCollectionMigrated, SellerModel } from "@/lib/models/seller";
import { normalizeSearchParam, parsePageParam, parsePageSizeParam } from "@/lib/pagination";

type BuyerRequestLogDoc = {
  _id?: { toString(): string };
  requestType?: "seller-intake" | "buyer-delivery";
  sellerRef?: { toString(): string } | string | null;
  verticalRef?: { toString(): string } | string | null;
  buyerRef?: { toString(): string } | string | null;
  buyerCompany?: string | null;
  targetName?: string | null;
  postLeadUrl: string;
  requestPayload: unknown;
  responseBody?: string | null;
  errorMessage?: string | null;
  deliveryStatus: "success" | "fail";
  httpStatus: number;
  createdAt?: Date | string;
};

type DeleteLogsPayload = {
  ids?: string[];
  deleteAll?: boolean;
};

function toId(value?: { toString(): string } | string | null) {
  if (!value) return "";
  return typeof value === "string" ? value : value.toString();
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const hasListParams = searchParams.has("page") || searchParams.has("pageSize") || searchParams.has("search");
    const page = parsePageParam(searchParams.get("page"), 1);
    const pageSize = parsePageSizeParam(searchParams.get("pageSize"), 10);
    const search = normalizeSearchParam(searchParams.get("search"));

    await connectToDatabase();
    await ensureSellerCollectionMigrated();
    await ensureVerticalCollectionMigrated();

    let sellerIds: string[] = [];
    let verticalIds: string[] = [];
    let buyerIds: string[] = [];

    if (search) {
      const [matchedSellers, matchedVerticals, matchedBuyers] = await Promise.all([
        SellerModel.find({ name: { $regex: search, $options: "i" } }, { _id: 1 }).lean(),
        VerticalModel.find({ name: { $regex: search, $options: "i" } }, { _id: 1 }).lean(),
        BuyerModel.find({ company: { $regex: search, $options: "i" } }, { _id: 1 }).lean(),
      ]);
      sellerIds = matchedSellers.map((seller) => seller._id.toString());
      verticalIds = matchedVerticals.map((vertical) => vertical._id.toString());
      buyerIds = matchedBuyers.map((buyer) => buyer._id.toString());
    }

    const filter: Record<string, unknown> = search
      ? {
          $or: [
            ...(sellerIds.length > 0 ? [{ sellerRef: { $in: sellerIds } }] : []),
            ...(verticalIds.length > 0 ? [{ verticalRef: { $in: verticalIds } }] : []),
            ...(buyerIds.length > 0 ? [{ buyerRef: { $in: buyerIds } }] : []),
            { requestType: { $regex: search, $options: "i" } },
            { targetName: { $regex: search, $options: "i" } },
            { buyerCompany: { $regex: search, $options: "i" } },
            { postLeadUrl: { $regex: search, $options: "i" } },
            { deliveryStatus: { $regex: search, $options: "i" } },
            { errorMessage: { $regex: search, $options: "i" } },
            { responseBody: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const totalItems = hasListParams ? await BuyerRequestLogModel.countDocuments(filter) : 0;
    const logs = await BuyerRequestLogModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(hasListParams ? (page - 1) * pageSize : 0)
      .limit(hasListParams ? pageSize : 0)
      .lean();

    const sellerRefs = logs.map((log) => log.sellerRef).filter(Boolean);
    const verticalRefs = logs.map((log) => log.verticalRef).filter(Boolean);
    const buyerRefs = logs.map((log) => log.buyerRef).filter(Boolean);

    const [sellers, verticals, buyers] = await Promise.all([
      SellerModel.find({ _id: { $in: sellerRefs } }, { name: 1 }).lean(),
      VerticalModel.find({ _id: { $in: verticalRefs } }, { name: 1 }).lean(),
      BuyerModel.find({ _id: { $in: buyerRefs } }, { company: 1 }).lean(),
    ]);

    const sellerNameById = new Map(sellers.map((seller) => [seller._id.toString(), seller.name]));
    const verticalNameById = new Map(verticals.map((vertical) => [vertical._id.toString(), vertical.name]));
    const buyerCompanyById = new Map(buyers.map((buyer) => [buyer._id.toString(), buyer.company]));

    const items = logs.map((log) => {
        const sellerId = toId(log.sellerRef);
        const verticalId = toId(log.verticalRef);
        const buyerId = toId(log.buyerRef);

        return {
          id: log._id?.toString() ?? "",
          requestType: log.requestType ?? "buyer-delivery",
          sellerName: sellerNameById.get(sellerId) ?? "",
          verticalName: verticalNameById.get(verticalId) ?? "",
          targetName: log.requestType === "seller-intake"
            ? (log.targetName?.trim() || "Seller Intake API")
            : (buyerCompanyById.get(buyerId) ?? log.targetName?.trim() ?? log.buyerCompany),
          postLeadUrl: log.postLeadUrl,
          requestPayload: JSON.stringify(log.requestPayload ?? {}, null, 2),
          responseBody: log.responseBody ?? "",
          errorMessage: log.errorMessage ?? "",
          deliveryStatus: log.deliveryStatus,
          httpStatus: log.httpStatus,
          createdAt:
            log.createdAt instanceof Date
              ? log.createdAt.toISOString()
              : typeof log.createdAt === "string"
                ? log.createdAt
                : "",
        };
      });

    if (!hasListParams) {
      return NextResponse.json(items);
    }

    return NextResponse.json({
      items,
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    });
  } catch {
    return NextResponse.json({ message: "Failed to fetch logs." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as DeleteLogsPayload;
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === "string" && Types.ObjectId.isValid(id))
      : [];

    if (!body.deleteAll && ids.length === 0) {
      return NextResponse.json({ message: "No log items selected." }, { status: 400 });
    }

    await connectToDatabase();

    const result = body.deleteAll
      ? await BuyerRequestLogModel.deleteMany({})
      : await BuyerRequestLogModel.deleteMany({ _id: { $in: ids } });

    return NextResponse.json({
      deletedCount: result.deletedCount ?? 0,
    });
  } catch {
    return NextResponse.json({ message: "Failed to delete logs." }, { status: 500 });
  }
}
