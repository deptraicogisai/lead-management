import { connectToDatabase } from "@/lib/mongodb";
import { BuyerModel, ensureBuyerFieldsMigrated } from "@/lib/models/buyer";
import { IntegrationBuilderModel } from "@/lib/models/integration-builder";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import { getPingTreeCampaignIdSet } from "@/lib/models/ping-tree";
import { buildVerticalIndexMap } from "@/lib/integration-builder";
import { resolveBuyerName, type BuyerDoc } from "@/lib/buyer";

export async function buildCampaignLookupContext() {
  await connectToDatabase();
  await ensureVerticalCollectionMigrated();
  await ensureBuyerFieldsMigrated();

  const [verticals, buyers, integrations, pingTreeCampaignIds] = await Promise.all([
    VerticalModel.find().sort({ createdAt: 1 }).select({ _id: 1, name: 1 }).lean(),
    BuyerModel.find().sort({ createdAt: 1 }).select({ _id: 1, displayId: 1, name: 1, company: 1, firstName: 1, lastName: 1 }).lean(),
    IntegrationBuilderModel.find().select({ _id: 1, name: 1 }).lean(),
    getPingTreeCampaignIdSet(),
  ]);

  const verticalIds = verticals.map((vertical) => vertical._id.toString());
  const verticalNameById = new Map(verticals.map((vertical) => [vertical._id.toString(), vertical.name]));
  const verticalIndexById = buildVerticalIndexMap(verticalIds);
  const buyerLabelById = new Map(
    buyers.map((buyer, index) => {
      const doc = buyer as BuyerDoc;
      const displayId = doc.displayId ?? index + 1001;
      return [buyer._id.toString(), `[${displayId}] ${resolveBuyerName(doc)}`];
    })
  );
  const integrationLabelById = new Map(
    integrations.map((integration) => [integration._id.toString(), integration.name])
  );

  return {
    verticalNameById,
    verticalIndexById,
    buyerLabelById,
    integrationLabelById,
    pingTreeCampaignIds,
  };
}
