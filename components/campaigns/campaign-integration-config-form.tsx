"use client";

import { FieldLabel, FormError, Input } from "@/components/ui/form-controls";
import { DEFAULT_POST_TIMEOUT_SECONDS } from "@/lib/campaign-integration-config";
import type { IntegrationBuilderConfigField } from "@/lib/integration-builder";
type CampaignIntegrationConfigFormProps = {
  fields: IntegrationBuilderConfigField[];
  values: Record<string, string>;
  errors?: Record<string, string>;
  onChange: (variableName: string, value: string) => void;
};

const selectClassName =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25";

function renderFieldControl(
  field: IntegrationBuilderConfigField,
  value: string,
  onChange: (variableName: string, value: string) => void
) {
  const inputId = `integration-config-${field.variableName}`;

  if (field.type === "boolean") {
    return (
      <select
        id={inputId}
        value={value}
        onChange={(event) => onChange(field.variableName, event.target.value)}
        className={selectClassName}
      >
        <option value="">Select...</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }

  if (field.type === "number") {
    return (
      <Input
        id={inputId}
        type="number"
        min={field.variableName === "timeout" ? 1 : undefined}
        value={value}
        placeholder={field.variableName === "timeout" ? String(DEFAULT_POST_TIMEOUT_SECONDS) : undefined}
        onChange={(event) => onChange(field.variableName, event.target.value)}
      />
    );
  }

  return (
    <Input
      id={inputId}
      value={value}
      onChange={(event) => onChange(field.variableName, event.target.value)}
      placeholder={field.label}
    />
  );
}

export function CampaignIntegrationConfigForm({
  fields,
  values,
  errors = {},
  onChange,
}: CampaignIntegrationConfigFormProps) {
  if (fields.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">
        No integration config fields found for this integration.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {fields.map((field) => (
        <div key={field.variableName} className="grid gap-2 md:grid-cols-[160px_minmax(0,1fr)] md:items-start">
          <FieldLabel
            htmlFor={`integration-config-${field.variableName}`}
            label={field.label}
            required={field.required}
          />
          <div>
            {renderFieldControl(field, values[field.variableName] ?? "", onChange)}
            <FormError error={errors[field.variableName]} />
          </div>
        </div>
      ))}
    </div>
  );
}
