export type CampaignTemplateSource = {
  id?: string;
  displayId?: number | string;
  name?: string;
  status?: string;
  campaignType?: string;
  timezone?: string;
  minPrice?: number | string;
  buyerId?: string;
  buyerLabel?: string;
  productLabel?: string;
  verticalId?: string;
  integrationId?: string;
  integrationLabel?: string;
  inPingTree?: boolean;
  integrationSettings?: {
    configValues?: Record<string, string>;
  };
};

export const CAMPAIGN_TEMPLATE_FIELDS: Array<{ path: string; description: string }> = [
  { path: "name", description: "Campaign name" },
  { path: "displayId", description: "Campaign display ID" },
  { path: "minPrice", description: "Minimum price" },
  { path: "campaignType", description: "Redirect or Silent" },
  { path: "status", description: "Campaign status" },
  { path: "timezone", description: "Campaign timezone" },
  { path: "buyerId", description: "Buyer ID" },
  { path: "buyerLabel", description: "Buyer company name" },
  { path: "productLabel", description: "Product / vertical label" },
  { path: "verticalId", description: "Vertical ID" },
  { path: "integrationId", description: "Integration ID" },
  { path: "integrationLabel", description: "Integration name" },
  { path: "id", description: "Campaign ID" },
  { path: "inPingTree", description: "Whether campaign is in a ping tree" },
];

export const CAMPAIGN_TEMPLATE_PATHS = new Set(CAMPAIGN_TEMPLATE_FIELDS.map((field) => field.path));

export function toCampaignFieldTemplate(path: string) {
  const normalized = path.trim();
  if (!normalized) return "{{ campaign. }}";
  return `{{ campaign.${normalized} }}`;
}

export function buildCampaignTemplateContext(source: CampaignTemplateSource = {}): Record<string, unknown> {
  const configValues = source.integrationSettings?.configValues ?? {};

  return {
    id: source.id?.trim() ?? "",
    displayId: source.displayId != null ? String(source.displayId) : "",
    name: source.name?.trim() ?? "",
    status: source.status?.trim() ?? "",
    campaignType: source.campaignType?.trim() ?? "",
    timezone: source.timezone?.trim() ?? "",
    minPrice: source.minPrice != null ? String(source.minPrice) : "",
    buyerId: source.buyerId?.trim() ?? "",
    buyerLabel: source.buyerLabel?.trim() ?? "",
    productLabel: source.productLabel?.trim() ?? "",
    verticalId: source.verticalId?.trim() ?? "",
    integrationId: source.integrationId?.trim() ?? "",
    integrationLabel: source.integrationLabel?.trim() ?? "",
    inPingTree: Boolean(source.inPingTree),
    integrationSettings: {
      configValues,
    },
  };
}
