import { buildDefaultLeadDetailsDateRange } from "@/lib/date-range";
import { buildPublisherLeadDisplayCode, formatPublisherLeadTime } from "@/lib/publisher-lead-details";

export type BuyerLeadDetailsRow = {
  id: string;
  leadId: string;
  displayLeadCode: string;
  campaignId: string;
  campaignName: string;
  campaignDisplayId: number;
  buyerId: string;
  buyerCompany: string;
  pingTreeType: "Redirect" | "Silent";
  campaignOrder: number;
  buyerStatus: string;
  price: number | null;
  redirectUrl: string;
  rejectReason: string;
  errorReason: string;
  postLeadUrl: string;
  httpStatus: number;
  requestPayload: Record<string, unknown> | null;
  responseBody: string;
  responseHeaders: Record<string, string>;
  postedAt: string;
  validationErrors: string[];
};

export type BuyerLeadDetailsFilters = {
  leadId: string;
  buyerId: string;
  campaignId: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  tableSearch: string;
};

const defaultDateRange = buildDefaultLeadDetailsDateRange();

export const defaultBuyerLeadDetailsFilters: BuyerLeadDetailsFilters = {
  leadId: "",
  buyerId: "",
  campaignId: "",
  status: "All",
  dateFrom: defaultDateRange.from,
  dateTo: defaultDateRange.to,
  tableSearch: "",
};

export function formatBuyerLeadStatusLabel(status: string) {
  if (status === "Accept") return "Sold";
  return status;
}

export function formatBuyerLeadPrice(price: number | null) {
  if (price == null || !Number.isFinite(price)) return "—";
  return `$${price.toFixed(2)}`;
}

export { buildPublisherLeadDisplayCode as buildBuyerLeadDisplayCode, formatPublisherLeadTime as formatBuyerLeadTime };
