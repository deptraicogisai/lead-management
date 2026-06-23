"use client";

import { useState, type FormEvent } from "react";
import { type BuyerCreatePayload } from "@/lib/buyer";
import { FieldLabel, FormError, Input, PrimaryButton } from "@/components/ui/form-controls";

type BuyerFormProps = {
  isSaving?: boolean;
  onSubmit: (values: BuyerCreatePayload) => Promise<void> | void;
};

const defaultValues: BuyerCreatePayload = {
  name: "",
  email: "",
  status: "Active",
};

export function BuyerForm({ isSaving = false, onSubmit }: BuyerFormProps) {
  const [form, setForm] = useState<BuyerCreatePayload>(defaultValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};

    if (!form.name.trim()) nextErrors.name = "Buyer name is required.";
    if (!form.email.includes("@")) nextErrors.email = "A valid email is required.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    await onSubmit({
      name: form.name.trim(),
      email: form.email.trim(),
      status: form.status,
    });
  };

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
      <div>
        <FieldLabel htmlFor="buyer-name" label="Buyer Name" />
        <Input
          id="buyer-name"
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          placeholder="Acme Financial"
        />
        <FormError error={errors.name} />
      </div>

      <div>
        <FieldLabel htmlFor="buyer-email" label="Buyer Email" />
        <Input
          id="buyer-email"
          type="email"
          value={form.email}
          onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          placeholder="ops@acme.com"
        />
        <FormError error={errors.email} />
      </div>

      <div>
        <FieldLabel htmlFor="buyer-status" label="Buyer Status" />
        <select
          id="buyer-status"
          value={form.status}
          onChange={(event) =>
            setForm((current) => ({ ...current, status: event.target.value as BuyerCreatePayload["status"] }))
          }
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25"
        >
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      <div className="flex items-center justify-end gap-3">
        <PrimaryButton type="submit" disabled={isSaving}>
          {isSaving ? "Creating..." : "Create Buyer"}
        </PrimaryButton>
      </div>
    </form>
  );
}
