"use client";

import { Checkbox, FieldLabel, FormError, Input, Select, ToggleSwitch } from "@/components/ui/form-controls";
import { FilterTagInput } from "@/components/ui/filter-tag-input";
import {
  buildGeneralFilterEnabledPatch,
  getMaxRangeOptions,
  getMultiSelectSiblingSelectedValues,
  groupGeneralFiltersForDisplay,
  isGeneralFilterRangeValid,
  type CampaignGeneralFilter,
} from "@/lib/campaign";
import { resolveFieldOptionKey, type FieldOptionLike } from "@/lib/lead-field-value";
import { cn } from "@/lib/utils";

type GeneralFiltersGridProps = {
  filters: CampaignGeneralFilter[];
  fieldOptionsListByName: Map<string, FieldOptionLike[]>;
  onPatchFilter: (fieldId: string, patch: Partial<CampaignGeneralFilter>) => void;
  onSetMultiSelectPairEnabled: (fieldName: string, enabled: boolean) => void;
};

function renderSingleFilterCard(
  filter: CampaignGeneralFilter,
  options: FieldOptionLike[],
  filters: CampaignGeneralFilter[],
  onPatchFilter: GeneralFiltersGridProps["onPatchFilter"]
) {
  const isInteractive = filter.enabled;

  return (
    <>
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
                      if (filter.maxValue && !isGeneralFilterRangeValid(nextMin, filter.maxValue, options)) {
                        patch.maxValue = "";
                      }
                      onPatchFilter(filter.fieldId, patch);
                    }}
                  >
                    <option value="">Select min</option>
                    {options.map((option) => (
                      <option key={`min-${option.value}`} value={option.value ?? ""}>
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
                    onChange={(event) => onPatchFilter(filter.fieldId, { maxValue: event.target.value })}
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
                  label={option.label ?? option.value ?? optionKey}
                  onChange={(checked) => {
                    const current = new Set(filter.selectedValues ?? []);
                    if (checked) current.add(optionKey);
                    else current.delete(optionKey);
                    onPatchFilter(filter.fieldId, { selectedValues: Array.from(current) });
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
          blockedValues={getMultiSelectSiblingSelectedValues(filters, filter)}
          placeholder="Type a value and press Enter"
          onChange={(selectedValues) => onPatchFilter(filter.fieldId, { selectedValues })}
        />
      ) : null}

      {filter.dataTypeFilter === "Text" ? (
        <Input
          id={`${filter.fieldId}-text`}
          value={filter.textValue ?? ""}
          disabled={!isInteractive}
          onChange={(event) => onPatchFilter(filter.fieldId, { textValue: event.target.value })}
        />
      ) : null}
    </>
  );
}

export function GeneralFiltersGrid({
  filters,
  fieldOptionsListByName,
  onPatchFilter,
  onSetMultiSelectPairEnabled,
}: GeneralFiltersGridProps) {
  const displayItems = groupGeneralFiltersForDisplay(filters);

  if (displayItems.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No filterable fields yet. Add fields with Text, Range, Checkbox, or Multi Select filters.
      </p>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {displayItems.map((item) => {
        if (item.kind === "multi-select") {
          const isInteractive = item.included.enabled;

          return (
            <div
              key={item.fieldName}
              className={cn(
                "rounded-2xl border border-slate-200 bg-white p-4 transition-opacity dark:border-slate-700 dark:bg-slate-900",
                !isInteractive && "opacity-90"
              )}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.label}</p>
                <ToggleSwitch
                  checked={isInteractive}
                  onChange={(enabled) => onSetMultiSelectPairEnabled(item.fieldName, enabled)}
                />
              </div>

              <div className="space-y-4">
                <div className={cn(!isInteractive && "pointer-events-none opacity-60")}>
                  <FieldLabel htmlFor={`${item.included.fieldId}-included`} label="Included" />
                  <FilterTagInput
                    id={`${item.included.fieldId}-included`}
                    values={item.included.selectedValues ?? []}
                    disabled={!isInteractive}
                    blockedValues={item.excluded.selectedValues ?? []}
                    placeholder="Type a value and press Enter"
                    onChange={(selectedValues) => onPatchFilter(item.included.fieldId, { selectedValues })}
                  />
                </div>

                <div className={cn(!isInteractive && "pointer-events-none opacity-60")}>
                  <FieldLabel htmlFor={`${item.excluded.fieldId}-excluded`} label="Excluded" />
                  <FilterTagInput
                    id={`${item.excluded.fieldId}-excluded`}
                    values={item.excluded.selectedValues ?? []}
                    disabled={!isInteractive}
                    blockedValues={item.included.selectedValues ?? []}
                    placeholder="Type a value and press Enter"
                    onChange={(selectedValues) => onPatchFilter(item.excluded.fieldId, { selectedValues })}
                  />
                </div>
              </div>
            </div>
          );
        }

        const filter = item.filter;
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
                  onPatchFilter(filter.fieldId, buildGeneralFilterEnabledPatch(filter, enabled))
                }
              />
            </div>

            {renderSingleFilterCard(filter, options, filters, onPatchFilter)}
          </div>
        );
      })}
    </div>
  );
}
