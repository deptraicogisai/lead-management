import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { IntegrationBuilderDetail } from "@/components/integration-builder/integration-builder-detail";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import { IntegrationBuilderModel } from "@/lib/models/integration-builder";
import { buildVerticalIndexMap, toIntegrationBuilderRecord } from "@/lib/integration-builder";

type Params = {
  params: Promise<{ id: string }>;
};

export default async function IntegrationBuilderDetailPage({ params }: Params) {
  const { id } = await params;

  if (!Types.ObjectId.isValid(id)) {
    notFound();
  }

  await connectToDatabase();
  await ensureVerticalCollectionMigrated();

  const record = await IntegrationBuilderModel.findById(id).lean();
  if (!record) {
    notFound();
  }

  const verticals = await VerticalModel.find().sort({ createdAt: 1 }).select({ _id: 1, name: 1 }).lean();
  const verticalIds = verticals.map((vertical) => vertical._id.toString());
  const verticalNameById = new Map(verticals.map((vertical) => [vertical._id.toString(), vertical.name]));
  const verticalIndexById = buildVerticalIndexMap(verticalIds);

  const builder = toIntegrationBuilderRecord(
    record as Parameters<typeof toIntegrationBuilderRecord>[0],
    verticalNameById,
    verticalIndexById
  );

  return <IntegrationBuilderDetail builder={builder} />;
}
