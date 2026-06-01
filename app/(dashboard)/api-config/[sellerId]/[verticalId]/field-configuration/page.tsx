"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { FieldLabel, FormError, Input, PrimaryButton } from "@/components/ui/form-controls";
import { PageSection } from "@/components/ui/state";

type ApiField = {
  id: string;
  fieldName: string;
  description: string;
  type: string;
  required: boolean;
  format?: string;
  emailDuplicateRule?: {
    mode: "days" | "forever";
    days?: number;
  };
  ignoreValues?: string[];
  isCustom: boolean;
  sourceVerticalFieldId?: string;
};

type FormState = {
  fieldName: string;
  description: string;
  type: string;
  required: boolean;
  format: string;
  emailDuplicateMode: "days" | "forever";
  emailDuplicateDays: string;
  ignoreValues: string[];
  ignoreValueInput: string;
};

const defaultForm: FormState = {
  fieldName: "",
  description: "",
  type: "string",
  required: false,
  format: "",
  emailDuplicateMode: "days",
  emailDuplicateDays: "",
  ignoreValues: [],
  ignoreValueInput: "",
};

export default function SellerVerticalFieldConfigurationPage() {
  const params = useParams<{ sellerId: string; verticalId: string }>();
  const searchParams = useSearchParams();
  const sellerId = params?.sellerId ?? "";
  const verticalId = params?.verticalId ?? "";
  const sellerName = searchParams.get("sellerName");
  const verticalName = searchParams.get("verticalName");
  const [fields, setFields] = useState<ApiField[]>([]);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isEmailType = form.type.trim().toLowerCase() === "email";
  const shouldShowDuplicateDays = isEmailType && form.emailDuplicateMode === "days";

  useEffect(() => {
    if (!sellerId || !verticalId) return;

    const fetchFields = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/sellers/${encodeURIComponent(sellerId)}/verticals/${encodeURIComponent(verticalId)}/field-configuration`
        );
        if (!response.ok) return;
        const data = (await response.json()) as ApiField[];
        setFields(data.map((field) => ({ ...field, format: field.format ?? "" })));
      } finally {
        setIsLoading(false);
      }
    };

    void fetchFields();
  }, [sellerId, verticalId]);

  const formatDataTypeLabel = (value: string) => {
    const normalized = value.trim();
    if (!normalized) return "";
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  };

  const handleTypeChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      type: value,
      format: value === "email" ? "email" : prev.format === "email" ? "" : prev.format,
      emailDuplicateMode: value === "email" ? prev.emailDuplicateMode : "days",
      emailDuplicateDays: value === "email" ? prev.emailDuplicateDays : "",
      ignoreValues: value === "email" ? [] : prev.ignoreValues,
      ignoreValueInput: "",
    }));
  };

  const addIgnoreValue = (rawValue: string) => {
    const normalized = rawValue.trim();
    if (!normalized) return;

    setForm((prev) => {
      const exists = prev.ignoreValues.some((item) => item.toLowerCase() === normalized.toLowerCase());
      if (exists) {
        return { ...prev, ignoreValueInput: "" };
      }

      return {
        ...prev,
        ignoreValues: [...prev.ignoreValues, normalized],
        ignoreValueInput: "",
      };
    });
  };

  const removeIgnoreValue = (value: string) => {
    setForm((prev) => ({
      ...prev,
      ignoreValues: prev.ignoreValues.filter((item) => item !== value),
    }));
  };

  const getFieldConditionLabel = (row: ApiField) => {
    if (row.type.trim().toLowerCase() === "email") {
      if (row.emailDuplicateRule?.mode === "forever") {
        return "Email must be unique forever";
      }

      if (row.emailDuplicateRule?.mode === "days" && typeof row.emailDuplicateRule.days === "number") {
        return `Email must be unique within ${row.emailDuplicateRule.days} day(s)`;
      }

      return "Email rule not configured";
    }

    if ((row.ignoreValues?.length ?? 0) > 0) {
      return `Ignore: ${row.ignoreValues?.join(", ")}`;
    }

    return "-";
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.fieldName.trim()) nextErrors.fieldName = "Field Name is required.";
    if (!form.description.trim()) nextErrors.description = "Description is required.";
    if (!form.type.trim()) nextErrors.type = "Type is required.";
    if (isEmailType && form.emailDuplicateMode === "days") {
      const days = Number(form.emailDuplicateDays);
      if (!Number.isInteger(days) || days <= 0) {
        nextErrors.emailDuplicateDays = "Please enter a valid number of days.";
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const resetForm = () => {
    setForm(defaultForm);
    setErrors({});
    setEditingId(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sellerId || !verticalId || !validate()) return;

    const payload = {
      fieldName: form.fieldName.trim(),
      description: form.description.trim(),
      type: form.type.trim(),
      required: form.required,
      format: isEmailType ? "email" : form.format.trim(),
      emailDuplicateRule: isEmailType
        ? {
            mode: form.emailDuplicateMode,
            ...(form.emailDuplicateMode === "days" ? { days: Number(form.emailDuplicateDays) } : {}),
          }
        : undefined,
      ignoreValues: isEmailType ? [] : form.ignoreValues,
    };

    if (editingId) {
      const response = await fetch(
        `/api/sellers/${encodeURIComponent(sellerId)}/verticals/${encodeURIComponent(verticalId)}/field-configuration/${encodeURIComponent(editingId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!response.ok) return;

      const updatedField = (await response.json()) as ApiField;
      setFields((prev) =>
        prev.map((item) => (item.id === editingId ? { ...updatedField, format: updatedField.format ?? "" } : item))
      );
    } else {
      const response = await fetch(
        `/api/sellers/${encodeURIComponent(sellerId)}/verticals/${encodeURIComponent(verticalId)}/field-configuration`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!response.ok) return;

      const createdField = (await response.json()) as ApiField;
      setFields((prev) => [...prev, { ...createdField, format: createdField.format ?? "" }]);
    }

    resetForm();
  };

  const handleEdit = (row: ApiField) => {
    if (!row.isCustom) return;

    setEditingId(row.id);
    setForm({
      fieldName: row.fieldName,
      description: row.description,
      type: row.type,
      required: row.required,
      format: row.format ?? "",
      emailDuplicateMode: row.emailDuplicateRule?.mode ?? "days",
      emailDuplicateDays:
        row.emailDuplicateRule?.mode === "days" && typeof row.emailDuplicateRule.days === "number"
          ? String(row.emailDuplicateRule.days)
          : "",
      ignoreValues: row.ignoreValues ?? [],
      ignoreValueInput: "",
    });
    setErrors({});
  };

  const handleDelete = async (id: string) => {
    if (!sellerId || !verticalId) return;

    const field = fields.find((item) => item.id === id);
    if (!field?.isCustom) return;

    const response = await fetch(
      `/api/sellers/${encodeURIComponent(sellerId)}/verticals/${encodeURIComponent(verticalId)}/field-configuration/${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );
    if (!response.ok) return;

    setFields((prev) => prev.filter((item) => item.id !== id));
    if (editingId === id) {
      resetForm();
    }
  };

  const columns: Column<ApiField>[] = [
    { key: "fieldName", label: "Field Name" },
    { key: "description", label: "Description" },
    {
      key: "isCustom",
      label: "Source",
      render: (row) => (
        <span
          className={
            row.isCustom
              ? "rounded-full bg-violet-100 px-2 py-1 text-xs font-medium text-violet-700"
              : "rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700"
          }
        >
          {row.isCustom ? "Custom" : "Inherited"}
        </span>
      ),
    },
    {
      key: "type",
      label: "Data Type",
      render: (row) => <span className="text-sm text-slate-700 dark:text-slate-100">{formatDataTypeLabel(row.type)}</span>,
    },
    {
      key: "required",
      label: "Required",
      render: (row) => (
        <span
          className={
            row.required
              ? "rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700"
              : "rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600"
          }
        >
          {row.required ? "Yes" : "No"}
        </span>
      ),
    },
    { key: "format", label: "Format" },
    {
      key: "condition",
      label: "Condition",
      render: (row) => <span className="text-xs text-slate-600 dark:text-slate-300">{getFieldConditionLabel(row)}</span>,
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="flex gap-2">
          {row.isCustom ? (
            <>
              <button
                type="button"
                onClick={() => handleEdit(row)}
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => handleDelete(row.id)}
                className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200 dark:hover:bg-red-500/20"
              >
                Delete
              </button>
            </>
          ) : (
            <span className="text-xs text-slate-400 dark:text-slate-500">Managed from vertical fields</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {sellerId && verticalId ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Managing field configuration for seller <span className="font-semibold">{sellerName ?? "selected seller"}</span> and vertical{" "}
          <span className="font-semibold">{verticalName ?? "selected vertical"}</span>. Inherited vertical fields are read-only here, while
          custom fields can be created and edited.
        </div>
      ) : null}

      <PageSection
        title="Field Configuration List"
        actions={
          <Link
            href={`/api-config?sellerId=${encodeURIComponent(sellerId)}&sellerName=${encodeURIComponent(sellerName ?? "")}`}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            Back to API Configuration
          </Link>
        }
      >
        <DataTable<ApiField>
          columns={columns}
          rows={fields}
          emptyMessage={
            isLoading ? "Loading fields..." : "No field configuration yet. Create your first custom field to get started."
          }
        />
      </PageSection>

      <PageSection title={editingId ? "Update Custom Field" : "Create Custom Field"}>
        <p className="text-sm text-slate-500 dark:text-slate-300">
          Custom fields are stored on this seller mapping. To change inherited fields, update the vertical field definition.
        </p>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <FieldLabel htmlFor="mapping-field-name" label="Field Name" />
            <Input
              id="mapping-field-name"
              placeholder="phone_number"
              value={form.fieldName}
              onChange={(event) => setForm((prev) => ({ ...prev, fieldName: event.target.value }))}
            />
            <FormError error={errors.fieldName} />
          </div>

          <div>
            <FieldLabel htmlFor="mapping-field-description" label="Description" />
            <Input
              id="mapping-field-description"
              placeholder="Phone Number"
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            />
            <FormError error={errors.description} />
          </div>

          <div>
            <FieldLabel htmlFor="mapping-field-type" label="Data Type" />
            <select
              id="mapping-field-type"
              value={form.type}
              onChange={(event) => handleTypeChange(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25"
            >
              <option value="string">String</option>
              <option value="email">Email</option>
              <option value="date">Date</option>
              <option value="boolean">Boolean</option>
              <option value="numberic">Numberic</option>
            </select>
            <FormError error={errors.type} />
          </div>

          <div>
            <FieldLabel htmlFor="mapping-field-format" label="Format" />
            <Input
              id="mapping-field-format"
              placeholder={isEmailType ? "Automatically set to email" : "email / E.164 / ISO-8601"}
              value={isEmailType ? "email" : form.format}
              onChange={(event) => setForm((prev) => ({ ...prev, format: event.target.value }))}
              disabled={isEmailType}
            />
          </div>

          <div>
            <FieldLabel htmlFor="mapping-field-required" label="Required (boolean)" />
            <select
              id="mapping-field-required"
              value={form.required ? "true" : "false"}
              onChange={(event) => setForm((prev) => ({ ...prev, required: event.target.value === "true" }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25"
            >
              <option value="false">false</option>
              <option value="true">true</option>
            </select>
          </div>

          {isEmailType ? (
            <>
              <div>
                <FieldLabel htmlFor="mapping-field-email-duplicate-mode" label="Email Duplicate Rule" />
                <select
                  id="mapping-field-email-duplicate-mode"
                  value={form.emailDuplicateMode}
                  onChange={(event) => setForm((prev) => ({ ...prev, emailDuplicateMode: event.target.value as "days" | "forever" }))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25"
                >
                  <option value="days">Email must be unique within xx days</option>
                  <option value="forever">Email must be unique forever</option>
                </select>
              </div>

              {shouldShowDuplicateDays ? (
                <div>
                  <FieldLabel htmlFor="mapping-field-email-duplicate-days" label="Duplicate Window (days)" />
                  <Input
                    id="mapping-field-email-duplicate-days"
                    type="number"
                    min="1"
                    placeholder="30"
                    value={form.emailDuplicateDays}
                    onChange={(event) => setForm((prev) => ({ ...prev, emailDuplicateDays: event.target.value }))}
                  />
                  <FormError error={errors.emailDuplicateDays} />
                </div>
              ) : null}
            </>
          ) : (
            <div className="md:col-span-2">
              <FieldLabel htmlFor="mapping-field-ignore-values" label="Ignore Values" />
              <div className="rounded-2xl border border-slate-300 bg-white p-3 dark:border-slate-600 dark:bg-slate-900">
                {form.ignoreValues.length > 0 ? (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {form.ignoreValues.map((value) => (
                      <span
                        key={value}
                        className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        {value}
                        <button
                          type="button"
                          onClick={() => removeIgnoreValue(value)}
                          className="text-slate-500 transition hover:text-slate-800 dark:text-slate-300 dark:hover:text-white"
                        >
                          x
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 md:flex-row">
                  <Input
                    id="mapping-field-ignore-values"
                    placeholder="Type a value and press Enter or comma"
                    value={form.ignoreValueInput}
                    onChange={(event) => setForm((prev) => ({ ...prev, ignoreValueInput: event.target.value }))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === ",") {
                        event.preventDefault();
                        addIgnoreValue(form.ignoreValueInput);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => addIgnoreValue(form.ignoreValueInput)}
                    className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                  >
                    Add Value
                  </button>
                </div>

                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Use multiple values to ignore placeholder or invalid inputs for non-email field types.
                </p>
              </div>
            </div>
          )}

          <div className="md:col-span-2 flex items-center gap-3">
            <PrimaryButton type="submit">{editingId ? "Update Field" : "Create Field"}</PrimaryButton>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </PageSection>
    </div>
  );
}
