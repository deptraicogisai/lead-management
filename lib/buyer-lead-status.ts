export const BUYER_LEAD_STATUSES = [
  "Accept",
  "Reject",
  "Ping Reject",
  "Timeout",
  "Price Conflict",
  "Error",
  "Price Reject",
  "Skipped",
  "Delay Posting",
] as const;

export type BuyerLeadStatus = (typeof BUYER_LEAD_STATUSES)[number];

export const BUYER_LEAD_DETAILS_STATUS_OPTIONS = ["All", ...BUYER_LEAD_STATUSES];

/** Non-Accept statuses shown when drilling into Reject from Buyer Performance Summary. */
export const BUYER_LEAD_REJECT_GROUP_STATUSES: BuyerLeadStatus[] = [
  "Reject",
  "Ping Reject",
  "Timeout",
  "Price Conflict",
  "Error",
  "Price Reject",
  "Skipped",
];
