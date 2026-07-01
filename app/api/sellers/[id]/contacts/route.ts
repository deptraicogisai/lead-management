import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureSellerCollectionMigrated, SellerModel } from "@/lib/models/seller";
import {
  findDuplicateContactChannelType,
  getDuplicateContactChannelMessage,
  isContactChannelType,
  toSellerContactResponse,
  type ContactChannel,
} from "@/lib/seller-contact";

type Params = { params: Promise<{ id: string }> };

type ContactChannelPayload = {
  type?: string;
  value?: string;
};

type ContactPayload = {
  name?: string;
  email?: string;
  phone?: string;
  website?: string;
  channels?: ContactChannelPayload[];
};

export function normalizeChannelsPayload(channels: unknown): ContactChannel[] {
  if (!Array.isArray(channels)) return [];

  return channels
    .map((channel) => {
      const row = channel as ContactChannelPayload;
      const type = isContactChannelType(row.type) ? row.type : "Other";
      const value = row.value?.trim() ?? "";
      return { type, value };
    })
    .filter((channel) => channel.value.length > 0);
}

type ContactDoc = Parameters<typeof toSellerContactResponse>[0];

export async function GET(_: Request, context: Params) {
  try {
    const { id } = await context.params;
    await connectToDatabase();
    await ensureSellerCollectionMigrated();
    const seller = await SellerModel.findById(id).lean();
    if (!seller) {
      return NextResponse.json({ message: "Publisher not found." }, { status: 404 });
    }

    const contacts = (Array.isArray(seller.contacts) ? seller.contacts : []) as ContactDoc[];
    return NextResponse.json(contacts.map((contact, index) => toSellerContactResponse(contact, index + 1)));
  } catch {
    return NextResponse.json({ message: "Failed to fetch contacts." }, { status: 500 });
  }
}

export async function POST(req: Request, context: Params) {
  try {
    const { id } = await context.params;
    const body = (await req.json()) as ContactPayload;
    if (!body.name?.trim()) {
      return NextResponse.json({ message: "Name is required." }, { status: 400 });
    }
    if (!body.email?.trim()) {
      return NextResponse.json({ message: "Email is required." }, { status: 400 });
    }
    if (!body.phone?.trim()) {
      return NextResponse.json({ message: "Phone is required." }, { status: 400 });
    }

    const channels = normalizeChannelsPayload(body.channels);
    const duplicateType = findDuplicateContactChannelType(channels);
    if (duplicateType) {
      return NextResponse.json(
        { message: getDuplicateContactChannelMessage(duplicateType) },
        { status: 400 }
      );
    }

    await connectToDatabase();
    await ensureSellerCollectionMigrated();
    const seller = await SellerModel.findById(id);
    if (!seller) {
      return NextResponse.json({ message: "Publisher not found." }, { status: 404 });
    }

    seller.contacts.push({
      name: body.name.trim(),
      email: body.email?.trim() ?? "",
      phone: body.phone?.trim() ?? "",
      website: body.website?.trim() ?? "",
      channels,
    });
    await seller.save();

    const created = seller.contacts[seller.contacts.length - 1] as ContactDoc;
    return NextResponse.json(toSellerContactResponse(created, seller.contacts.length), { status: 201 });
  } catch {
    return NextResponse.json({ message: "Failed to create contact." }, { status: 500 });
  }
}
