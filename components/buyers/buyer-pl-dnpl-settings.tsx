"use client";

import { useMemo } from "react";
import { CircleHelp } from "lucide-react";
import {
  SearchableMultiSelect,
  type SearchableMultiSelectOption,
} from "@/components/ui/searchable-multi-select";
import type { PresentListRecord } from "@/lib/present-list";

type BuyerPlDnplSettingsProps = {
  presentLists: PresentListRecord[];
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
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
  presentLists,
  selectedIds,
  onSelectedIdsChange,
}: BuyerPlDnplSettingsProps) {
  const options = useMemo(() => presentLists.map(toOption), [presentLists]);

  const selectedLists = useMemo(
    () => presentLists.filter((list) => selectedIds.includes(list.id)),
    [presentLists, selectedIds]
  );

  const fieldConflict = useMemo(() => {
    const fields = selectedLists.map((list) => list.applyToField);
    return new Set(fields).size !== fields.length;
  }, [selectedLists]);

  return (
    <div className="space-y-6">
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

      <div className="grid gap-2 md:grid-cols-[260px_minmax(0,1fr)] md:items-start">
        <label className="flex items-center gap-1.5 pt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          Select PL/DNPL to apply to this buyer
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-slate-500 dark:border-slate-500 dark:text-slate-400">
            <CircleHelp size={10} strokeWidth={2.5} />
          </span>
        </label>

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
  );
}
