import type { CampaignType } from "@/lib/campaign";
import type { CampaignTestMockResponse } from "@/lib/campaign-test-mock";

export type PingTreeStrategy = "Priority";
export type PingTreeCampaignType = CampaignType;
export const PING_TREE_CAMPAIGN_TYPE_TABS: PingTreeCampaignType[] = ["Redirect", "Silent"];

export type PingTreeCampaignCard = {
  id: string;
  displayId: number;
  name: string;
  status: string;
  buyerLabel: string;
  minPrice: number;
  productLabel: string;
  priority: number;
  testMock: CampaignTestMockResponse | null;
};

export type PingTreeRecord = {
  id: string;
  displayId: number;
  name: string;
  campaignType: PingTreeCampaignType;
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
  campaignType?: PingTreeCampaignType | null;
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
    campaignType: doc.campaignType === "Silent" ? "Silent" : "Redirect",
    strategy: doc.strategy,
    activeCampaignIds: doc.activeCampaignIds ?? [],
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : "",
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : "",
  };
}
