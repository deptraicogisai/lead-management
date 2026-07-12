"use client";

import { useEffect, useMemo, useState } from "react";
import { PrimaryButton, secondaryButtonClassName } from "@/components/ui/form-controls";
import { Modal } from "@/components/ui/modal";
import {
  SearchableMultiSelect,
  type SearchableMultiSelectOption,
} from "@/components/ui/searchable-multi-select";
import { toast } from "@/lib/toast";

type CopyCampaignPlDnplModalProps = {
  open: boolean;
  sourceCampaignId: string;
  verticalId?: string;
  plDnplListIds: string[];
  onClose: () => void;
  onApplied?: () => void;
};

export function CopyCampaignPlDnplModal({
  open,
  sourceCampaignId,
  verticalId,
  plDnplListIds,
  onClose,
  onApplied,
}: CopyCampaignPlDnplModalProps) {
  const [campaignOptions, setCampaignOptions] = useState<SearchableMultiSelectOption[]>([]);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const selectableOptions = useMemo(
    () => campaignOptions.filter((option) => option.id !== sourceCampaignId),
    [campaignOptions, sourceCampaignId]
  );

  useEffect(() => {
    if (!open) {
      setSelectedCampaignIds([]);
      return;
    }

    const loadCampaigns = async () => {
      setIsLoadingCampaigns(true);
      try {
        const response = await fetch("/api/campaigns?pageSize=1000" + (verticalId ? `&productId=${encodeURIComponent(verticalId)}` : ""));
        if (!response.ok) {
          toast.error("Failed to load campaigns.", "Copy PL/DNPL");
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

  const handleApply = async () => {
    if (selectedCampaignIds.length === 0) {
      toast.error("Please select at least one campaign.", "Copy PL/DNPL");
      return;
    }

    setIsApplying(true);
    try {
      const response = await fetch(`/api/campaigns/${encodeURIComponent(sourceCampaignId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "copy-pl-dnpl",
          targetCampaignIds: selectedCampaignIds,
          plDnplListIds,
        }),
      });

      const data = (await response.json()) as { message?: string; updatedCount?: number };

      if (!response.ok) {
        toast.error(data.message ?? "Failed to copy PL/DNPL settings.", "Copy PL/DNPL");
        return;
      }

      toast.success(
        data.message ??
          `PL/DNPL settings copied to ${data.updatedCount ?? selectedCampaignIds.length} campaign(s).`,
        "Copy PL/DNPL"
      );
      onApplied?.();
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Select campaigns"
      description="Apply will replace Present & Do Not Present Lists settings on the selected campaigns with this campaign's current selection."
      onClose={onClose}
      panelClassName="max-w-lg"
      actions={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isApplying}
            className={secondaryButtonClassName}
          >
            Cancel
          </button>
          <PrimaryButton type="button" onClick={() => void handleApply()} disabled={isApplying}>
            {isApplying ? "Applying..." : "Apply"}
          </PrimaryButton>
        </>
      }
    >
      <SearchableMultiSelect
        selectedIds={selectedCampaignIds}
        onChange={setSelectedCampaignIds}
        options={selectableOptions}
        placeholder="Select campaigns..."
        searchPlaceholder="Search campaigns..."
        isLoading={isLoadingCampaigns}
        emptyMessage="No other campaigns available."
      />
    </Modal>
  );
}
