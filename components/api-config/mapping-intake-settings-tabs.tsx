"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, Copy, Filter, Pencil, Plus, Trash2 } from "lucide-react";
import { CampaignScheduleCalendar } from "@/components/campaigns/campaign-schedule-calendar";
import { CampaignScheduleRuleModal } from "@/components/campaigns/campaign-schedule-rule-modal";
import { IconActionButton } from "@/components/ui/action-buttons";
import { DualSaveBar, shouldUseDualSaveBar } from "@/components/ui/dual-save-bar";
import { toast } from "@/lib/toast";
import { Checkbox, FieldLabel, FormError, Input, PrimaryButton, Select, ToggleSwitch } from "@/components/ui/form-controls";
import { FilterTagInput } from "@/components/ui/filter-tag-input";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  DUPLICATE_METHOD_OPTIONS,
  DUPLICATE_PERIOD_OPTIONS,
  TIMEZONE_OPTIONS,
  findScheduleRuleOverlap,
  buildGeneralFilterEnabledPatch,
  getMaxRangeOptions,
  getScheduleRuleOverlapMessage,
  isGeneralFilterRangeValid,
  normalizeGeneralFiltersForStorage,
  validateGeneralFilters,
  type CampaignGeneralFilter,
  type CampaignScheduleRule,
} from "@/lib/campaign";
import { resolveFieldOptionKey } from "@/lib/lead-field-value";
import type { MappingIntakeSettingsRecord } from "@/lib/mapping-intake-settings";
import type { VerticalFieldOption } from "@/lib/vertical-field";
import { cn } from "@/lib/utils";

type MappingIntakeTab = "duplicates" | "filters" | "schedule";

type FieldOptionSource = {
  fieldName: string;
  description: string;
  dataTypeFilter?: string | null;
  options: VerticalFieldOption[];
};

type MappingIntakeSettingsTabsProps = {
  sellerId: string;
  mappingId: string;
  fields: FieldOptionSource[];
  forcedTab?: MappingIntakeTab;
  hideTabBar?: boolean;
};

