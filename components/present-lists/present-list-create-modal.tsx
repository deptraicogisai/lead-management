"use client";

import { useEffect, useState } from "react";
import { FieldLabel, FormError, Input, PrimaryButton } from "@/components/ui/form-controls";
import { Modal } from "@/components/ui/modal";
import { PRESENT_LIST_EXPIRATION_OPTIONS, PRESENT_LIST_TYPE_OPTIONS } from "@/lib/present-list";
import type { ApiFieldConfig } from "@/lib/mock-data";

type Option = { id: string; label: string };

type PresentListCreateModalProps = {
  open: boolean;
  verticalOptions: Option[];
  onClose: () => void;
  onCreated: () => void;
};

export function PresentListCreateModal({ open, verticalOptions, onClose, onCreated }: PresentListCreateModalProps) {
  const [form, setForm] = useState({
    name: "",
    verticalId: "",
    applyToField: "",
    listType: "",
    defaultExpirationPeriod: "No expiration",
  });
  const [fieldOptions, setFieldOptions] = useState<ApiFieldConfig[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!form.verticalId) {
      setFieldOptions([]);
      return;
    }

    void (async () => {
      const response = await fetch(`/api/industries/${encodeURIComponent(form.verticalId)}/fields`);
      if (!response.ok) return;
      setFieldOptions((await response.json()) as ApiFieldConfig[]);
    })();
  }, [form.verticalId]);

  const reset = () => {
    setForm({ name: "", verticalId: "", applyToField: "", listType: "", defaultExpirationPeriod: "No expiration" });
    setFieldOptions([]);
    setErrors({});
    setIsSaving(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = "List name is required.";
    if (!form.verticalId) nextErrors.verticalId = "Product is required.";
    if (!form.applyToField) nextErrors.applyToField = "Apply to field is required.";
    if (!form.listType) nextErrors.listType = "List type is required.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/present-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setErrors({ form: result?.message ?? "Failed to create list." });
        return;
      }
      reset();
      onCreated();
    } catch {
      setErrors({ form: "Failed to create list." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Add New"
      onClose={handleClose}
      panelClassName="max-w-2xl"
      actions={
        <>
          <button type="button" disabled={isSaving} onClick={handleClose} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100">
            Cancel
          </button>
          <PrimaryButton type="button" disabled={isSaving} onClick={() => void handleSubmit()} className="bg-emerald-700 hover:bg-emerald-800">
            {isSaving ? "Saving..." : "Save"}
          </PrimaryButton>
        </>
      }
    >
      <div className="grid gap-4">
        <div>
          <FieldLabel htmlFor="pl-name" label="PL/DNPL List Name" />
          <Input id="pl-name" value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} />
          <FormError error={errors.name} />
        </div>
        <div>
          <FieldLabel htmlFor="pl-product" label="Product" />
          <select id="pl-product" value={form.verticalId} onChange={(e) => setForm((c) => ({ ...c, verticalId: e.target.value, applyToField: "" }))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800">
            <option value="">Please select</option>
            {verticalOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
          <FormError error={errors.verticalId} />
        </div>
        <div>
          <FieldLabel htmlFor="pl-field" label="Apply To Field" />
          <select id="pl-field" value={form.applyToField} onChange={(e) => setForm((c) => ({ ...c, applyToField: e.target.value }))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800">
            <option value="">Please select</option>
            {fieldOptions.map((field) => (
              <option key={field.id} value={field.fieldName}>{field.fieldName}</option>
            ))}
          </select>
          <FormError error={errors.applyToField} />
        </div>
        <div>
          <FieldLabel htmlFor="pl-expiration" label="Default Expiration Period" />
          <select id="pl-expiration" value={form.defaultExpirationPeriod} onChange={(e) => setForm((c) => ({ ...c, defaultExpirationPeriod: e.target.value }))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800">
            {PRESENT_LIST_EXPIRATION_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="pl-type" label="List Type" />
          <select id="pl-type" value={form.listType} onChange={(e) => setForm((c) => ({ ...c, listType: e.target.value }))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800">
            <option value="">Please select</option>
            {PRESENT_LIST_TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <FormError error={errors.listType} />
        </div>
        <FormError error={errors.form} />
      </div>
    </Modal>
  );
}
