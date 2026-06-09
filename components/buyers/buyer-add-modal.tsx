"use client";

import { CircleHelp, LayoutGrid } from "lucide-react";
import { useState } from "react";
import {
  BUYER_LABEL_OPTIONS,
  BUYER_MANAGER_OPTIONS,
  BUYER_TYPE_OPTIONS,
  type BuyerCreatePayload,
} from "@/lib/buyer";
import { FormError, Input, PrimaryButton } from "@/components/ui/form-controls";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

type BuyerAddModalProps = {
  open: boolean;
  isSaving?: boolean;
  onClose: () => void;
  onSubmit: (values: BuyerCreatePayload) => Promise<void> | void;
};

const defaultValues: BuyerCreatePayload = {
  name: "",
  status: "Active",
  personalManagerId: "",
  label: "-",
  buyerType: "-",
};

function FieldLabelWithHelp({ htmlFor, label }: { htmlFor: string; label: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
      <span>{label}</span>
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-slate-500 dark:border-slate-500 dark:text-slate-400">
        <CircleHelp size={10} strokeWidth={2.5} />
      </span>
    </label>
  );
}

const selectClassName =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25";

export function BuyerAddModal({ open, isSaving = false, onClose, onSubmit }: BuyerAddModalProps) {
  const [form, setForm] = useState<BuyerCreatePayload>(defaultValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = () => {
    setForm(defaultValues);
    setErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    const nextErrors: Record<string, string> = {};

    if (!form.name.trim()) {
      nextErrors.name = "Name cannot be blank.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    await onSubmit({
      name: form.name.trim(),
      status: form.status,
      personalManagerId: form.personalManagerId,
      label: form.label,
      buyerType: form.buyerType,
    });

    resetForm();
  };

  return (
    <Modal
      open={open}
      title={
        <span className="inline-flex items-center gap-2">
          <LayoutGrid size={18} />
          <span>Add New Buyer</span>
        </span>
      }
      onClose={handleClose}
      panelClassName="max-w-xl"
    >
      <div className="space-y-4 border-t border-slate-200 pt-4 dark:border-slate-700">
        <div>
          <FieldLabelWithHelp htmlFor="buyer-add-name" label="Name" />
          <Input
            id="buyer-add-name"
            value={form.name}
            onChange={(event) => {
              setForm((current) => ({ ...current, name: event.target.value }));
              if (errors.name) setErrors((current) => ({ ...current, name: "" }));
            }}
            className={cn(errors.name && "border-red-400 focus:border-red-400 focus:ring-red-100 dark:border-red-500 dark:focus:ring-red-500/25")}
          />
          <FormError error={errors.name} />
        </div>

        <div>
          <FieldLabelWithHelp htmlFor="buyer-add-status" label="Status" />
          <select
            id="buyer-add-status"
            value={form.status}
            onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as BuyerCreatePayload["status"] }))}
            className={selectClassName}
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        <div>
          <FieldLabelWithHelp htmlFor="buyer-add-manager" label="Personal manager" />
          <select
            id="buyer-add-manager"
            value={form.personalManagerId}
            onChange={(event) => setForm((current) => ({ ...current, personalManagerId: event.target.value }))}
            className={selectClassName}
          >
            <option value="">-</option>
            {BUYER_MANAGER_OPTIONS.map((manager) => (
              <option key={manager.id} value={manager.id}>
                [{manager.id}] {manager.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabelWithHelp htmlFor="buyer-add-label" label="Label" />
          <select
            id="buyer-add-label"
            value={form.label}
            onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
            className={selectClassName}
          >
            {BUYER_LABEL_OPTIONS.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabelWithHelp htmlFor="buyer-add-type" label="Type" />
          <select
            id="buyer-add-type"
            value={form.buyerType}
            onChange={(event) => setForm((current) => ({ ...current, buyerType: event.target.value }))}
            className={selectClassName}
          >
            {BUYER_TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-700">
          <PrimaryButton
            type="button"
            disabled={isSaving}
            onClick={() => void handleSubmit()}
            className="bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            {isSaving ? "Adding..." : "Add"}
          </PrimaryButton>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleClose}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
