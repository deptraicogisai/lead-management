"use client";

import { useEffect, useState } from "react";
import { CancelButton, FieldLabel, FormError, Input, PrimaryButton, cancelButtonClassName } from "@/components/ui/form-controls";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import {
  PRESENT_LIST_EXPIRATION_OPTIONS,
  PRESENT_LIST_TYPE_OPTIONS,
  type PresentListRecord } from "@/lib/present-list";
import type { ApiFieldConfig } from "@/lib/mock-data";

const fieldErrorBorderClassName =
  "animate-field-invalid border-red-400 focus:border-red-500 focus:ring-red-100 dark:border-red-500/70 dark:focus:border-red-500";

type Option = { id: string; label: string };

type PresentListCreateModalProps = {
  open: boolean;
  verticalOptions: Option[];
  list?: PresentListRecord | null;
  onClose: () => void;
  onCreated: () => void;
};

export function PresentListCreateModal({
  open,
  verticalOptions,
  list = null,
  onClose,
  onCreated }: PresentListCreateModalProps) {
  const isEditing = Boolean(list);
  const [form, setForm] = useState({
    name: "",
    verticalId: "",
    applyToField: "",
    listType: "",
    defaultExpirationPeriod: "No expiration",
    allowApiAccess: false });
  const [fieldOptions, setFieldOptions] = useState<ApiFieldConfig[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const verticalId = isEditing ? list?.verticalId ?? "" : form.verticalId;

  useEffect(() => {
    if (!verticalId) {
      setFieldOptions([]);
      return;
    }

    void (async () => {
      const response = await fetch(`/api/industries/${encodeURIComponent(verticalId)}/fields`);
      if (!response.ok) return;
      setFieldOptions((await response.json()) as ApiFieldConfig[]);
    })();
  }, [verticalId]);

  useEffect(() => {
    if (!open) return;

    if (list) {
      setForm({
        name: list.name,
        verticalId: list.verticalId,
        applyToField: list.applyToField,
        listType: list.listType,
        defaultExpirationPeriod: list.defaultExpirationPeriod || "No expiration",
        allowApiAccess: list.allowApiAccess });
    } else {
      setForm({
        name: "",
        verticalId: "",
        applyToField: "",
        listType: "",
        defaultExpirationPeriod: "No expiration",
        allowApiAccess: false });
    }

    setErrors({});
    setIsSaving(false);
  }, [list, open]);

  const reset = () => {
    setForm({
      name: "",
      verticalId: "",
      applyToField: "",
      listType: "",
      defaultExpirationPeriod: "No expiration",
      allowApiAccess: false });
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
    if (!isEditing && !form.verticalId) nextErrors.verticalId = "Product is required.";
    if (!form.applyToField) nextErrors.applyToField = "Apply to field is required.";
    if (!form.listType) nextErrors.listType = "List type is required.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSaving(true);
    try {
      const response = await fetch(
        isEditing ? `/api/present-lists/${encodeURIComponent(list!.id)}` : "/api/present-lists",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isEditing
              ? {
                  name: form.name,
                  applyToField: form.applyToField,
                  listType: form.listType,
                  defaultExpirationPeriod: form.defaultExpirationPeriod,
                  allowApiAccess: form.allowApiAccess }
              : form
          ) }
      );
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setErrors({ form: result?.message ?? `Failed to ${isEditing ? "update" : "create"} list.` });
        return;
      }
      reset();
      onCreated();
    } catch {
      setErrors({ form: `Failed to ${isEditing ? "update" : "create"} list.` });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={isEditing ? "Edit PL/DNPL List" : "Add New"}
      onClose={handleClose}
      panelClassName="max-w-2xl"
      actions={
        <>
          <CancelButton type="button"
            disabled={isSaving}
            onClick={handleClose}
            
          >Cancel</CancelButton>
          <PrimaryButton
            type="button"
            disabled={isSaving}
            onClick={() => void handleSubmit()}
           
          >
            {isSaving ? "Saving..." : "Save"}
          </PrimaryButton>
        </>
      }
    >
      <div className="grid gap-4">
        <FormError error={errors.form} />
        <div>
          <FieldLabel htmlFor="pl-name" label="PL/DNPL List Name" />
          <FormError error={errors.name} />
          <Input id="pl-name" value={form.name} invalid={Boolean(errors.name)} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} />
        </div>
        <div>
          <FieldLabel htmlFor="pl-product" label="Product" />
          <FormError error={errors.verticalId} />
          {isEditing ? (
            <Input
              id="pl-product"
              value={list?.productLabel ?? ""}
              disabled
              className="cursor-not-allowed bg-slate-100 dark:bg-slate-800/80"
            />
          ) : (
            <DropdownSelect
              id="pl-product"
              value={form.verticalId}
              options={verticalOptions.map((option) => ({
                value: option.id,
                label: option.label,
              }))}
              onChange={(verticalId) =>
                setForm((current) => ({ ...current, verticalId, applyToField: "" }))
              }
              placeholder="Please select"
              className={cn(
                "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800",
                Boolean(errors.verticalId) && fieldErrorBorderClassName
              )}
            />
          )}
        </div>
        <div>
          <FieldLabel htmlFor="pl-field" label="Apply To Field" />
          <FormError error={errors.applyToField} />
          <DropdownSelect
            id="pl-field"
            value={form.applyToField}
            options={fieldOptions.map((field) => ({
              value: field.fieldName,
              label: field.fieldName,
            }))}
            onChange={(applyToField) =>
              setForm((current) => ({ ...current, applyToField }))
            }
            placeholder="Please select"
            disabled={!verticalId}
            className={cn(
              "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:disabled:bg-slate-800/80",
              Boolean(errors.applyToField) && fieldErrorBorderClassName
            )}
          />
        </div>
        <div>
          <FieldLabel htmlFor="pl-expiration" label="Default Expiration Period" />
          <DropdownSelect
            id="pl-expiration"
            value={form.defaultExpirationPeriod}
            options={PRESENT_LIST_EXPIRATION_OPTIONS.map((option) => ({
              value: option,
              label: option,
            }))}
            onChange={(defaultExpirationPeriod) =>
              setForm((current) => ({ ...current, defaultExpirationPeriod }))
            }
          />
        </div>
        <div>
          <FieldLabel htmlFor="pl-type" label="List Type" />
          <FormError error={errors.listType} />
          <DropdownSelect
            id="pl-type"
            value={form.listType}
            options={PRESENT_LIST_TYPE_OPTIONS.map((type) => ({
              value: type,
              label: type,
            }))}
            onChange={(listType) => setForm((current) => ({ ...current, listType }))}
            placeholder="Please select"
            className={cn(
              "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800",
              Boolean(errors.listType) && fieldErrorBorderClassName
            )}
          />
        </div>
        {isEditing ? (
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={form.allowApiAccess}
              onChange={(event) => setForm((current) => ({ ...current, allowApiAccess: event.target.checked }))}
            />
            Allow API Access
          </label>
        ) : null}
      </div>
    </Modal>
  );
}
