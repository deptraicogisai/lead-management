import { BuyerModel } from "@/lib/models/buyer";
import { BuyerRequestLogModel } from "@/lib/models/buyer-request-log";
import { CampaignModel } from "@/lib/models/campaign";
import { VerticalModel } from "@/lib/models/industry";
import { IntegrationBuilderModel } from "@/lib/models/integration-builder";
import { LeadDeliveryModel } from "@/lib/models/lead-delivery";
import { MappingTestLeadLogModel } from "@/lib/models/mapping-test-lead-log";
import { PresentListModel } from "@/lib/models/present-list";
import { SellerModel } from "@/lib/models/seller";
import { SellerLeadModel } from "@/lib/models/seller-lead";
import { VerticalMappingModel } from "@/lib/models/vertical-mapping";

export type DataCleanupTargetDefinition = {
  key: string;
  label: string;
  description: string;
  listHref: string;
  category: "Operational Data" | "Configuration";
};

export const DATA_CLEANUP_TARGETS: DataCleanupTargetDefinition[] = [
  {
    key: "leads",
    label: "Leads",
    description: "Permanently removes all publisher leads saved after intake.",
    listHref: "/leads",
    category: "Operational Data",
  },
  {
    key: "lead-deliveries",
    label: "Distributions",
    description: "Permanently removes all buyer delivery attempts linked to leads.",
    listHref: "/distributions",
    category: "Operational Data",
  },
  {
    key: "logs",
    label: "HTTP Logs",
    description: "Permanently removes all seller intake and buyer delivery request logs.",
    listHref: "/logs",
    category: "Operational Data",
  },
  {
    key: "test-lead-logs",
    label: "API Test Lead Logs",
    description: "Permanently removes all saved test lead submissions from API Configuration.",
    listHref: "/api-config",
    category: "Operational Data",
  },
  {
    key: "buyers",
    label: "Buyers",
    description: "Permanently removes all buyers.",
    listHref: "/buyers",
    category: "Configuration",
  },
  {
    key: "publishers",
    label: "Publishers",
    description: "Permanently removes all publishers.",
    listHref: "/sellers",
    category: "Configuration",
  },
  {
    key: "campaigns",
    label: "Campaigns",
    description: "Permanently removes all campaigns.",
    listHref: "/campaigns",
    category: "Configuration",
  },
  {
    key: "verticals",
    label: "Verticals",
    description: "Permanently removes all verticals.",
    listHref: "/verticals",
    category: "Configuration",
  },
  {
    key: "integrations",
    label: "Integration Builder",
    description: "Permanently removes all integration builder records.",
    listHref: "/integration-builder",
    category: "Configuration",
  },
  {
    key: "api-config",
    label: "API Configuration",
    description: "Permanently removes all publisher API mappings.",
    listHref: "/api-config",
    category: "Configuration",
  },
  {
    key: "present-lists",
    label: "Present / DNP Lists",
    description: "Permanently removes all present and DNP lists.",
    listHref: "/present-lists",
    category: "Configuration",
  },
];

export type DataCleanupTargetKey = (typeof DATA_CLEANUP_TARGETS)[number]["key"];

const TARGET_KEYS = new Set(DATA_CLEANUP_TARGETS.map((target) => target.key));

export function isDataCleanupTargetKey(value: string): value is DataCleanupTargetKey {
  return TARGET_KEYS.has(value);
}

export function resolveDataCleanupTargets(keys: string[]) {
  const uniqueKeys = [...new Set(keys.filter(isDataCleanupTargetKey))];
  return DATA_CLEANUP_TARGETS.filter((target) => uniqueKeys.includes(target.key));
}

export async function getDataCleanupTargetCounts() {
  const counts = await Promise.all(
    DATA_CLEANUP_TARGETS.map(async (target) => {
      let count = 0;

      switch (target.key) {
        case "leads":
          count = await SellerLeadModel.countDocuments({});
          break;
        case "lead-deliveries":
          count = await LeadDeliveryModel.countDocuments({});
          break;
        case "logs":
          count = await BuyerRequestLogModel.countDocuments({});
          break;
        case "test-lead-logs":
          count = await MappingTestLeadLogModel.countDocuments({});
          break;
        case "buyers":
          count = await BuyerModel.countDocuments({});
          break;
        case "publishers":
          count = await SellerModel.countDocuments({});
          break;
        case "campaigns":
          count = await CampaignModel.countDocuments({});
          break;
        case "verticals":
          count = await VerticalModel.countDocuments({});
          break;
        case "integrations":
          count = await IntegrationBuilderModel.countDocuments({});
          break;
        case "api-config":
          count = await VerticalMappingModel.countDocuments({});
          break;
        case "present-lists":
          count = await PresentListModel.countDocuments({});
          break;
        default:
          count = 0;
      }

      return {
        ...target,
        count,
      };
    })
  );

  return DATA_CLEANUP_TARGETS.map((target) => ({
    ...target,
    count: counts.find((item) => item.key === target.key)?.count ?? 0,
  }));
}

export async function clearDataCleanupTargets(keys: string[]) {
  const targets = resolveDataCleanupTargets(keys);
  const results: Array<{ key: string; label: string; clearedCount: number }> = [];

  for (const target of targets) {
    let clearedCount = 0;

    switch (target.key) {
      case "leads": {
        const result = await SellerLeadModel.deleteMany({});
        clearedCount = result.deletedCount ?? 0;
        break;
      }
      case "lead-deliveries": {
        const result = await LeadDeliveryModel.deleteMany({});
        clearedCount = result.deletedCount ?? 0;
        break;
      }
      case "logs": {
        const result = await BuyerRequestLogModel.deleteMany({});
        clearedCount = result.deletedCount ?? 0;
        break;
      }
      case "test-lead-logs": {
        const result = await MappingTestLeadLogModel.deleteMany({});
        clearedCount = result.deletedCount ?? 0;
        break;
      }
      case "buyers": {
        const result = await BuyerModel.deleteMany({});
        clearedCount = result.deletedCount ?? 0;
        break;
      }
      case "publishers": {
        const result = await SellerModel.deleteMany({});
        clearedCount = result.deletedCount ?? 0;
        break;
      }
      case "campaigns": {
        const result = await CampaignModel.deleteMany({});
        clearedCount = result.deletedCount ?? 0;
        break;
      }
      case "verticals": {
        const result = await VerticalModel.deleteMany({});
        clearedCount = result.deletedCount ?? 0;
        break;
      }
      case "integrations": {
        const result = await IntegrationBuilderModel.deleteMany({});
        clearedCount = result.deletedCount ?? 0;
        break;
      }
      case "api-config": {
        const result = await VerticalMappingModel.deleteMany({});
        clearedCount = result.deletedCount ?? 0;
        break;
      }
      case "present-lists": {
        const result = await PresentListModel.deleteMany({});
        clearedCount = result.deletedCount ?? 0;
        break;
      }
      default:
        clearedCount = 0;
    }

    results.push({
      key: target.key,
      label: target.label,
      clearedCount,
    });
  }

  return results;
}
