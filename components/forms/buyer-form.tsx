"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Buyer } from "@/lib/mock-data";
import { FieldLabel, FormError, Input, PrimaryButton } from "@/components/ui/form-controls";

type MappingRow = { id: number; source: string; destination: string };
type VerticalOption = {
  id: string;
  name: string;
};

export type BuyerFormValues = Omit<Buyer, "id" | "verticalName">;

type BuyerFormProps = {
  initialValues?: BuyerFormValues;
  isEditing?: boolean;
  onSubmitBuyer: (values: BuyerFormValues) => Promise<void> | void;
  onCancelEdit?: () => void;
};

const defaultMappings: MappingRow[] = [{ id: 1, source: "phone", destination: "customer_phone" }];

const defaultValues: BuyerFormValues = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  company: "",
  verticalId: "",
  apiKey: "",
  postLeadUrl: "",
  status: "Active",
  mappings: defaultMappings.map(({ source, destination }) => ({ source, destination })),
};

export function BuyerForm({ initialValues, isEditing = false, onSubmitBuyer, onCancelEdit }: BuyerFormProps) {
  const [form, setForm] = useState<BuyerFormValues>(initialValues ?? defaultValues);
  const [verticalOptions, setVerticalOptions] = useState<VerticalOption[]>([]);
  const [isLoadingVerticals, setIsLoadingVerticals] = useState(true);
  const [mappings, setMappings] = useState<MappingRow[]>(
    (initialValues?.mappings?.length
      ? initialValues.mappings
      : defaultMappings.map(({ source, destination }) => ({ source, destination }))
    ).map((mapping, index) => ({ id: index + 1, ...mapping }))
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchVerticals = async () => {
      try {
        const response = await fetch("/api/industries");
        if (!response.ok) return;

        const payload = (await response.json()) as Array<{ id: string; name: string }>;
        setVerticalOptions(payload.map((vertical) => ({ id: vertical.id, name: vertical.name })));
      } finally {
        setIsLoadingVerticals(false);
      }
    };

    void fetchVerticals();
  }, []);

  const updateMapping = (id: number, field: "source" | "destination", value: string) => {
    setMappings((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const addMapping = () => {
    setMappings((prev) => [...prev, { id: Date.now(), source: "", destination: "" }]);
  };

  const removeMapping = (id: number) => {
    setMappings((prev) => prev.filter((row) => row.id !== id));
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!form.firstName.trim()) newErrors.firstName = "First name is required.";
    if (!form.lastName.trim()) newErrors.lastName = "Last name is required.";
    if (!form.email.includes("@")) newErrors.email = "A valid email is required.";
    if (!form.phone.trim()) newErrors.phone = "Phone is required.";
    if (!form.company.trim()) newErrors.company = "Company name is required.";
    if (!form.verticalId.trim()) newErrors.verticalId = "Vertical is required.";
    if (!form.apiKey.trim()) newErrors.apiKey = "API key is required.";
    if (!form.postLeadUrl.trim()) newErrors.postLeadUrl = "Post Lead URL is required.";

    setErrors(newErrors);
    if (Object.keys(newErrors).length === 0) {
      void onSubmitBuyer({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        company: form.company.trim(),
        verticalId: form.verticalId,
        apiKey: form.apiKey.trim(),
        postLeadUrl: form.postLeadUrl.trim(),
        status: form.status,
        mappings: mappings.map(({ source, destination }) => ({
          source: source.trim(),
          destination: destination.trim(),
        })),
      });

      if (!isEditing) {
        setForm(defaultValues);
        setMappings(defaultMappings.map((mapping) => ({ ...mapping })));
      }
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <FieldLabel htmlFor="buyer-first-name" label="First Name" />
          <Input
            id="buyer-first-name"
            value={form.firstName}
            onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
            placeholder="Liam"
          />
          <FormError error={errors.firstName} />
        </div>

        <div>
          <FieldLabel htmlFor="buyer-last-name" label="Last Name" />
          <Input
            id="buyer-last-name"
            value={form.lastName}
            onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
            placeholder="Reed"
          />
          <FormError error={errors.lastName} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <FieldLabel htmlFor="buyer-email" label="Email" />
          <Input
            id="buyer-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="liam.reed@acmefinancial.com"
          />
          <FormError error={errors.email} />
        </div>

        <div>
          <FieldLabel htmlFor="buyer-phone" label="Phone" />
          <Input
            id="buyer-phone"
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
            placeholder="+1 555 100 101"
          />
          <FormError error={errors.phone} />
        </div>
      </div>

      <div>
        <FieldLabel htmlFor="buyer-company" label="Company" />
        <Input
          id="buyer-company"
          value={form.company}
          onChange={(e) => setForm((prev) => ({ ...prev, company: e.target.value }))}
          placeholder="Acme Financial"
        />
        <FormError error={errors.company} />
      </div>

      <div>
        <FieldLabel htmlFor="buyer-vertical" label="Vertical" />
        <select
          id="buyer-vertical"
          value={form.verticalId}
          onChange={(e) => setForm((prev) => ({ ...prev, verticalId: e.target.value }))}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25"
        >
          <option value="">{isLoadingVerticals ? "Loading verticals..." : "Select vertical"}</option>
          {verticalOptions.map((vertical) => (
            <option key={vertical.id} value={vertical.id}>
              {vertical.name}
            </option>
          ))}
        </select>
        <FormError error={errors.verticalId} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <FieldLabel htmlFor="buyer-api-key" label="API Key" />
          <Input
            id="buyer-api-key"
            value={form.apiKey}
            onChange={(e) => setForm((prev) => ({ ...prev, apiKey: e.target.value }))}
            placeholder="BUYER-ACME-KEY-001"
          />
          <FormError error={errors.apiKey} />
        </div>

        <div>
          <FieldLabel htmlFor="buyer-post-lead-url" label="Post Lead URL" />
          <Input
            id="buyer-post-lead-url"
            value={form.postLeadUrl}
            onChange={(e) => setForm((prev) => ({ ...prev, postLeadUrl: e.target.value }))}
            placeholder="https://buyer.example.com/api/leads"
          />
          <FormError error={errors.postLeadUrl} />
        </div>
      </div>

      <div>
        <FieldLabel htmlFor="buyer-status" label="Status" />
        <select
          id="buyer-status"
          value={form.status}
          onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as "Active" | "Paused" }))}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25"
        >
          <option value="Active">Active</option>
          <option value="Paused">Paused</option>
        </select>
      </div>

      <div id="buyer-mapping-configuration" className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">Mapping Fields</p>
        {mappings.map((mapping) => (
          <div key={mapping.id} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto]">
            <Input
              placeholder="Incoming key"
              value={mapping.source}
              onChange={(e) => updateMapping(mapping.id, "source", e.target.value)}
            />
            <Input
              placeholder="Destination key"
              value={mapping.destination}
              onChange={(e) => updateMapping(mapping.id, "destination", e.target.value)}
            />
            <button
              type="button"
              onClick={() => removeMapping(mapping.id)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addMapping}
          className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/20"
        >
          Add Mapping
        </button>
      </div>

      <div className="flex items-center gap-3">
        <PrimaryButton type="submit">{isEditing ? "Update Buyer" : "Create Buyer"}</PrimaryButton>
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
