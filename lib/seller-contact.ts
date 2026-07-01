export const CONTACT_CHANNEL_TYPES = [
  "Telegram",
  "Linkedin",
  "Teams",
  "Signal",
  "Facebook",
  "Whatsapp",
  "Other",
] as const;

export type ContactChannelType = (typeof CONTACT_CHANNEL_TYPES)[number];

export type ContactChannel = {
  type: ContactChannelType;
  value: string;
};

export type SellerContact = {
  id: string;
  displayId: number;
  name: string;
  email: string;
  phone: string;
  website: string;
  channels: ContactChannel[];
};

export function isContactChannelType(value: unknown): value is ContactChannelType {
  return typeof value === "string" && CONTACT_CHANNEL_TYPES.includes(value as ContactChannelType);
}

type ContactChannelDoc = {
  type?: string | null;
  value?: string | null;
};

type SellerContactDoc = {
  _id?: { toString(): string };
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  channels?: ContactChannelDoc[] | null;
};

export function normalizeContactChannels(channels: unknown): ContactChannel[] {
  if (!Array.isArray(channels)) return [];

  return channels
    .map((channel) => {
      const row = channel as ContactChannelDoc;
      const type = isContactChannelType(row.type) ? row.type : "Other";
      const value = row.value?.toString().trim() ?? "";
      return { type, value };
    })
    .filter((channel) => channel.value.length > 0);
}

export function toSellerContactResponse(doc: SellerContactDoc, displayId: number): SellerContact {
  return {
    id: doc._id?.toString() ?? "",
    displayId,
    name: doc.name?.trim() ?? "",
    email: doc.email?.trim() ?? "",
    phone: doc.phone?.trim() ?? "",
    website: doc.website?.trim() ?? "",
    channels: normalizeContactChannels(doc.channels),
  };
}
