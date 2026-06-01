import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { BuyerModel } from "@/lib/models/buyer";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import { normalizeSearchParam, parsePageParam, parsePageSizeParam } from "@/lib/pagination";

type BuyerPayload = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  verticalId?: string;
  apiKey?: string;
  postLeadUrl?: string;
  status?: "Active" | "Paused";
  mappings?: Array<{
    source?: string;
    destination?: string;
  }>;
};

type BuyerDoc = {
  _id?: { toString(): string };
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  verticalRef?: { toString(): string } | string | null;
  apiKey: string;
  postLeadUrl: string;
  status: "Active" | "Paused";
  mappings?: Array<{
    source: string;
    destination: string;
  }>;
};

function toBuyerResponse(
  doc: BuyerDoc,
  verticalNameById: Map<string, string>
) {
  const verticalId =
    typeof doc.verticalRef === "string" ? doc.verticalRef : doc.verticalRef?.toString() ?? "";

  return {
    id: doc._id?.toString() ?? "",
    firstName: doc.firstName,
    lastName: doc.lastName,
    email: doc.email,
    phone: doc.phone,
    company: doc.company,
    verticalId,
    verticalName: verticalNameById.get(verticalId) ?? "",
    apiKey: doc.apiKey,
    postLeadUrl: doc.postLeadUrl,
    status: doc.status,
    mappings: (doc.mappings ?? []).map((mapping) => ({
      source: mapping.source,
      destination: mapping.destination,
    })),
  };
}

function sanitizeMappings(payloadMappings: BuyerPayload["mappings"]) {
  return (payloadMappings ?? [])
    .map((mapping) => ({
      source: mapping.source?.trim() ?? "",
      destination: mapping.destination?.trim() ?? "",
    }))
    .filter((mapping) => mapping.source && mapping.destination);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const hasListParams = searchParams.has("page") || searchParams.has("pageSize") || searchParams.has("search");
    const page = parsePageParam(searchParams.get("page"), 1);
    const pageSize = parsePageSizeParam(searchParams.get("pageSize"), 10);
    const search = normalizeSearchParam(searchParams.get("search"));

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();

    let verticalIds: Array<{ toString(): string }> = [];
    if (search) {
      const matchingVerticals = await VerticalModel.find(
        { name: { $regex: search, $options: "i" } },
        { _id: 1 }
      ).lean();
      verticalIds = matchingVerticals.map((vertical) => vertical._id);
    }

    const filter = search
      ? {
          $or: [
            { firstName: { $regex: search, $options: "i" } },
            { lastName: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } },
            { company: { $regex: search, $options: "i" } },
            { apiKey: { $regex: search, $options: "i" } },
            { postLeadUrl: { $regex: search, $options: "i" } },
            { status: { $regex: search, $options: "i" } },
            ...(verticalIds.length > 0 ? [{ verticalRef: { $in: verticalIds } }] : []),
          ],
        }
      : {};

    const totalItems = hasListParams ? await BuyerModel.countDocuments(filter) : 0;
    const buyers = await BuyerModel.find(filter)
      .sort({ createdAt: 1 })
      .skip(hasListParams ? (page - 1) * pageSize : 0)
      .limit(hasListParams ? pageSize : 0)
      .lean();
    const verticalRefs = buyers.map((buyer) => buyer.verticalRef).filter(Boolean);
    const verticals = await VerticalModel.find({ _id: { $in: verticalRefs } }, { name: 1 }).lean();
    const verticalNameById = new Map(verticals.map((vertical) => [vertical._id.toString(), vertical.name]));

    if (!hasListParams) {
      return NextResponse.json(buyers.map((buyer) => toBuyerResponse(buyer, verticalNameById)));
    }

    return NextResponse.json({
      items: buyers.map((buyer) => toBuyerResponse(buyer, verticalNameById)),
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
    const body = (await req.json()) as BuyerPayload;
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

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();

    const vertical = await VerticalModel.findById(body.verticalId.trim()).lean();
    if (!vertical) {
      return NextResponse.json({ message: "Vertical not found." }, { status: 404 });
    }

    const buyer = await BuyerModel.create({
      firstName: body.firstName.trim(),
      lastName: body.lastName.trim(),
      email: body.email.trim(),
      phone: body.phone.trim(),
      company: body.company.trim(),
      verticalRef: vertical._id,
      apiKey: body.apiKey.trim(),
      postLeadUrl: body.postLeadUrl.trim(),
      status: body.status,
      mappings: sanitizeMappings(body.mappings),
    });

    return NextResponse.json(
      toBuyerResponse(buyer.toObject(), new Map([[vertical._id.toString(), vertical.name]])),
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ message: "Failed to create buyer." }, { status: 500 });
  }
}
