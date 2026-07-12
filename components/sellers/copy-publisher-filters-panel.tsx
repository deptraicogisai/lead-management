"use client";

import { useEffect, useMemo, useState } from "react";
import { CopyToTargetsPanel } from "@/components/ui/copy-to-targets-panel";
import { type SearchableMultiSelectOption } from "@/components/ui/searchable-multi-select";
import { toast } from "@/lib/toast";

type CopyPublisherFiltersPanelProps = {
  open: boolean;
  sourceSellerId: string;
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
};

export function CopyPublisherFiltersPanel({
  open,
  sourceSellerId,
  selectedIds,
  onSelectedIdsChange,
}: CopyPublisherFiltersPanelProps) {
  const [publisherOptions, setPublisherOptions] = useState<SearchableMultiSelectOption[]>([]);
  const [isLoadingPublishers, setIsLoadingPublishers] = useState(false);

  const selectableOptions = useMemo(
    () => publisherOptions.filter((option) => option.id !== sourceSellerId),
    [publisherOptions, sourceSellerId]
  );

  useEffect(() => {
    if (!open) {
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

  return (
    <CopyToTargetsPanel
      open={open}
      title="Select Publishers"
      description="Saving will replace Filter settings on the selected publishers with this publisher's current filters for the same product."
      selectedIds={selectedIds}
      onSelectedIdsChange={onSelectedIdsChange}
      options={selectableOptions}
      isLoading={isLoadingPublishers}
      placeholder="Select publishers..."
      searchPlaceholder="Search publishers..."
      emptyMessage="No other publishers available."
    />
  );
}
