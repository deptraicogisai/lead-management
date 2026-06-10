"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import type { Seller } from "@/lib/mock-data";
import { FieldLabel, FormError, Input, PrimaryButton } from "@/components/ui/form-controls";

type SellerFormValues = {
  name: string;
  email: string;
  region: string;
  status: Seller["status"];
};

type SellerFormProps = {
  initialValues?: SellerFormValues;
  isEditing?: boolean;
  onSubmitSeller: (values: SellerFormValues) => Promise<void> | void;
  onCancelEdit?: () => void;
};

const defaultValues: SellerFormValues = {
  name: "",
  email: "",
  region: "",
  status: "Active",
};

export function SellerForm({ initialValues, isEditing = false, onSubmitSeller, onCancelEdit }: SellerFormProps) {
  const [form, setForm] = useState<SellerFormValues>(initialValues ?? defaultValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!form.name.trim()) newErrors.name = "Publisher name is required.";
    if (!form.email.includes("@")) newErrors.email = "A valid email is required.";
    if (!form.region.trim()) newErrors.region = "Region is required.";

    setErrors(newErrors);
    if (Object.keys(newErrors).length === 0) {
      await onSubmitSeller({
        name: form.name.trim(),
        email: form.email.trim(),
        region: form.region.trim(),
        status: form.status,
      });
      if (!isEditing) {
        setForm(defaultValues);
      }
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <FieldLabel htmlFor="seller-name" label="Publisher Name" />
        <Input
          id="seller-name"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="NorthStar Media"
        />
        <FormError error={errors.name} />
      </div>

      <div>
        <FieldLabel htmlFor="seller-email" label="Publisher Email" />
        <Input
          id="seller-email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          placeholder="ops@northstar.com"
        />
        <FormError error={errors.email} />
      </div>

      <div>
        <FieldLabel htmlFor="seller-region" label="Publisher Region" />
        <Input
          id="seller-region"
          value={form.region}
          onChange={(e) => setForm((prev) => ({ ...prev, region: e.target.value }))}
          placeholder="US-East"
        />
        <FormError error={errors.region} />
      </div>

      <div>
        <FieldLabel htmlFor="seller-status" label="Publisher Status" />
        <select
          id="seller-status"
          value={form.status}
          onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as Seller["status"] }))}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25"
        >
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      <div className="flex items-center gap-3">
        <PrimaryButton type="submit">{isEditing ? "Update Publisher" : "Create Publisher"}</PrimaryButton>
        {isEditing && onCancelEdit ? (
          <button
            type="button"
            onClick={onCancelEdit}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
