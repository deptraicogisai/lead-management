"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Link2, X } from "lucide-react";
import { Input } from "@/components/ui/form-controls";
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
};

function formatListLabel(list: PresentListRecord) {
  return `[${list.displayId}] ${list.name} (${list.listType}) · ${list.applyToField}`;
}

export function CampaignPlDnplSettings({
  buyerId,
  presentLists,
  buyerPlDnplListIds,
  selectedIds,
  copyToOtherCampaigns,
  onSelectedIdsChange,
  onCopyToOtherCampaignsChange,
}: CampaignPlDnplSettingsProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleList = (listId: string) => {
    onSelectedIdsChange(
      selectedIds.includes(listId) ? selectedIds.filter((id) => id !== listId) : [...selectedIds, listId]
    );
  };

  const removeList = (listId: string) => {
    onSelectedIdsChange(selectedIds.filter((id) => id !== listId));
  };

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

          <Input
            readOnly
            value={
              buyerSelectedLists.length > 0
                ? buyerSelectedLists.map((list) => formatListLabel(list)).join(", ")
                : "No Options Selected"
            }
            className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          />

          <Link
            href={`/buyers/${encodeURIComponent(buyerId)}`}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
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

          <div ref={dropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen((open) => !open)}
              className="flex min-h-10 w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                {campaignSelectedLists.length === 0 ? (
                  <span className="text-slate-400">Select PL/DNPL lists...</span>
                ) : (
                  campaignSelectedLists.map((list) => (
                    <span
                      key={list.id}
                      className={cn(
                        "inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                        list.listType === "PL"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                          : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                      )}
                    >
                      <span className="truncate">[{list.displayId}] {list.name}</span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation();
                          removeList(list.id);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.stopPropagation();
                            removeList(list.id);
                          }
                        }}
                        className="rounded-full hover:bg-black/10"
                      >
                        <X size={12} />
                      </span>
                    </span>
                  ))
                )}
              </span>
              <ChevronDown size={16} className="shrink-0 text-slate-400" />
            </button>

            {dropdownOpen ? (
              <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-900">
                {presentLists.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-slate-500">No present lists found for this product.</p>
                ) : (
                  presentLists.map((list) => {
                    const checked = selectedIds.includes(list.id);
                    return (
                      <button
                        key={list.id}
                        type="button"
                        onClick={() => toggleList(list.id)}
                        className={cn(
                          "flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800",
                          checked && "bg-slate-50 dark:bg-slate-800/80"
                        )}
                      >
                        <input type="checkbox" readOnly checked={checked} className="mt-0.5" />
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "mr-2 rounded-full px-2 py-0.5 text-xs font-medium",
                              list.listType === "PL"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                                : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                            )}
                          >
                            {list.listType}
                          </span>
                          {formatListLabel(list)}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            ) : null}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={copyToOtherCampaigns}
            onChange={(event) => onCopyToOtherCampaignsChange(event.target.checked)}
          />
          Copy &apos;Present &amp; Do Not Present Lists&apos; settings to other campaigns
        </label>
      </section>
    </div>
  );
}
