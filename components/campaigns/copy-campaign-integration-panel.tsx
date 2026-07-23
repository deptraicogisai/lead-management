"use client";

import { useEffect, useMemo, useState } from "react";
import { CopyToTargetsPanel } from "@/components/ui/copy-to-targets-panel";
import { type SearchableMultiSelectOption } from "@/components/ui/searchable-multi-select";
import { toast } from "@/lib/toast";

type CopyCampaignIntegrationPanelProps = {
  open: boolean;
  sourceCampaignId: string;
  integrationId?: string;
  verticalId?: string;
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
};

export function CopyCampaignIntegrationPanel({
  open,
  sourceCampaignId,
  integrationId,
  verticalId,
  selectedIds,
  onSelectedIdsChange,
}: CopyCampaignIntegrationPanelProps) {
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

    if (!integrationId?.trim()) {
      setCampaignOptions([]);
      return;
    }

    const loadCampaigns = async () => {
      setIsLoadingCampaigns(true);
      try {
        const params = new URLSearchParams({
          pageSize: "1000",
          integrationId,
        });
        if (verticalId) {
          params.set("productId", verticalId);
        }

        const response = await fetch(`/api/campaigns?${params.toString()}`);
        if (!response.ok) {
          toast.error("Failed to load campaigns.", "Copy Integration");
          return;
        }

        const data = (await response.json()) as {
          items: Array<{
            id: string;
            displayId: number;
            name: string;
            buyerLabel: string;
            productLabel: string;
            integrationId?: string;
          }>;
        };

        setCampaignOptions(
          data.items
            .filter((campaign) => campaign.integrationId === integrationId)
            .map((campaign) => ({
              id: campaign.id,
              displayId: campaign.displayId,
              label: campaign.name,
            }))
        );
      } finally {
        setIsLoadingCampaigns(false);
      }
    };

    void loadCampaigns();
  }, [open, integrationId, verticalId]);

  useEffect(() => {
    if (!open || selectableOptions.length === 0) {
      return;
    }

    const allowed = new Set(selectableOptions.map((option) => option.id));
    const nextSelected = selectedIds.filter((id) => allowed.has(id));
    if (nextSelected.length !== selectedIds.length) {
      onSelectedIdsChange(nextSelected);
    }
  }, [open, selectableOptions, selectedIds, onSelectedIdsChange]);

  return (
    <CopyToTargetsPanel
      open={open}
      title="Select Campaigns"
      description="Only campaigns that already use the same Integration are listed. Saving will replace their Integration configuration with this campaign's settings."
      selectedIds={selectedIds}
      onSelectedIdsChange={onSelectedIdsChange}
      options={selectableOptions}
      isLoading={isLoadingCampaigns}
      placeholder="Select campaigns..."
      searchPlaceholder="Search campaigns..."
      emptyMessage="No other campaigns use this Integration."
    />
  );
}