export function MappingIntakeSettingsTabs({
  sellerId,
  mappingId,
  fields,
  forcedTab,
  hideTabBar = false,
}: MappingIntakeSettingsTabsProps) {
  const [activeTab, setActiveTab] = useState<MappingIntakeTab>(forcedTab ?? "duplicates");
  const [settings, setSettings] = useState<MappingIntakeSettingsRecord | null>(null);
  const [duplicatesForm, setDuplicatesForm] = useState<MappingIntakeSettingsRecord["duplicates"] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [scheduleRuleModalOpen, setScheduleRuleModalOpen] = useState(false);
  const [editingScheduleRule, setEditingScheduleRule] = useState<CampaignScheduleRule | null>(null);

  const settingsUrl = `/api/sellers/${encodeURIComponent(sellerId)}/verticals/mappings/${encodeURIComponent(mappingId)}/intake-settings`;

  const fieldOptionsListByName = useMemo(
    () => new Map(fields.map((field) => [field.fieldName, field.options ?? []])),
    [fields]
  );

  const loadSettings = useCallback(async () => {
    if (!sellerId || !mappingId) return;

    setIsLoading(true);
    try {
      const response = await fetch(settingsUrl);
      if (!response.ok) return;

      const data = (await response.json()) as MappingIntakeSettingsRecord;
      setSettings(data);
      setDuplicatesForm(data.duplicates);
    } finally {
      setIsLoading(false);
    }
  }, [mappingId, sellerId, settingsUrl]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (forcedTab) setActiveTab(forcedTab);
  }, [forcedTab]);

  const saveSection = async (
    section: MappingIntakeTab,
    payload: Record<string, unknown>,
    successMessage: string
  ) => {
    setIsSaving(true);

    try {
      const response = await fetch(settingsUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, ...payload }),
      });

      const result = (await response.json().catch(() => null)) as MappingIntakeSettingsRecord | { message?: string } | null;
      if (!response.ok) {
        toast.error((result as { message?: string } | null)?.message ?? "Failed to save.", "Save Failed");
        return false;
      }

      const next = result as MappingIntakeSettingsRecord;
      setSettings(next);
      setDuplicatesForm(next.duplicates);
      toast.success(successMessage);
      return true;
    } catch {
      toast.error("Failed to save.", "Save Failed");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const updateGeneralFilter = (fieldId: string, patch: Partial<CampaignGeneralFilter>) => {
    if (!settings) return;
    setSettings({
      ...settings,
      generalFilters: settings.generalFilters.map((filter) =>
        filter.fieldId === fieldId ? { ...filter, ...patch } : filter
      ),
    });
  };

  const handleSaveFilters = () => {
    if (!settings) return;

    const validationError = validateGeneralFilters(settings.generalFilters, fieldOptionsListByName);
    if (validationError) {
      toast.error(validationError, "Validation Error");
      return;
    }

    void saveSection(
      "filters",
      { generalFilters: normalizeGeneralFiltersForStorage(settings.generalFilters) },
      "Filters saved successfully."
    );
  };

  const closeScheduleRuleModal = () => {
    setScheduleRuleModalOpen(false);
    setEditingScheduleRule(null);
  };

  const handleAddScheduleRule = async (rule: Omit<CampaignScheduleRule, "id">) => {
    const response = await fetch(settingsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add-schedule-rule", rule }),
    });

    if (response.ok) {
      const data = (await response.json()) as MappingIntakeSettingsRecord;
      setSettings(data);
      closeScheduleRuleModal();
      toast.success("Schedule rule added successfully.");
    } else {
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      toast.error(result?.message ?? "Failed to add schedule rule.", "Save Failed");
    }
  };

  const handleSaveScheduleRule = async (rule: Omit<CampaignScheduleRule, "id">) => {
    if (!settings) return;

    if (rule.days.length === 0) {
      toast.error("Please select at least one day.", "Invalid Schedule");
      return;
    }

    const overlap = findScheduleRuleOverlap(rule, settings.scheduleRules, editingScheduleRule?.id ?? null);
    if (overlap) {
      toast.error(getScheduleRuleOverlapMessage(rule, overlap), "Schedule Overlap");
      return;
    }

    if (editingScheduleRule) {
      const nextRules = settings.scheduleRules.map((item) =>
        item.id === editingScheduleRule.id ? { ...rule, id: editingScheduleRule.id } : item
      );
      const saved = await saveSection("schedule", { scheduleRules: nextRules }, "Schedule rule updated successfully.");
      if (saved) closeScheduleRuleModal();
      return;
    }

    await handleAddScheduleRule(rule);
  };

  if (isLoading || !settings || !duplicatesForm) {
    return <p className="text-sm text-slate-500">Loading intake settings...</p>;
  }

  return (
    <div className="space-y-4">
      {hideTabBar ? null : (
        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
          {(
            [
              { id: "duplicates" as const, label: "Duplicates", icon: Copy },
              { id: "filters" as const, label: "Filters", icon: Filter },
              { id: "schedule" as const, label: "Schedule", icon: Calendar },
            ] as const
          ).map((tab) => {
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
      )}

      {activeTab === "duplicates" ? (
        <div className="max-w-3xl space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            These duplicate rules are evaluated when a publisher posts a lead to this API.
            {duplicatesForm.duplicateMethod === "SSN + Email"
              ? " SSN + Email rejects a lead when both SSN and email match a previous lead. Duplicate Posted OFF still checks all historical leads."
              : " Duplicate Posted must be enabled to reject duplicate emails."}
          </p>
          <div className="grid gap-2 md:grid-cols-[180px_minmax(0,1fr)] md:items-center">
            <FieldLabel htmlFor="mapping-duplicate-method" label="Duplicate Method" />
            <select
              id="mapping-duplicate-method"
              value={duplicatesForm.duplicateMethod}
              onChange={(event) =>
                setDuplicatesForm({ ...duplicatesForm, duplicateMethod: event.target.value as typeof duplicatesForm.duplicateMethod })
              }
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              {DUPLICATE_METHOD_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2 md:grid-cols-[180px_minmax(0,1fr)] md:items-center">
            <FieldLabel htmlFor="mapping-duplicate-sold" label="Duplicate Sold" />
            <select
              id="mapping-duplicate-sold"
              value={duplicatesForm.duplicateSold}
              onChange={(event) => setDuplicatesForm({ ...duplicatesForm, duplicateSold: event.target.value })}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              {DUPLICATE_PERIOD_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2 md:grid-cols-[180px_minmax(0,1fr)] md:items-center">
            <FieldLabel htmlFor="mapping-duplicate-posted" label="Duplicate Posted" />
            <select
              id="mapping-duplicate-posted"
              value={duplicatesForm.duplicatePosted}
              onChange={(event) => setDuplicatesForm({ ...duplicatesForm, duplicatePosted: event.target.value })}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              {DUPLICATE_PERIOD_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <PrimaryButton
            type="button"
            disabled={isSaving}
            onClick={() => void saveSection("duplicates", { duplicates: duplicatesForm }, "Duplicates settings saved successfully.")}
            className="bg-emerald-800 hover:bg-emerald-700"
          >
            {isSaving ? "Saving..." : "Save Duplicates Settings"}
          </PrimaryButton>
        </div>
      ) : null}

      {activeTab === "filters" ? (
        <DualSaveBar
          dual={shouldUseDualSaveBar(settings.generalFilters.length)}
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
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Enabled general filters are applied to incoming publisher leads before they are accepted.
          </p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {settings.generalFilters.map((filter) => {
              const options = fieldOptionsListByName.get(filter.fieldName) ?? [];
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
                                onChange={(event) => {
                                  const nextMin = event.target.value;
                                  const patch: Partial<CampaignGeneralFilter> = { minValue: nextMin };
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
                                onChange={(event) => updateGeneralFilter(filter.fieldId, { maxValue: event.target.value })}
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
                          {rangeInvalid ? <FormError error="Max cannot be less than Min." /> : null}
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

                  {filter.dataTypeFilter === "Multi Select" ? (
                    <FilterTagInput
                      id={`${filter.fieldId}-multi-select`}
                      values={filter.selectedValues ?? []}
                      disabled={!isInteractive}
                      placeholder="Type a value and press Enter"
                      onChange={(selectedValues) => updateGeneralFilter(filter.fieldId, { selectedValues })}
                    />
                  ) : null}

                  {filter.dataTypeFilter === "Text" ? (
                    <Input
                      id={`${filter.fieldId}-text`}
                      value={filter.textValue ?? ""}
                      disabled={!isInteractive}
                      onChange={(event) => updateGeneralFilter(filter.fieldId, { textValue: event.target.value })}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>

          {settings.generalFilters.length === 0 ? (
            <p className="text-sm text-slate-500">No filterable fields yet. Add fields with Text, Range, Checkbox, or Multi Select filters.</p>
          ) : null}
        </div>
        </DualSaveBar>
      ) : null}

      {activeTab === "schedule" ? (
        <DualSaveBar
          dual={shouldUseDualSaveBar(settings.scheduleRules.length)}
          renderActions={() => (
            <PrimaryButton
              type="button"
              disabled={isSaving}
              onClick={() => void saveSection("schedule", { scheduleRules: settings.scheduleRules, timezone: settings.timezone }, "Schedule settings saved successfully.")}
              className="bg-emerald-800 hover:bg-emerald-700"
            >
              {isSaving ? "Saving..." : "Save Schedule Settings"}
            </PrimaryButton>
          )}
        >
        <div className="space-y-4">
          <div className="grid max-w-md gap-2 md:grid-cols-[160px_minmax(0,1fr)] md:items-center">
            <FieldLabel htmlFor="mapping-timezone" label="Timezone" />
            <select
              id="mapping-timezone"
              value={settings.timezone}
              onChange={(event) => setSettings({ ...settings, timezone: event.target.value })}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              {TIMEZONE_OPTIONS.map((timezone) => (
                <option key={timezone} value={timezone}>
                  {timezone}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {settings.scheduleRules.filter((rule) => rule.active).length} active rule(s) of {settings.scheduleRules.length} total.
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingScheduleRule(null);
                setScheduleRuleModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
            >
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
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {settings.scheduleRules.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                      No schedule rules yet.
                    </td>
                  </tr>
                ) : (
                  settings.scheduleRules.map((rule) => (
                    <tr key={rule.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-3">{rule.action}</td>
                      <td className="px-4 py-3">{rule.scheduleMethod}</td>
                      <td className="px-4 py-3">{rule.days.join(", ")}</td>
                      <td className="px-4 py-3">
                        {rule.startHour}:{rule.startMinute}
                      </td>
                      <td className="px-4 py-3">
                        {rule.endHour}:{rule.endMinute}
                      </td>
                      <td className="px-4 py-3">{rule.dailySoldLeadsLimit ?? "-"}</td>
                      <td className="px-4 py-3">{rule.dailyPostLeadsLimit ?? "-"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={rule.active ? "Active" : "Inactive"} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <IconActionButton
                            icon={Pencil}
                            onClick={() => {
                              setEditingScheduleRule(rule);
                              setScheduleRuleModalOpen(true);
                            }}
                            className="rounded-lg px-2 py-1 text-xs"
                            aria-label="Edit schedule rule"
                          >
                            Edit
                          </IconActionButton>
                          <IconActionButton
                            icon={Trash2}
                            variant="danger"
                            onClick={() => {
                              const nextRules = settings.scheduleRules.filter((item) => item.id !== rule.id);
                              void saveSection(
                                "schedule",
                                { scheduleRules: nextRules, timezone: settings.timezone },
                                "Schedule rule deleted successfully."
                              );
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

          {settings.scheduleRules.length > 0 ? (
            <CampaignScheduleCalendar rules={settings.scheduleRules} timezone={settings.timezone} />
          ) : null}
        </div>
        </DualSaveBar>
      ) : null}

      <CampaignScheduleRuleModal
        open={scheduleRuleModalOpen}
        onClose={closeScheduleRuleModal}
        initialRule={editingScheduleRule}
        onSave={(rule) => void handleSaveScheduleRule(rule)}
      />

    </div>
  );
}
