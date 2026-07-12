"use client";

import { useEffect, useMemo, useState } from "react";
import { PrimaryButton, secondaryButtonClassName } from "@/components/ui/form-controls";
import { Modal } from "@/components/ui/modal";
import {
  SearchableMultiSelect,
  type SearchableMultiSelectOption,
} from "@/components/ui/searchable-multi-select";
import type { CampaignGeneralFilter } from "@/lib/campaign";
import { toast } from "@/lib/toast";

type CopyPublisherFiltersModalProps = {
  open: boolean;
  sourceSellerId: string;
  mappingId: string;
  generalFilters: CampaignGeneralFilter[];
  onClose: () => void;
  onApplied?: () => void;
};

export function CopyPublisherFiltersModal({
  open,
  sourceSellerId,
  mappingId,
  generalFilters,
  onClose,
  onApplied,
}: CopyPublisherFiltersModalProps) {
  const [publisherOptions, setPublisherOptions] = useState<SearchableMultiSelectOption[]>([]);
  const [selectedPublisherIds, setSelectedPublisherIds] = useState<string[]>([]);
  const [isLoadingPublishers, setIsLoadingPublishers] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const selectableOptions = useMemo(
    () => publisherOptions.filter((option) => option.id !== sourceSellerId),
    [publisherOptions, sourceSellerId]
  );

  useEffect(() => {
    if (!open) {
      setSelectedPublisherIds([]);
      return;
    }

    const loadPublishers = async () => {
      setIsLoadingPublishers(true);
      try {
        const response = await fetch("/api/sellers");
        if (!response.ok) {
          toast.error("Failed to load publishers.", "Copy Filters");
          return;
        }

        const data = (await response.json()) as Array<{
          id: string;
          name: string;
          email?: string;
          displayId?: number;
        }>;

        setPublisherOptions(
          data.map((seller) => ({
            id: seller.id,
            label: seller.name,
            description: seller.email,
            displayId: seller.displayId,
          }))
        );
      } finally {
        setIsLoadingPublishers(false);
      }
    };

    void loadPublishers();
  }, [open]);

  const handleApply = async () => {
    if (selectedPublisherIds.length === 0) {
      toast.error("Please select at least one publisher.", "Copy Filters");
      return;
    }

    setIsApplying(true);
    try {
      const response = await fetch(
        `/api/sellers/${encodeURIComponent(sourceSellerId)}/verticals/mappings/${encodeURIComponent(mappingId)}/intake-settings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "copy-filters",
            targetSellerIds: selectedPublisherIds,
            generalFilters,
          }),
        }
      );

      const data = (await response.json()) as { message?: string; updatedCount?: number };

      if (!response.ok) {
        toast.error(data.message ?? "Failed to copy filter settings.", "Copy Filters");
        return;
      }

      toast.success(
        data.message ??
          `Filter settings copied to ${data.updatedCount ?? selectedPublisherIds.length} publisher(s).`,
        "Copy Filters"
      );
      onApplied?.();
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Select publishers"
      description="Apply will replace Filter settings on the selected publishers with this publisher's current filters for the same product."
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
        selectedIds={selectedPublisherIds}
        onChange={setSelectedPublisherIds}
        options={selectableOptions}
        placeholder="Select publishers..."
        searchPlaceholder="Search publishers..."
        isLoading={isLoadingPublishers}
        emptyMessage="No other publishers available."
      />
    </Modal>
  );
}
