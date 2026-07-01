"use client";

import { Checkbox, FieldLabel, FormError, Input, Select } from "@/components/ui/form-controls";
import { FilterTagBadges } from "@/components/ui/filter-tag-input";
import { getMaxRangeOptions, resolveFieldOptionKey } from "@/lib/lead-field-value";
import {
  formatTestLeadOptionLabel,
  formatTestLeadOptionSelectValue,
  getTestLeadInputType,
  parseTestLeadMultiValue,
  parseTestLeadRangeValue,
  resolveTestLeadControlKind,
  serializeTestLeadMultiValue,
  serializeTestLeadRangeValue,
  type MappingTestLeadField,
} from "@/lib/mapping-test-lead";
import { cn } from "@/lib/utils";

type TestLeadFieldControlProps = {
  field: MappingTestLeadField;
  value: string;
  onChange: (value: string) => void;
  allowedTokens?: string[];
  error?: string;
};

export function TestLeadFieldControl({
  field,
  value,
  onChange,
  allowedTokens,
  error,
}: TestLeadFieldControlProps) {
  const inputId = `test-lead-${field.fieldName}`;
  const label = field.description?.trim() || field.fieldName;
  const controlKind = resolveTestLeadControlKind(field);

  if (controlKind === "dropdown") {
    return (
      <div className="space-y-1.5">
        <FieldLabel htmlFor={inputId} label={label} required={field.required} />
        <Select id={inputId} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select {label}</option>
          {field.options.map((option) => {
            const optionValue = formatTestLeadOptionSelectValue(option, field);
            return (
              <option key={`${field.fieldName}-${optionValue}-${option.label}`} value={optionValue}>
                {formatTestLeadOptionLabel(option, field)}
              </option>
            );
          })}
        </Select>
        <FormError error={error} />
      </div>
    );
  }

  if (controlKind === "checkbox") {
    const selectedValues = new Set(parseTestLeadMultiValue(value));

    return (
      <div className="space-y-1.5">
        <FieldLabel htmlFor={inputId} label={label} required={field.required} />
        <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="flex flex-col gap-0.5">
            {field.options.map((option) => {
              const optionKey = resolveFieldOptionKey(option);
              const optionValue = formatTestLeadOptionSelectValue(option, field);
              const checked = selectedValues.has(optionValue) || selectedValues.has(optionKey);

              return (
                <Checkbox
                  key={`${field.fieldName}-${optionKey}`}
                  id={`${inputId}-${optionKey}`}
                  checked={checked}
                  label={formatTestLeadOptionLabel(option, field)}
                  onChange={(nextChecked) => {
                    const nextValues = new Set(selectedValues);
                    if (nextChecked) {
                      nextValues.add(optionValue);
                    } else {
                      nextValues.delete(optionValue);
                      nextValues.delete(optionKey);
                    }
                    onChange(serializeTestLeadMultiValue(Array.from(nextValues)));
                  }}
                />
              );
            })}
          </div>
        </div>
        <FormError error={error} />
      </div>
    );
  }

  if (controlKind === "multi-select") {
    const selectedValues = new Set(parseTestLeadMultiValue(value));

    return (
      <div className="space-y-1.5">
        <FieldLabel htmlFor={inputId} label={label} required={field.required} />
        <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="flex flex-col gap-0.5">
            {field.options.map((option) => {
              const optionKey = resolveFieldOptionKey(option);
              const optionValue = formatTestLeadOptionSelectValue(option, field);
              const checked = selectedValues.has(optionValue) || selectedValues.has(optionKey);

              return (
                <Checkbox
                  key={`${field.fieldName}-${optionKey}`}
                  id={`${inputId}-${optionKey}`}
                  checked={checked}
                  label={formatTestLeadOptionLabel(option, field)}
                  onChange={(nextChecked) => {
                    const nextValues = new Set(selectedValues);
                    if (nextChecked) {
                      nextValues.add(optionValue);
                    } else {
                      nextValues.delete(optionValue);
                      nextValues.delete(optionKey);
                    }
                    onChange(serializeTestLeadMultiValue(Array.from(nextValues)));
                  }}
                />
              );
            })}
          </div>
        </div>
        <FormError error={error} />
      </div>
    );
  }

  if (controlKind === "range") {
    const { minValue, maxValue } = parseTestLeadRangeValue(value);
    const maxOptions = getMaxRangeOptions(minValue, field.options);

    return (
      <div className="space-y-1.5">
        <FieldLabel htmlFor={`${inputId}-min`} label={label} required={field.required} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <FieldLabel htmlFor={`${inputId}-min`} label="Min" />
            <Select
              id={`${inputId}-min`}
              value={minValue}
              onChange={(event) =>
                onChange(serializeTestLeadRangeValue(event.target.value, maxValue))
              }
            >
              <option value="">Select min</option>
              {field.options.map((option) => {
                const optionValue = formatTestLeadOptionSelectValue(option, field);
                return (
                  <option key={`${field.fieldName}-min-${optionValue}`} value={optionValue}>
                    {formatTestLeadOptionLabel(option, field)}
                  </option>
                );
              })}
            </Select>
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor={`${inputId}-max`} label="Max" />
            <Select
              id={`${inputId}-max`}
              value={maxValue}
              disabled={!minValue}
              onChange={(event) =>
                onChange(serializeTestLeadRangeValue(minValue, event.target.value))
              }
            >
              <option value="">Select max</option>
              {maxOptions.map((option) => {
                const normalizedOption = {
                  label: option.label?.trim() || option.value?.trim() || "",
                  value: option.value?.trim() || option.label?.trim() || "",
                };
                const optionValue = formatTestLeadOptionSelectValue(normalizedOption, field);
                return (
                  <option key={`${field.fieldName}-max-${optionValue}`} value={optionValue}>
                    {formatTestLeadOptionLabel(normalizedOption, field)}
                  </option>
                );
              })}
            </Select>
          </div>
        </div>
        <FormError error={error} />
      </div>
    );
  }

  if (controlKind === "boolean") {
    return (
      <div className="space-y-1.5">
        <FieldLabel htmlFor={inputId} label={label} required={field.required} />
        <Select id={inputId} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select {label}</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </Select>
        <FormError error={error} />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <FieldLabel htmlFor={inputId} label={label} required={field.required} />
      {allowedTokens && allowedTokens.length > 0 ? (
        <>
          <p className="text-xs text-slate-500 dark:text-slate-400">Must contain one of:</p>
          <FilterTagBadges values={allowedTokens} className="mb-2" />
        </>
      ) : null}
      <Input
        id={inputId}
        type={getTestLeadInputType(field)}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.fieldName}
        className={cn(error && "border-red-400")}
      />
      <FormError error={error} />
    </div>
  );
}
