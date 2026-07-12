"use client";

import { useEffect, useMemo, useState } from "react";
import { CopyToTargetsPanel } from "@/components/ui/copy-to-targets-panel";
import { type SearchableMultiSelectOption } from "@/components/ui/searchable-multi-select";
import { toast } from "@/lib/toast";

type CopyCampaignFiltersPanelProps = {
  open: boolean;
  sourceCampaignId: string;
  verticalId?: string;
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
};

export function CopyCampaignFiltersPanel({
  open,
  sourceCampaignId,
  verticalId,
  selectedIds,
  onSelectedIdsChange,
}: CopyCampaignFiltersPanelProps) {
  const [campaignOptions, setCampaignOptions] = useState<SearchableMultiSelectOption[]>([]);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false);

  const selectableOptions = useMemo(
    () => campaignOptions.filter((option) => option.id !== sourceCampaignId),
    [campaignOptions, sourceCampaignId]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const loadCampaigns = async () => {
      setIsLoadingCampaigns(true);
      try {
        const response = await fetch(
          "/api/campaigns?pageSize=1000" +
            (verticalId ? `&productId=${encodeURIComponent(verticalId)}` : "")
        );
        if (!response.ok) {
          toast.error("Failed to load campaigns.", "Copy Filters");
          return;
        }

        const data = (await response.json()) as {
          items: Array<{
            id: string;
            displayId: number;
            name: string;
            buyerLabel: string;
            productLabel: string;
          }>;
        };

        setCampaignOptions(
          data.items.map((campaign) => ({
            id: campaign.id,
            displayId: campaign.displayId,
            label: campaign.name,
            description: `[${campaign.displayId}] ${campaign.buyerLabel} · ${campaign.productLabel}`,
          }))
        );
      } finally {
        setIsLoadingCampaigns(false);
      }
    };

    void loadCampaigns();
  }, [open, verticalId]);

  return (
    <CopyToTargetsPanel
      open={open}
      title="Select Campaigns"
      description="Saving will replace Filter settings on the selected campaigns with this campaign's current filters."
      selectedIds={selectedIds}
      onSelectedIdsChange={onSelectedIdsChange}
      options={selectableOptions}
      isLoading={isLoadingCampaigns}
      placeholder="Select campaigns..."
      searchPlaceholder="Search campaigns..."
      emptyMessage="No other campaigns available."
    />
  );
}
