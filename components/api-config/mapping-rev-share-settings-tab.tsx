"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleHelp } from "lucide-react";
import { FieldLabel, FormError, Input, PrimaryButton } from "@/components/ui/form-controls";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { SectionLoading } from "@/components/ui/loading-indicator";
import {
  SearchableMultiSelect,
  type SearchableMultiSelectOption,
} from "@/components/ui/searchable-multi-select";
import {
  defaultMappingRevShareSettings,
  formatRevShareModelLabel,
  REV_SHARE_MODEL_OPTIONS,
  validateMappingRevShareSettings,
  type MappingRevShareSettingsRecord,
  type RevShareModelType,
} from "@/lib/mapping-rev-share-settings";
import { toast } from "@/lib/toast";

const selectClassName =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25";

type MappingRevShareSettingsTabProps = {
  sellerId: string;
  mappingId: string;
};

export function MappingRevShareSettingsTab({ sellerId, mappingId }: MappingRevShareSettingsTabProps) {
  const [settings, setSettings] = useState<MappingRevShareSettingsRecord>(defaultMappingRevShareSettings());
  const [publisherOptions, setPublisherOptions] = useState<SearchableMultiSelectOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingPublishers, setIsLoadingPublishers] = useState(true);
  const [formError, setFormError] = useState("");

  const settingsUrl = `/api/sellers/${encodeURIComponent(sellerId)}/verticals/mappings/${encodeURIComponent(mappingId)}/rev-share-settings`;

  const publisherSelectOptions = useMemo(
    () => publisherOptions.filter((option) => option.id !== sellerId),
    [publisherOptions, sellerId]
  );

  const loadSettings = useCallback(async () => {
    if (!sellerId || !mappingId) return;

    setIsLoading(true);
    try {
      const response = await fetch(settingsUrl);
      if (!response.ok) return;

      const data = (await response.json()) as MappingRevShareSettingsRecord;
      setSettings(data);
    } finally {
      setIsLoading(false);
    }
  }, [mappingId, sellerId, settingsUrl]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const loadPublishers = async () => {
      setIsLoadingPublishers(true);
      try {
        const response = await fetch("/api/sellers");
        if (!response.ok) return;

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
  }, []);

  const updateModel = (model: RevShareModelType) => {
    setSettings((current) => ({
      ...current,
      model,
      percent: model === "static-percent" ? current.percent : null,
      fixedPrice: model === "fixed-price" ? current.fixedPrice : null,
      rejectIfPingPriceLowerThanFixedPrice:
        model === "fixed-price" ? true : false,
      copyToOtherPublishers: model === "fixed-price" ? current.copyToOtherPublishers : false,
      copyPublisherIds: model === "fixed-price" ? current.copyPublisherIds : [],
    }));
    setFormError("");
  };

  const handleSave = async () => {
    const validationError = validateMappingRevShareSettings(settings);
    if (validationError) {
      setFormError(validationError);
      toast.error(validationError, "Validation Error");
      return;
    }

    setIsSaving(true);
    setFormError("");

    try {
      const response = await fetch(settingsUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const result = (await response.json().catch(() => null)) as
        | MappingRevShareSettingsRecord
        | { message?: string }
        | null;

      if (!response.ok) {
        const message = (result as { message?: string } | null)?.message ?? "Failed to save.";
        setFormError(message);
        toast.error(message, "Save Failed");
        return;
      }

      setSettings(result as MappingRevShareSettingsRecord);
      toast.success("Rev-Share settings saved successfully.");
    } catch {
      toast.error("Failed to save.", "Save Failed");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <SectionLoading message="Loading rev-share settings..." />;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="grid gap-2 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
        <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
          Rev-Share Model
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-slate-500 dark:border-slate-500 dark:text-slate-400">
            <CircleHelp size={10} strokeWidth={2.5} />
          </span>
        </label>

        <DropdownSelect
          value={settings.model}
          options={REV_SHARE_MODEL_OPTIONS.map((option) => ({
            value: option,
            label: formatRevShareModelLabel(option),
          }))}
          onChange={(model) => updateModel(model as RevShareModelType)}
          className={selectClassName}
        />
      </div>

      {settings.model === "static-percent" ? (
        <div className="grid gap-2 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
          <FieldLabel htmlFor="rev-share-percent" label="Percent" />
          <Input
            id="rev-share-percent"
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={settings.percent ?? ""}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                percent: event.target.value === "" ? null : Number(event.target.value),
              }))
            }
            placeholder="Enter percent"
          />
        </div>
      ) : null}

      {settings.model === "fixed-price" ? (
        <>
          <div className="grid gap-2 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
            <FieldLabel htmlFor="rev-share-fixed-price" label="Fixed Price" />
            <Input
              id="rev-share-fixed-price"
              type="number"
              min={0}
              step="0.01"
              value={settings.fixedPrice ?? ""}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  fixedPrice: event.target.value === "" ? null : Number(event.target.value),
                }))
              }
              placeholder="Enter fixed price"
            />
          </div>

          <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={settings.rejectIfPingPriceLowerThanFixedPrice}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  rejectIfPingPriceLowerThanFixedPrice: event.target.checked,
                }))
              }
            />
            Reject if the Ping price is lower than the Fixed Price
          </label>

          <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/40">
            <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={settings.copyToOtherPublishers}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    copyToOtherPublishers: event.target.checked,
                    copyPublisherIds: event.target.checked ? current.copyPublisherIds : [],
                  }))
                }
              />
              Also copy (overwrite) all records to the following publisher(s):
            </label>

            {settings.copyToOtherPublishers ? (
              <div className="w-full max-w-2xl min-w-0">
                <SearchableMultiSelect
                  id="rev-share-copy-publishers"
                  selectedIds={settings.copyPublisherIds}
                  onChange={(copyPublisherIds) => setSettings((current) => ({ ...current, copyPublisherIds }))}
                  options={publisherSelectOptions}
                  labelOptions={publisherSelectOptions}
                  isLoading={isLoadingPublishers}
                  placeholder="Select publishers..."
                  searchPlaceholder="Search publishers..."
                  emptyMessage="No publishers available."
                />
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      <FormError error={formError} />

      <div className="flex justify-end">
        <PrimaryButton type="button" disabled={isSaving} onClick={() => void handleSave()}>
          {isSaving ? "Saving..." : "Save Data"}
        </PrimaryButton>
      </div>
    </div>
  );
}
