import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import { ensureIntegrationBuilderStatusMigrated, IntegrationBuilderModel } from "@/lib/models/integration-builder";
import { excludeDeletedStatusFilter } from "@/lib/soft-delete";

export type IntegrationOption = {
  id: string;
  displayId: number;
  name: string;
  product: string;
  label: string;
};

export function formatIntegrationLabel(integration: {
  displayId: number;
  name: string;
  product: string;
}) {
  return `[${integration.displayId}] ${integration.name} (Custom) (${integration.product})`;
}

export async function getAvailableIntegrationOptions(): Promise<IntegrationOption[]> {
  await ensureVerticalCollectionMigrated();
  await ensureIntegrationBuilderStatusMigrated();

  const [integrations, verticals] = await Promise.all([
    IntegrationBuilderModel.find(excludeDeletedStatusFilter()).sort({ displayId: -1 }).lean(),
    VerticalModel.find(excludeDeletedStatusFilter()).select({ _id: 1, name: 1 }).lean(),
  ]);

  const verticalNameById = new Map(verticals.map((vertical) => [vertical._id.toString(), vertical.name]));

  return integrations.map((integration) => {
    const verticalId =
      typeof integration.verticalRef === "string"
        ? integration.verticalRef
        : integration.verticalRef?.toString() ?? "";
    const product = verticalNameById.get(verticalId) ?? "Unknown";

    return {
      id: integration._id.toString(),
      displayId: integration.displayId,
      name: integration.name,
      product,
      label: formatIntegrationLabel({
        displayId: integration.displayId,
        name: integration.name,
        product,
      }),
    };
  });
}

export function getIntegrationLabelsFromRefs(
  integrationRefs: Array<{ toString(): string } | string> | undefined,
  options: IntegrationOption[]
) {
  if (!integrationRefs?.length) return [];

  const optionById = new Map(options.map((option) => [option.id, option.label]));
  return integrationRefs
    .map((ref) => (typeof ref === "string" ? ref : ref.toString()))
    .map((id) => optionById.get(id))
    .filter((label): label is string => Boolean(label));
}

export async function getIntegrationLabelsByBuyerName() {
  const options = await getAvailableIntegrationOptions();
  const labelsByName = new Map<string, string[]>();

  for (const option of options) {
    const key = option.name.trim().toLowerCase();
    const current = labelsByName.get(key) ?? [];
    current.push(option.label);
    labelsByName.set(key, current);
  }

  return labelsByName;
}

export function resolveBuyerIntegrations(
  doc: {
    integrationRefs?: Array<{ toString(): string } | string> | null;
    name?: string | null;
    company?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  },
  options: IntegrationOption[]
) {
  const refs = doc.integrationRefs ?? [];
  const idsFromRefs = refs.map((ref) => (typeof ref === "string" ? ref : ref.toString()));
  const labelsFromRefs = getIntegrationLabelsFromRefs(refs, options);

  if (labelsFromRefs.length > 0) {
    return { integrationIds: idsFromRefs, integrationLabels: labelsFromRefs };
  }

  const buyerName =
    doc.name?.trim() ||
    doc.company?.trim() ||
    `${doc.firstName ?? ""} ${doc.lastName ?? ""}`.trim();
  const matched = options.filter((option) => option.name.trim().toLowerCase() === buyerName.toLowerCase());

  return {
    integrationIds: matched.map((option) => option.id),
    integrationLabels: matched.map((option) => option.label),
  };
}
