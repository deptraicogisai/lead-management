export type PingTreeStrategy = "Priority";

export type PingTreeCampaignCard = {
  id: string;
  displayId: number;
  name: string;
  status: string;
  buyerLabel: string;
  minPrice: number;
  productLabel: string;
  priority: number;
};

export type PingTreeRecord = {
  id: string;
  displayId: number;
  name: string;
  strategy: PingTreeStrategy;
  activeCampaignIds: string[];
  createdAt: string;
  updatedAt: string;
};

export const PING_TREE_STRATEGY_OPTIONS: PingTreeStrategy[] = ["Priority"];

type PingTreeDoc = {
  _id?: { toString(): string };
  displayId: number;
  name: string;
  strategy: PingTreeStrategy;
  activeCampaignIds?: string[];
  campaignPriorities?: Record<string, number> | Map<string, number>;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

export function toPingTreeRecord(doc: PingTreeDoc): PingTreeRecord {
  return {
    id: doc._id?.toString() ?? "",
    displayId: doc.displayId,
    name: doc.name,
    strategy: doc.strategy,
    activeCampaignIds: doc.activeCampaignIds ?? [],
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : "",
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : "",
  };
}
