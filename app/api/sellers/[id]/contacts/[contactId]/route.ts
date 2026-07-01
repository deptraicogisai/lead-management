import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureSellerCollectionMigrated, SellerModel } from "@/lib/models/seller";
import { toSellerContactResponse } from "@/lib/seller-contact";
import { normalizeChannelsPayload } from "../route";

type Params = { params: Promise<{ id: string; contactId: string }> };

type ContactPayload = {
  name?: string;
  email?: string;
  phone?: string;
  website?: string;
  channels?: unknown;
};

type ContactDoc = Parameters<typeof toSellerContactResponse>[0] & { _id?: { toString(): string } };

export async function PATCH(req: Request, context: Params) {
  try {
    const { id, contactId } = await context.params;
    const body = (await req.json()) as ContactPayload;
    if (!body.name?.trim()) {
      return NextResponse.json({ message: "Name is required." }, { status: 400 });
    }

    const channels = normalizeChannelsPayload(body.channels);

    await connectToDatabase();
    await ensureSellerCollectionMigrated();

    const seller = await SellerModel.findOneAndUpdate(
      { _id: id, "contacts._id": contactId },
      {
        $set: {
          "contacts.$.name": body.name.trim(),
          "contacts.$.email": body.email?.trim() ?? "",
          "contacts.$.phone": body.phone?.trim() ?? "",
          "contacts.$.website": body.website?.trim() ?? "",
          "contacts.$.channels": channels,
        },
      },
      { new: true }
    ).lean();

    if (!seller) {
      return NextResponse.json({ message: "Contact not found." }, { status: 404 });
    }

    const contacts = (Array.isArray(seller.contacts) ? seller.contacts : []) as ContactDoc[];
    const index = contacts.findIndex((item) => item._id?.toString() === contactId);
    const contact = index >= 0 ? contacts[index] : null;

    if (!contact) {
      return NextResponse.json({ message: "Contact not found." }, { status: 404 });
    }

    return NextResponse.json(toSellerContactResponse(contact, index + 1));
  } catch {
    return NextResponse.json({ message: "Failed to update contact." }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: Params) {
  try {
    const { id, contactId } = await context.params;

    await connectToDatabase();
    await ensureSellerCollectionMigrated();

    const seller = await SellerModel.findOneAndUpdate(
      { _id: id, "contacts._id": contactId },
      { $pull: { contacts: { _id: contactId } } },
      { new: true }
    ).lean();

    if (!seller) {
      return NextResponse.json({ message: "Contact not found." }, { status: 404 });
    }

    return NextResponse.json({ message: "Contact deleted." });
  } catch {
    return NextResponse.json({ message: "Failed to delete contact." }, { status: 500 });
  }
}
