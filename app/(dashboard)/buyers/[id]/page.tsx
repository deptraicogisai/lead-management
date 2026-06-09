import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { BuyerDetail } from "@/components/buyers/buyer-detail";
import {
  getAvailableIntegrationOptions,
  resolveBuyerIntegrations,
} from "@/lib/buyer-integrations";
import { toBuyerListRecord, type BuyerDoc } from "@/lib/buyer";
import { connectToDatabase } from "@/lib/mongodb";
import { BuyerModel, ensureBuyerFieldsMigrated } from "@/lib/models/buyer";
import { ensureVerticalCollectionMigrated } from "@/lib/models/industry";

type Params = {
  params: Promise<{ id: string }>;
};

export default async function BuyerDetailPage({ params }: Params) {
  const { id } = await params;

  if (!Types.ObjectId.isValid(id)) {
    notFound();
  }

  await connectToDatabase();
  await ensureVerticalCollectionMigrated();
  await ensureBuyerFieldsMigrated();

  const buyer = await BuyerModel.findById(id).lean();
  if (!buyer) {
    notFound();
  }

  const options = await getAvailableIntegrationOptions();
  const { integrationIds, integrationLabels } = resolveBuyerIntegrations(buyer as BuyerDoc, options);
  const record = toBuyerListRecord(buyer as BuyerDoc, integrationLabels, integrationIds);

  return <BuyerDetail buyer={record} />;
}
