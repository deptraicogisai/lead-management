import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { BuyerModel } from "@/lib/models/buyer";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";

type Params = { params: Promise<{ id: string }> };

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

function sanitizeMappings(payloadMappings: BuyerPayload["mappings"]) {
  return (payloadMappings ?? [])
    .map((mapping) => ({
      source: mapping.source?.trim() ?? "",
      destination: mapping.destination?.trim() ?? "",
    }))
    .filter((mapping) => mapping.source && mapping.destination);
}

function toBuyerResponse(doc: BuyerDoc, verticalName: string) {
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
    verticalName,
    apiKey: doc.apiKey,
    postLeadUrl: doc.postLeadUrl,
    status: doc.status,
    mappings: (doc.mappings ?? []).map((mapping) => ({
      source: mapping.source,
      destination: mapping.destination,
    })),
  };
}

export async function PATCH(req: Request, context: Params) {
  try {
    const { id } = await context.params;
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

    const buyer = await BuyerModel.findByIdAndUpdate(
      id,
      {
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
      },
      { new: true }
    ).lean();

    if (!buyer) {
      return NextResponse.json({ message: "Buyer not found." }, { status: 404 });
    }

    return NextResponse.json(toBuyerResponse(buyer, vertical.name));
  } catch {
    return NextResponse.json({ message: "Failed to update buyer." }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: Params) {
  try {
    const { id } = await context.params;

    await connectToDatabase();
    const buyer = await BuyerModel.findByIdAndDelete(id).lean();

    if (!buyer) {
      return NextResponse.json({ message: "Buyer not found." }, { status: 404 });
    }

    return NextResponse.json({ message: "Buyer deleted." });
  } catch {
    return NextResponse.json({ message: "Failed to delete buyer." }, { status: 500 });
  }
}
