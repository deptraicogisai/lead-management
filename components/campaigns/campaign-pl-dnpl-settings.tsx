"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ExternalLink, Link2 } from "lucide-react";
import {
  SearchableMultiSelect,
  type SearchableMultiSelectOption,
} from "@/components/ui/searchable-multi-select";
import type { PresentListRecord } from "@/lib/present-list";
import { cn } from "@/lib/utils";

type CampaignPlDnplSettingsProps = {
  buyerId: string;
  presentLists: PresentListRecord[];
  buyerPlDnplListIds: string[];
  selectedIds: string[];
  copyToOtherCampaigns: boolean;
  onSelectedIdsChange: (ids: string[]) => void;
  onCopyToOtherCampaignsChange: (value: boolean) => void;
  onCopyClick: () => void;
};

function toOption(list: PresentListRecord): SearchableMultiSelectOption {
  return {
    id: list.id,
    displayId: list.displayId,
    label: `${list.name} (${list.listType})`,
    description: list.applyToField,
  };
}

export function CampaignPlDnplSettings({
  buyerId,
  presentLists,
  buyerPlDnplListIds,
  selectedIds,
  copyToOtherCampaigns,
  onSelectedIdsChange,
  onCopyToOtherCampaignsChange,
  onCopyClick,
}: CampaignPlDnplSettingsProps) {
  const options = useMemo(() => presentLists.map(toOption), [presentLists]);

  const buyerSelectedLists = useMemo(
    () => presentLists.filter((list) => buyerPlDnplListIds.includes(list.id)),
    [buyerPlDnplListIds, presentLists]
  );

  const campaignSelectedLists = useMemo(
    () => presentLists.filter((list) => selectedIds.includes(list.id)),
    [presentLists, selectedIds]
  );

  const fieldConflict = useMemo(() => {
    const fields = campaignSelectedLists.map((list) => list.applyToField);
    return new Set(fields).size !== fields.length;
  }, [campaignSelectedLists]);

  return (
    <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
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

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Buyer level Present &amp; Do Not Present Lists Settings
        </h3>

        <div className="grid gap-2 md:grid-cols-[180px_minmax(0,1fr)_auto] md:items-center">
          <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
            Selected PL/DNPL
            <Link2 size={14} className="text-sky-500" />
          </label>

          <div
            aria-readonly="true"
            className="flex min-h-10 w-full cursor-not-allowed select-none items-center rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-left text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-300"
          >
            <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              {buyerSelectedLists.length === 0 ? (
                <span className="text-slate-400">No Options Selected</span>
              ) : (
                buyerSelectedLists.map((list) => (
                  <span
                    key={list.id}
                    className={cn(
                      "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium opacity-80",
                      list.listType === "PL"
                        ? "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-200"
                        : "border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/20 dark:text-rose-200"
                    )}
                  >
                    <span className="truncate">
                      [{list.displayId}] {list.name}
                    </span>
                  </span>
                ))
              )}
            </span>
          </div>

          <Link
            href={`/buyers/${encodeURIComponent(buyerId)}?tab=pl-dnpl`}
            title="View buyer PL/DNPL settings"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-blue-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-blue-300"
          >
            <ExternalLink size={15} />
            View
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Campaign level Present &amp; Do Not Present Lists Settings
        </h3>

        <div className="grid gap-2 md:grid-cols-[180px_minmax(0,1fr)] md:items-start">
          <label className="flex items-center gap-1.5 pt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            Select PL/DNPL
            <Link2 size={14} className="text-sky-500" />
          </label>

          <SearchableMultiSelect
            selectedIds={selectedIds}
            onChange={onSelectedIdsChange}
            options={options}
            placeholder="Select PL/DNPL lists..."
            searchPlaceholder="Search PL/DNPL lists..."
            emptyMessage="No present lists found for this product."
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={copyToOtherCampaigns}
            onChange={(event) => {
              const checked = event.target.checked;
              onCopyToOtherCampaignsChange(checked);
              if (checked) {
                onCopyClick();
              }
            }}
          />
          Copy &apos;Present &amp; Do Not Present Lists&apos; settings to other campaigns
        </label>
      </section>
    </div>
  );
}
