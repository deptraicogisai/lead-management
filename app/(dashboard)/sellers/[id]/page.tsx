import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { SellerDetail, type SellerDetailRecord } from "@/components/sellers/seller-detail";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureSellerCollectionMigrated, SellerModel } from "@/lib/models/seller";
import { normalizePublisherTag } from "@/lib/publisher-tag";

type Params = {
  params: Promise<{ id: string }>;
};

type SellerLeanDoc = {
  _id: { toString(): string };
  name: string;
  email: string;
  region?: string | null;
  publisherTag?: string | null;
  status: "Active" | "Inactive" | "Deleted";
  createdAt?: Date | string;
};

export default async function SellerDetailPage({ params }: Params) {
  const { id } = await params;

  if (!Types.ObjectId.isValid(id)) {
    notFound();
  }

  await connectToDatabase();
  await ensureSellerCollectionMigrated();

  const seller = (await SellerModel.findById(id).lean()) as SellerLeanDoc | null;
  if (!seller) {
    notFound();
  }

  // displayId mirrors the list ordering (newest first => position 1).
  const newerCount = seller.createdAt
    ? await SellerModel.countDocuments({ createdAt: { $gt: seller.createdAt } })
    : 0;

  const record: SellerDetailRecord = {
    id: seller._id.toString(),
    displayId: newerCount + 1,
    name: seller.name,
    email: seller.email,
    region: seller.region?.trim() ?? "",
    publisherTag: normalizePublisherTag(seller.publisherTag),
    status: seller.status,
  };

  return <SellerDetail seller={record} />;
}
