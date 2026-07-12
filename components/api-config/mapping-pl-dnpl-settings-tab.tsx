"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleHelp } from "lucide-react";
import { PrimaryButton } from "@/components/ui/form-controls";
import { SectionLoading } from "@/components/ui/loading-indicator";
import {
  SearchableMultiSelect,
  type SearchableMultiSelectOption,
} from "@/components/ui/searchable-multi-select";
import type { PresentListRecord } from "@/lib/present-list";
import { toast } from "@/lib/toast";

type MappingPlDnplSettingsTabProps = {
  sellerId: string;
  mappingId: string;
};

type PlDnplSettingsResponse = {
  plDnplListIds: string[];
  verticalId: string;
  message?: string;
};

function toOption(list: PresentListRecord): SearchableMultiSelectOption {
  return {
    id: list.id,
    displayId: list.displayId,
    label: `${list.listType}: ${list.name}`,
    description: list.productLabel,
  };
}

export function MappingPlDnplSettingsTab({ sellerId, mappingId }: MappingPlDnplSettingsTabProps) {
  const [presentLists, setPresentLists] = useState<PresentListRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [verticalId, setVerticalId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const settingsUrl = `/api/sellers/${encodeURIComponent(sellerId)}/verticals/mappings/${encodeURIComponent(mappingId)}/pl-dnpl-settings`;

  const loadSettings = useCallback(async () => {
    if (!sellerId || !mappingId) return;

    setIsLoading(true);
    try {
      const response = await fetch(settingsUrl);
      const data = (await response.json().catch(() => null)) as PlDnplSettingsResponse | null;
      if (!response.ok) {
        toast.error(data?.message ?? "Failed to load PL/DNPL settings.");
        return;
      }

      setSelectedIds(Array.isArray(data?.plDnplListIds) ? data.plDnplListIds : []);
      setVerticalId(data?.verticalId?.trim() ?? "");
    } finally {
      setIsLoading(false);
    }
  }, [mappingId, sellerId, settingsUrl]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const loadPresentLists = async () => {
      const query = verticalId
        ? `?productId=${encodeURIComponent(verticalId)}&pageSize=1000`
        : "?pageSize=1000";
      const response = await fetch(`/api/present-lists${query}`);
      if (!response.ok) return;

      const data = (await response.json()) as { items?: PresentListRecord[] } | PresentListRecord[];
      const items = Array.isArray(data) ? data : (data.items ?? []);
      setPresentLists(items);
    };

    void loadPresentLists();
  }, [verticalId]);

  const options = useMemo(() => presentLists.map(toOption), [presentLists]);

  const selectedLists = useMemo(
    () => presentLists.filter((list) => selectedIds.includes(list.id)),
    [presentLists, selectedIds]
  );

  const fieldConflict = useMemo(() => {
    const fields = selectedLists.map((list) => list.applyToField);
    return new Set(fields).size !== fields.length;
  }, [selectedLists]);

  const handleSave = async () => {
    if (fieldConflict) {
      toast.error("Multiple selected lists use the same lead field.", "Validation Error");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(settingsUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plDnplListIds: selectedIds }),
      });
      const data = (await response.json().catch(() => null)) as PlDnplSettingsResponse | null;
      if (!response.ok) {
        toast.error(data?.message ?? "Failed to save PL/DNPL settings.");
        return;
      }

      setSelectedIds(Array.isArray(data?.plDnplListIds) ? data.plDnplListIds : selectedIds);
      toast.success("PL/DNPL settings saved successfully.");
    } catch {
      toast.error("Failed to save PL/DNPL settings.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <SectionLoading message="Loading PL/DNPL settings..." />;
  }

  return (
    <div className="space-y-6">
      <div className="border-l-4 border-amber-700 bg-amber-50/80 px-4 py-3 text-sm leading-relaxed text-slate-700 dark:border-amber-500 dark:bg-amber-500/10 dark:text-slate-200">
        Please note that the multiselect option for the PL/DNPL lists cannot be used for lists on the same lead
        fields (e.g., two or more PL/DNPL lists for the ZIP code). Adding multiple lists on the same lead field
        will result in a filtration conflict for the publisher API.
      </div>

      {fieldConflict ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
          Multiple selected lists use the same lead field. Remove duplicates to avoid filtration conflicts.
        </p>
      ) : null}

      <div className="grid gap-2 md:grid-cols-[280px_minmax(0,1fr)] md:items-start">
        <label className="flex items-center gap-1.5 pt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          Select PL/DNPL to apply to this publisher
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-slate-500 dark:border-slate-500 dark:text-slate-400">
            <CircleHelp size={10} strokeWidth={2.5} />
          </span>
        </label>

        <SearchableMultiSelect
          selectedIds={selectedIds}
          onChange={setSelectedIds}
          options={options}
          placeholder="Select PL/DNPL lists..."
          searchPlaceholder="Search PL/DNPL lists..."
          emptyMessage="No present lists found."
        />
      </div>

      <div className="flex justify-end">
        <PrimaryButton type="button" disabled={isSaving || fieldConflict} onClick={() => void handleSave()}>
          {isSaving ? "Saving..." : "Save"}
        </PrimaryButton>
      </div>
    </div>
  );
}
