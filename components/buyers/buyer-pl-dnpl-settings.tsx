"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleHelp } from "lucide-react";
import { CopyToTargetsPanel } from "@/components/ui/copy-to-targets-panel";
import { Checkbox } from "@/components/ui/form-controls";
import {
  SearchableMultiSelect,
  type SearchableMultiSelectOption,
} from "@/components/ui/searchable-multi-select";
import type { PresentListRecord } from "@/lib/present-list";
import { toast } from "@/lib/toast";

type BuyerPlDnplSettingsProps = {
  buyerId: string;
  presentLists: PresentListRecord[];
  selectedIds: string[];
  copyToOtherBuyers: boolean;
  copyBuyerIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  onCopyToOtherBuyersChange: (value: boolean) => void;
  onCopyBuyerIdsChange: (ids: string[]) => void;
};

function toOption(list: PresentListRecord): SearchableMultiSelectOption {
  return {
    id: list.id,
    displayId: list.displayId,
    label: `${list.listType}: ${list.name}`,
    description: list.productLabel,
  };
}

export function BuyerPlDnplSettings({
  buyerId,
  presentLists,
  selectedIds,
  copyToOtherBuyers,
  copyBuyerIds,
  onSelectedIdsChange,
  onCopyToOtherBuyersChange,
  onCopyBuyerIdsChange,
}: BuyerPlDnplSettingsProps) {
  const options = useMemo(() => presentLists.map(toOption), [presentLists]);
  const [buyerOptions, setBuyerOptions] = useState<SearchableMultiSelectOption[]>([]);
  const [isLoadingBuyers, setIsLoadingBuyers] = useState(false);

  const selectedLists = useMemo(
    () => presentLists.filter((list) => selectedIds.includes(list.id)),
    [presentLists, selectedIds]
  );

  const fieldConflict = useMemo(() => {
    const fields = selectedLists.map((list) => list.applyToField);
    return new Set(fields).size !== fields.length;
  }, [selectedLists]);

  const selectableBuyerOptions = useMemo(
    () => buyerOptions.filter((option) => option.id !== buyerId),
    [buyerId, buyerOptions]
  );

  useEffect(() => {
    if (!copyToOtherBuyers) {
      return;
    }

    const loadBuyers = async () => {
      setIsLoadingBuyers(true);
      try {
        const response = await fetch("/api/buyers?pageSize=1000");
        if (!response.ok) {
          toast.error("Failed to load buyers.", "Copy PL/DNPL");
          return;
        }

        const data = (await response.json()) as {
          items?: Array<{ id: string; displayId?: number; name: string; email?: string }>;
        };

        setBuyerOptions(
          (data.items ?? []).map((buyer) => ({
            id: buyer.id,
            displayId: buyer.displayId,
            label: buyer.name,
            description: buyer.email,
          }))
        );
      } finally {
        setIsLoadingBuyers(false);
      }
    };

    void loadBuyers();
  }, [copyToOtherBuyers]);

  return (
    <div className="space-y-5">
      <div className="border-l-4 border-amber-700 bg-amber-50/80 px-4 py-3 text-sm leading-relaxed text-slate-700 dark:border-amber-500 dark:bg-amber-500/10 dark:text-slate-200">
        Please note that the multiselect option for the PL/DNPL lists cannot be used for lists on the same lead
        fields (e.g., two or more PL/DNPL lists for the ZIP code). Adding multiple lists on the same lead field
        will result in a filtration conflict for the campaign.
      </div>

      {fieldConflict ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
          Multiple selected lists use the same lead field. Remove duplicates to avoid filtration conflicts.
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
        <label className="flex shrink-0 items-center gap-1.5 pt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          Select PL/DNPL to apply to this buyer
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-slate-500 dark:border-slate-500 dark:text-slate-400">
            <CircleHelp size={10} strokeWidth={2.5} />
          </span>
        </label>

        <div className="w-full max-w-2xl min-w-0">
          <SearchableMultiSelect
            selectedIds={selectedIds}
            onChange={onSelectedIdsChange}
            options={options}
            placeholder="Select PL/DNPL lists..."
            searchPlaceholder="Search PL/DNPL lists..."
            emptyMessage="No present lists found."
          />
        </div>
      </div>

      <div className="space-y-3">
        <Checkbox
          checked={copyToOtherBuyers}
          onChange={(checked) => {
            onCopyToOtherBuyersChange(checked);
            if (!checked) {
              onCopyBuyerIdsChange([]);
            }
          }}
          label={<>Copy &quot;PL/DNPL&quot; settings to other buyers</>}
          className="w-fit"
        />

        <CopyToTargetsPanel
          open={copyToOtherBuyers}
          title="Select Buyers"
          description="Saving will replace Present & Do Not Present Lists settings on the selected buyers with this buyer's current selection."
          selectedIds={copyBuyerIds}
          onSelectedIdsChange={onCopyBuyerIdsChange}
          options={selectableBuyerOptions}
          isLoading={isLoadingBuyers}
          placeholder="Select buyers..."
          searchPlaceholder="Search buyers..."
          emptyMessage="No other buyers available."
        />
      </div>
    </div>
  );
}
