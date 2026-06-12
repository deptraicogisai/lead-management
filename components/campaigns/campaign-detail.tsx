"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  Calendar,
  Copy,
  ExternalLink,
  Filter,
  LayoutGrid,
  Pencil,
  Plug,
  Plus,
  Settings,
  Settings2,
  Shield,
  Trash2,
} from "lucide-react";
import { useBreadcrumbLabel } from "@/components/layout/breadcrumb-context";
import { IconActionButton } from "@/components/ui/action-buttons";
import { CampaignPlDnplSettings } from "@/components/campaigns/campaign-pl-dnpl-settings";
import { CampaignScheduleCalendar } from "@/components/campaigns/campaign-schedule-calendar";
import { CampaignScheduleRuleModal } from "@/components/campaigns/campaign-schedule-rule-modal";
import { DualSaveBar, shouldUseDualSaveBar } from "@/components/ui/dual-save-bar";
import { toast } from "@/lib/toast";
import { Checkbox, FieldLabel, FormError, Input, PrimaryButton, Select, ToggleSwitch } from "@/components/ui/form-controls";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageSection, Spinner } from "@/components/ui/state";
import {
  CAMPAIGN_STATUS_OPTIONS,
  CAMPAIGN_TYPE_OPTIONS,
  DUPLICATE_METHOD_OPTIONS,
  DUPLICATE_PERIOD_OPTIONS,
  SCHEDULE_DAY_OPTIONS,
  TIMEZONE_OPTIONS,
  findScheduleRuleOverlap,
  buildGeneralFilterEnabledPatch,
  getMaxRangeOptions,
  getScheduleRuleOverlapMessage,
  isGeneralFilterRangeValid,
  normalizeGeneralFiltersForStorage,
  validateGeneralFilters,
  type CampaignRecord,
  type CampaignScheduleRule,
} from "@/lib/campaign";
import { resolveFieldOptionKey } from "@/lib/lead-field-value";
import type { IntegrationBuilderRecord } from "@/lib/integration-builder";
import type { PresentListRecord } from "@/lib/present-list";
import type { ApiFieldConfig } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

type CampaignTab = "general" | "duplicates" | "filters" | "schedule" | "integration";
type FilterSubTab = "general-filters" | "pl-dnpl" | "filter-by-publishers" | "iclear-filter";
type CampaignDetailProps = {
  campaignId: string;
};

export function CampaignDetail({ campaignId }: CampaignDetailProps) {
  const [campaign, setCampaign] = useState<CampaignRecord | null>(null);
  useBreadcrumbLabel(campaign ? `[${campaign.displayId}] ${campaign.name}` : null);
  const [verticalFields, setVerticalFields] = useState<ApiFieldConfig[]>([]);
  const [presentLists, setPresentLists] = useState<PresentListRecord[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationBuilderRecord[]>([]);
  const [activeTab, setActiveTab] = useState<CampaignTab>("general");
  const [filterSubTab, setFilterSubTab] = useState<FilterSubTab>("general-filters");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [generalForm, setGeneralForm] = useState({
    name: "",
    status: "Active" as CampaignRecord["status"],
    campaignType: "Redirect" as CampaignRecord["campaignType"],
    timezone: "",
    minPrice: "0",
  });
  const [duplicatesForm, setDuplicatesForm] = useState(campaign?.duplicates);
  const [selectedPlDnplIds, setSelectedPlDnplIds] = useState<string[]>([]);
  const [copyPlDnplToOtherCampaigns, setCopyPlDnplToOtherCampaigns] = useState(false);
  const [scheduleRuleModalOpen, setScheduleRuleModalOpen] = useState(false);
  const [editingScheduleRule, setEditingScheduleRule] = useState<CampaignScheduleRule | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [integrationForm, setIntegrationForm] = useState({
    integrationId: "",
    postUrl: "",
    postTimeout: "90",
  });

  const loadCampaign = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}`);
      if (!response.ok) return;
      const data = (await response.json()) as CampaignRecord;
      setCampaign(data);
      setGeneralForm({
        name: data.name,
        status: data.status,
        campaignType: data.campaignType,
        timezone: data.timezone,
        minPrice: String(data.minPrice),
      });
      setIntegrationForm({
        integrationId: data.integrationId ?? "",
        postUrl: data.integrationSettings?.postUrl ?? "",
        postTimeout: String(data.integrationSettings?.postTimeout ?? 90),
      });
      setDuplicatesForm(data.duplicates);
      setSelectedPlDnplIds(data.plDnplListIds);
      setCopyPlDnplToOtherCampaigns(data.copyPlDnplToOtherCampaigns);

      const [fieldsRes, listsRes, integrationsRes] = await Promise.all([
        fetch(`/api/industries/${encodeURIComponent(data.verticalId)}/fields`),
        fetch(`/api/present-lists?productId=${encodeURIComponent(data.verticalId)}&pageSize=1000`),
        fetch("/api/integration-builder"),
      ]);

      if (fieldsRes.ok) {
        setVerticalFields((await fieldsRes.json()) as ApiFieldConfig[]);
      }

      if (listsRes.ok) {
        const payload = (await listsRes.json()) as { items: PresentListRecord[] };
        setPresentLists(payload.items);
      }

      if (integrationsRes.ok) {
        setIntegrations((await integrationsRes.json()) as IntegrationBuilderRecord[]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCampaign();
  }, [loadCampaign]);

  const fieldOptionsByName = useMemo(() => {
    return new Map(verticalFields.map((field) => [field.fieldName, field]));
  }, [verticalFields]);

  const fieldOptionsListByName = useMemo(() => {
    return new Map(verticalFields.map((field) => [field.fieldName, field.options ?? []]));
  }, [verticalFields]);

  const saveSection = async (
    section: CampaignTab,
    payload: Record<string, unknown>,
    successMessage = "Saved successfully."
  ) => {
    setIsSaving(true);

    try {
      const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, ...payload }),
      });

      const result = (await response.json().catch(() => null)) as CampaignRecord | { message?: string } | null;
      if (!response.ok) {
        toast.error((result as { message?: string } | null)?.message ?? "Failed to save.", "Save Failed");
        return false;
      }

      setCampaign(result as CampaignRecord);
      toast.success(successMessage);
      return true;
    } catch {
      toast.error("Failed to save.", "Save Failed");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveFilters = () => {
    if (!campaign) return;

    const validationError = validateGeneralFilters(campaign.generalFilters, fieldOptionsListByName);
    if (validationError) {
      toast.error(validationError, "Validation Error");
      return;
    }

    void saveSection(
      "filters",
      {
        generalFilters: normalizeGeneralFiltersForStorage(campaign.generalFilters),
        plDnplListIds: selectedPlDnplIds,
        copyPlDnplToOtherCampaigns,
      },
      "Filters saved successfully."
    );
  };

  const updateGeneralFilter = (fieldId: string, patch: Partial<CampaignRecord["generalFilters"][number]>) => {
    if (!campaign) return;
    setCampaign({
      ...campaign,
      generalFilters: campaign.generalFilters.map((filter) =>
        filter.fieldId === fieldId ? { ...filter, ...patch } : filter
      ),
    });
  };

  const closeScheduleRuleModal = () => {
    setScheduleRuleModalOpen(false);
    setEditingScheduleRule(null);
  };

  const openAddScheduleRuleModal = () => {
    setEditingScheduleRule(null);
    setScheduleRuleModalOpen(true);
  };

  const openEditScheduleRuleModal = (rule: CampaignScheduleRule) => {
    setEditingScheduleRule(rule);
    setScheduleRuleModalOpen(true);
  };

  const handleAddScheduleRule = async (rule: Omit<CampaignScheduleRule, "id">) => {
    const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add-schedule-rule", rule }),
    });

    if (response.ok) {
      const data = (await response.json()) as CampaignRecord;
      setCampaign(data);
      closeScheduleRuleModal();
      toast.success("Schedule rule added successfully.");
    } else {
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      toast.error(result?.message ?? "Failed to add schedule rule.", "Save Failed");
    }
  };

  const handleSaveScheduleRule = async (rule: Omit<CampaignScheduleRule, "id">) => {
    if (!campaign) return;

    if (rule.days.length === 0) {
      toast.error("Please select at least one day.", "Invalid Schedule");
      return;
    }

    const overlap = findScheduleRuleOverlap(rule, campaign.scheduleRules, editingScheduleRule?.id ?? null);
    if (overlap) {
      toast.error(getScheduleRuleOverlapMessage(rule, overlap), "Schedule Overlap");
      return;
    }

    if (editingScheduleRule) {
      const nextRules = campaign.scheduleRules.map((item) =>
        item.id === editingScheduleRule.id ? { ...rule, id: editingScheduleRule.id } : item
      );
      const saved = await saveSection("schedule", { scheduleRules: nextRules }, "Schedule rule updated successfully.");
      if (saved) closeScheduleRuleModal();
      return;
    }

    await handleAddScheduleRule(rule);
  };

  const handleDeleteCampaign = async () => {
    const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}`, { method: "DELETE" });
    if (response.ok) {
      window.location.href = "/campaigns";
    }
  };

  const tabs: Array<{ id: CampaignTab; label: string; icon: typeof Settings }> = [
    { id: "general", label: "General", icon: Settings },
    { id: "duplicates", label: "Duplicates", icon: Copy },
    { id: "filters", label: "Filters", icon: Filter },
    { id: "schedule", label: "Schedule", icon: Calendar },
    { id: "integration", label: "Integration", icon: Plug },
  ];

  if (isLoading || !campaign) {
    return (
      <PageSection>
        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          <Spinner />
          <span>Loading campaign...</span>
        </div>
      </PageSection>
    );
  }

  return (
    <div className="space-y-6">
      <PageSection>
        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
                  activeTab === tab.id
                    ? "bg-emerald-800 text-white"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                )}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === "general" ? (
          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={campaign.status} className="px-3 py-1" />
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{campaign.productLabel}</span>
            </div>

            <div className="grid max-w-3xl gap-4">
              <div className="grid gap-2 md:grid-cols-[160px_minmax(0,1fr)] md:items-center">
                <FieldLabel htmlFor="detail-name" label="Name" />
                <Input id="detail-name" value={generalForm.name} onChange={(e) => setGeneralForm((c) => ({ ...c, name: e.target.value }))} />
              </div>
              <div className="grid gap-2 md:grid-cols-[160px_minmax(0,1fr)] md:items-center">
                <FieldLabel htmlFor="detail-product" label="Product" />
                <Input id="detail-product" value={campaign.productLabel} readOnly disabled className="bg-slate-100 dark:bg-slate-800" />
              </div>
              <div className="grid gap-2 md:grid-cols-[160px_minmax(0,1fr)] md:items-center">
                <FieldLabel htmlFor="detail-type" label="Campaign Type" />
                <select id="detail-type" value={generalForm.campaignType} onChange={(e) => setGeneralForm((c) => ({ ...c, campaignType: e.target.value as CampaignRecord["campaignType"] }))} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800">
                  {CAMPAIGN_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2 md:grid-cols-[160px_minmax(0,1fr)] md:items-center">
                <FieldLabel htmlFor="detail-timezone" label="Timezone" />
                <select id="detail-timezone" value={generalForm.timezone} onChange={(e) => setGeneralForm((c) => ({ ...c, timezone: e.target.value }))} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800">
                  {TIMEZONE_OPTIONS.map((timezone) => (
                    <option key={timezone} value={timezone}>{timezone}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2 md:grid-cols-[160px_minmax(0,1fr)] md:items-center">
                <FieldLabel htmlFor="detail-min-price" label="MinPrice" />
                <Input id="detail-min-price" type="number" min={0} step="0.01" value={generalForm.minPrice} onChange={(e) => setGeneralForm((c) => ({ ...c, minPrice: e.target.value }))} />
              </div>
              <div className="grid gap-2 md:grid-cols-[160px_minmax(0,1fr)] md:items-center">
                <FieldLabel htmlFor="detail-status" label="Status" />
                <select id="detail-status" value={generalForm.status} onChange={(e) => setGeneralForm((c) => ({ ...c, status: e.target.value as CampaignRecord["status"] }))} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800">
                  {CAMPAIGN_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <PrimaryButton
                type="button"
                disabled={isSaving}
                onClick={() =>
                  void saveSection(
                    "general",
                    {
                      name: generalForm.name,
                      status: generalForm.status,
                      campaignType: generalForm.campaignType,
                      timezone: generalForm.timezone,
                      minPrice: generalForm.minPrice,
                    },
                    "General settings saved successfully."
                  )
                }
                className="bg-emerald-800 hover:bg-emerald-700"
              >
                {isSaving ? "Saving..." : "Save Global Settings"}
              </PrimaryButton>
              <IconActionButton
                icon={Trash2}
                variant="danger"
                onClick={() => setDeleteConfirmOpen(true)}
                className="rounded-xl px-4 py-2"
              >
                Delete Campaign
              </IconActionButton>
            </div>
          </div>
        ) : null}

        {activeTab === "duplicates" && duplicatesForm ? (
          <div className="mt-6 max-w-3xl space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Campaign Duplicates</h3>
            <div className="grid gap-2 md:grid-cols-[180px_minmax(0,1fr)] md:items-center">
              <FieldLabel htmlFor="duplicate-method" label="Duplicate Method" />
              <select id="duplicate-method" value={duplicatesForm.duplicateMethod} onChange={(e) => setDuplicatesForm({ ...duplicatesForm, duplicateMethod: e.target.value as typeof duplicatesForm.duplicateMethod })} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800">
                {DUPLICATE_METHOD_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2 md:grid-cols-[180px_minmax(0,1fr)] md:items-center">
              <FieldLabel htmlFor="duplicate-sold" label="Duplicate Sold" />
              <select id="duplicate-sold" value={duplicatesForm.duplicateSold} onChange={(e) => setDuplicatesForm({ ...duplicatesForm, duplicateSold: e.target.value })} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800">
                {DUPLICATE_PERIOD_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2 md:grid-cols-[180px_minmax(0,1fr)] md:items-center">
              <FieldLabel htmlFor="duplicate-posted" label="Duplicate Posted" />
              <select id="duplicate-posted" value={duplicatesForm.duplicatePosted} onChange={(e) => setDuplicatesForm({ ...duplicatesForm, duplicatePosted: e.target.value })} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800">
                {DUPLICATE_PERIOD_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <PrimaryButton
              type="button"
              disabled={isSaving}
              onClick={() =>
                void saveSection("duplicates", { duplicates: duplicatesForm }, "Duplicates settings saved successfully.")
              }
              className="bg-emerald-800 hover:bg-emerald-700"
            >
              {isSaving ? "Saving..." : "Save Duplicates Settings"}
            </PrimaryButton>
          </div>
        ) : null}

        {activeTab === "filters" ? (
          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: "general-filters" as const, label: "General Filters", icon: Filter },
                  { id: "pl-dnpl" as const, label: "PL/DNPL", icon: Ban },
                  { id: "filter-by-publishers" as const, label: "Filter by Publishers", icon: LayoutGrid },
                  { id: "iclear-filter" as const, label: "iClear Filter", icon: Shield },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterSubTab(tab.id)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
                      filterSubTab === tab.id
                        ? "bg-emerald-800 text-white"
                        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    )}
                  >
                    <Icon size={15} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <DualSaveBar
              dual={
                filterSubTab === "general-filters"
                  ? shouldUseDualSaveBar(campaign.generalFilters.length)
                  : filterSubTab === "pl-dnpl"
                    ? shouldUseDualSaveBar(presentLists.length)
                    : false
              }
              renderActions={() => (
                <PrimaryButton
                  type="button"
                  disabled={isSaving}
                  onClick={handleSaveFilters}
                  className="bg-emerald-800 hover:bg-emerald-700"
                >
                  {isSaving ? "Saving..." : "Save Filters"}
                </PrimaryButton>
              )}
            >
            {filterSubTab === "general-filters" ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {campaign.generalFilters.map((filter) => {
                  const field = fieldOptionsByName.get(filter.fieldName);
                  const options = field?.options ?? [];
                  const isInteractive = filter.enabled;

                  return (
                    <div
                      key={filter.fieldId}
                      className={cn(
                        "rounded-2xl border border-slate-200 bg-white p-4 transition-opacity dark:border-slate-700 dark:bg-slate-900",
                        !isInteractive && "opacity-90"
                      )}
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{filter.description}</p>
                        <ToggleSwitch
                          checked={filter.enabled}
                          onChange={(enabled) =>
                            updateGeneralFilter(filter.fieldId, buildGeneralFilterEnabledPatch(filter, enabled))
                          }
                        />
                      </div>

                      {filter.dataTypeFilter === "Range" ? (
                        (() => {
                          const maxOptions = getMaxRangeOptions(filter.minValue ?? "", options);
                          const rangeInvalid =
                            isInteractive &&
                            Boolean(filter.minValue && filter.maxValue) &&
                            !isGeneralFilterRangeValid(filter.minValue ?? "", filter.maxValue ?? "", options);

                          return (
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <FieldLabel htmlFor={`${filter.fieldId}-min`} label="Min" />
                                  <Select
                                    id={`${filter.fieldId}-min`}
                                    value={filter.minValue ?? ""}
                                    disabled={!isInteractive}
                                    onChange={(e) => {
                                      const nextMin = e.target.value;
                                      const patch: Partial<CampaignRecord["generalFilters"][number]> = {
                                        minValue: nextMin,
                                      };
                                      if (
                                        filter.maxValue &&
                                        !isGeneralFilterRangeValid(nextMin, filter.maxValue, options)
                                      ) {
                                        patch.maxValue = "";
                                      }
                                      updateGeneralFilter(filter.fieldId, patch);
                                    }}
                                  >
                                    <option value="">Select min</option>
                                    {options.map((option) => (
                                      <option key={`min-${option.value}`} value={option.value}>
                                        {option.value}
                                      </option>
                                    ))}
                                  </Select>
                                </div>
                                <div>
                                  <FieldLabel htmlFor={`${filter.fieldId}-max`} label="Max" />
                                  <Select
                                    id={`${filter.fieldId}-max`}
                                    value={filter.maxValue ?? ""}
                                    disabled={!isInteractive || !filter.minValue}
                                    onChange={(e) => updateGeneralFilter(filter.fieldId, { maxValue: e.target.value })}
                                  >
                                    <option value="">Select max</option>
                                    {maxOptions.map((option) => (
                                      <option key={`max-${option.value}`} value={option.value ?? ""}>
                                        {option.value}
                                      </option>
                                    ))}
                                  </Select>
                                </div>
                              </div>
                              {rangeInvalid ? (
                                <FormError error="Max cannot be less than Min." />
                              ) : null}
                            </div>
                          );
                        })()
                      ) : null}

                      {filter.dataTypeFilter === "Checkbox" ? (
                        <div
                          className={cn(
                            "rounded-xl border border-slate-100 bg-slate-50/80 p-2 dark:border-slate-800 dark:bg-slate-800/40",
                            !isInteractive && "pointer-events-none opacity-60"
                          )}
                        >
                          <div className="flex flex-col gap-0.5">
                            {options.map((option) => {
                              const optionKey = resolveFieldOptionKey(option);
                              const selected = filter.selectedValues?.includes(optionKey) ?? false;
                              return (
                                <Checkbox
                                  key={optionKey}
                                  id={`${filter.fieldId}-${optionKey}`}
                                  checked={selected}
                                  disabled={!isInteractive}
                                  label={option.label}
                                  onChange={(checked) => {
                                    const current = new Set(filter.selectedValues ?? []);
                                    if (checked) current.add(optionKey);
                                    else current.delete(optionKey);
                                    updateGeneralFilter(filter.fieldId, { selectedValues: Array.from(current) });
                                  }}
                                />
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      {filter.dataTypeFilter === "Text" ? (
                        <Input
                          id={`${filter.fieldId}-text`}
                          value={filter.textValue ?? ""}
                          disabled={!isInteractive}
                          onChange={(e) => updateGeneralFilter(filter.fieldId, { textValue: e.target.value })}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : filterSubTab === "pl-dnpl" ? (
              <CampaignPlDnplSettings
                buyerId={campaign.buyerId}
                presentLists={presentLists}
                buyerPlDnplListIds={[]}
                selectedIds={selectedPlDnplIds}
                copyToOtherCampaigns={copyPlDnplToOtherCampaigns}
                onSelectedIdsChange={setSelectedPlDnplIds}
                onCopyToOtherCampaignsChange={setCopyPlDnplToOtherCampaigns}
              />
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                Coming soon.
              </div>
            )}
            </DualSaveBar>
          </div>
        ) : null}

        {activeTab === "schedule" ? (
          <div className="mt-6 space-y-4">
            {campaign.scheduleRules.length > 0 ? (
              <div className="border-l-4 border-amber-600 bg-amber-50 px-4 py-3 text-sm text-slate-700 dark:border-amber-500 dark:bg-amber-500/10 dark:text-slate-200">
                There are {campaign.scheduleRules.filter((rule) => rule.active).length} active rule(s) of 100 possibles.
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {campaign.scheduleRules.filter((rule) => rule.active).length} active rule(s) of {campaign.scheduleRules.length} total.
              </p>
              <button type="button" onClick={openAddScheduleRuleModal} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600">
                <Plus size={16} />
                Add Schedule Rule
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Iteration</th>
                    <th className="px-4 py-3">Period</th>
                    <th className="px-4 py-3">Start time</th>
                    <th className="px-4 py-3">End time</th>
                    <th className="px-4 py-3">Cap sold</th>
                    <th className="px-4 py-3">Cap send</th>
                    <th className="px-4 py-3">Sold/Time</th>
                    <th className="px-4 py-3">Send/Time</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {campaign.scheduleRules.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-8 text-center text-slate-500">No schedule rules yet.</td>
                    </tr>
                  ) : (
                    campaign.scheduleRules.map((rule) => (
                      <tr key={rule.id || `${rule.action}-${rule.startHour}`} className="border-t border-slate-200 dark:border-slate-700">
                        <td className="px-4 py-3">{rule.action}</td>
                        <td className="px-4 py-3">{rule.scheduleMethod}</td>
                        <td className="px-4 py-3">{rule.days.length === SCHEDULE_DAY_OPTIONS.length ? "All days" : rule.days.join(", ")}</td>
                        <td className="px-4 py-3">{rule.startHour}:{rule.startMinute}</td>
                        <td className="px-4 py-3">{rule.endHour}:{rule.endMinute}</td>
                        <td className="px-4 py-3">{rule.dailySoldLeadsLimit ?? "∞"}</td>
                        <td className="px-4 py-3">{rule.dailyPostLeadsLimit ?? "∞"}</td>
                        <td className="px-4 py-3 text-slate-400">-</td>
                        <td className="px-4 py-3 text-slate-400">-</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={rule.active ? "Active" : "Inactive"} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <IconActionButton
                              icon={Pencil}
                              onClick={() => openEditScheduleRuleModal(rule)}
                              className="rounded-lg px-2 py-1 text-xs"
                              aria-label="Edit schedule rule"
                            >
                              Edit
                            </IconActionButton>
                            <IconActionButton
                              icon={Trash2}
                              variant="danger"
                              onClick={() => {
                                const nextRules = campaign.scheduleRules.filter((item) => item.id !== rule.id);
                                void saveSection("schedule", { scheduleRules: nextRules }, "Schedule rule deleted successfully.");
                              }}
                              className="rounded-lg px-2 py-1 text-xs"
                              aria-label="Delete schedule rule"
                            >
                              Delete
                            </IconActionButton>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {campaign.scheduleRules.length > 0 ? (
              <CampaignScheduleCalendar rules={campaign.scheduleRules} timezone={campaign.timezone} />
            ) : null}
          </div>
        ) : null}

        {activeTab === "integration" ? (
          <div className="mt-6 max-w-4xl space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="grid gap-2 md:grid-cols-[160px_minmax(0,1fr)] md:items-center">
                  <FieldLabel htmlFor="integration-select" label="Integration" />
                  <div className="flex min-w-0 items-center gap-2">
                    <select
                      id="integration-select"
                      value={integrationForm.integrationId}
                      onChange={(e) => {
                        const nextId = e.target.value;
                        const match = integrations.find((item) => item.id === nextId);
                        const suggestedUrl = match?.requestMapping?.requestUrl ?? "";
                        setIntegrationForm((c) => ({
                          ...c,
                          integrationId: nextId,
                          postUrl: c.postUrl || suggestedUrl,
                        }));
                      }}
                      className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800"
                    >
                      <option value="">Please select integration</option>
                      {integrations
                        .filter((item) => item.verticalId === campaign.verticalId)
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            [{item.displayId}] {item.name} ({item.postingType})
                          </option>
                        ))}
                    </select>
                    <Link
                      href={`/buyers/${encodeURIComponent(campaign.buyerId)}?tab=integrations`}
                      title="Integration Link"
                      aria-label="Integration Link"
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-blue-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-blue-300"
                    >
                      <ExternalLink size={16} />
                    </Link>
                    {integrationForm.integrationId ? (
                      <Link
                        href={`/integration-builder/${encodeURIComponent(integrationForm.integrationId)}`}
                        title="Configure Integration"
                        aria-label="Configure Integration"
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-blue-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-blue-300"
                      >
                        <Settings2 size={16} />
                      </Link>
                    ) : (
                      <span
                        title="Select an integration first"
                        aria-label="Configure Integration"
                        className="inline-flex h-9 w-9 shrink-0 cursor-not-allowed items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-600"
                      >
                        <Settings2 size={16} />
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-[160px_minmax(0,1fr)] md:items-center">
                  <FieldLabel htmlFor="integration-url" label="URL" />
                  <Input
                    id="integration-url"
                    value={integrationForm.postUrl}
                    onChange={(e) => setIntegrationForm((c) => ({ ...c, postUrl: e.target.value }))}
                    placeholder="https://example.com/post"
                  />
                </div>

                <div className="grid gap-2 md:grid-cols-[160px_minmax(0,1fr)] md:items-center">
                  <FieldLabel htmlFor="integration-timeout" label="Post Timeout" />
                  <div className="flex items-center gap-2">
                    <Input
                      id="integration-timeout"
                      type="number"
                      min={1}
                      step={1}
                      value={integrationForm.postTimeout}
                      onChange={(e) => setIntegrationForm((c) => ({ ...c, postTimeout: e.target.value }))}
                      className="max-w-[8rem]"
                    />
                    <span className="text-sm text-slate-500">s</span>
                  </div>
                </div>

            <div className="flex flex-wrap gap-3">
              <PrimaryButton
                type="button"
                disabled={isSaving}
                onClick={() =>
                  void saveSection(
                    "integration",
                    {
                      integrationId: integrationForm.integrationId,
                      postUrl: integrationForm.postUrl,
                      postTimeout: integrationForm.postTimeout,
                    },
                    "Integration settings saved successfully."
                  )
                }
                className="bg-emerald-800 hover:bg-emerald-700"
              >
                {isSaving ? "Saving..." : "Save Integration Settings"}
              </PrimaryButton>
            </div>
          </div>
        ) : null}
      </PageSection>

      <CampaignScheduleRuleModal
        open={scheduleRuleModalOpen}
        onClose={closeScheduleRuleModal}
        initialRule={editingScheduleRule}
        onSave={(rule) => void handleSaveScheduleRule(rule)}
      />

      <Modal
        open={deleteConfirmOpen}
        title="Delete Campaign"
        description={`Delete campaign "${campaign.name}"? This action cannot be undone.`}
        onClose={() => setDeleteConfirmOpen(false)}
        actions={
          <>
            <button type="button" onClick={() => setDeleteConfirmOpen(false)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100">
              Cancel
            </button>
            <button type="button" onClick={() => void handleDeleteCampaign()} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
              Delete
            </button>
          </>
        }
      />
    </div>
  );
}
