"use client";

import { useState } from "react";
import { FieldLabel, FormError, Input, PrimaryButton } from "@/components/ui/form-controls";
import { Modal } from "@/components/ui/modal";
import { CAMPAIGN_TYPE_OPTIONS, TIMEZONE_OPTIONS } from "@/lib/campaign";

type Option = { id: string; label: string };

type CampaignCreateModalProps = {
  open: boolean;
  verticalOptions: Array<Option & { name?: string }>;
  buyerOptions: Option[];
  onClose: () => void;
  onCreated: () => void;
};

export function CampaignCreateModal({
  open,
  verticalOptions,
  buyerOptions,
  onClose,
  onCreated,
}: CampaignCreateModalProps) {
  const [form, setForm] = useState({
    name: "",
    verticalId: "",
    buyerId: "",
    campaignType: "",
    timezone: "",
    minPrice: "0",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const reset = () => {
    setForm({ name: "", verticalId: "", buyerId: "", campaignType: "", timezone: "", minPrice: "0" });
    setErrors({});
    setIsSaving(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = "Name is required.";
    if (!form.verticalId) nextErrors.verticalId = "Product is required.";
    if (!form.buyerId) nextErrors.buyerId = "Buyer is required.";
    if (!form.campaignType) nextErrors.campaignType = "Campaign type is required.";
    if (!form.timezone) nextErrors.timezone = "Timezone is required.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSaving(true);

    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          verticalId: form.verticalId,
          buyerId: form.buyerId,
          campaignType: form.campaignType,
          timezone: form.timezone,
          minPrice: Number(form.minPrice),
          status: "Active",
        }),
      });

      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setErrors({ form: result?.message ?? "Failed to create campaign." });
        return;
      }

      reset();
      onCreated();
    } catch {
      setErrors({ form: "Failed to create campaign." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Create New Campaign"
      onClose={handleClose}
      panelClassName="max-w-2xl"
      actions={
        <>
          <button type="button" disabled={isSaving} onClick={handleClose} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:text-slate-100">
            Cancel
          </button>
          <PrimaryButton type="button" disabled={isSaving} onClick={() => void handleSubmit()} className="bg-emerald-700 hover:bg-emerald-800">
            {isSaving ? "Adding..." : "Add"}
          </PrimaryButton>
        </>
      }
    >
      <div className="grid gap-4">
        <div>
          <FieldLabel htmlFor="campaign-name" label="Name" />
          <Input id="campaign-name" value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} />
          <FormError error={errors.name} />
        </div>
        <div>
          <FieldLabel htmlFor="campaign-product" label="Product" />
          <select id="campaign-product" value={form.verticalId} onChange={(e) => setForm((c) => ({ ...c, verticalId: e.target.value }))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800">
            <option value="">Please select product</option>
            {verticalOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
          <FormError error={errors.verticalId} />
        </div>
        <div>
          <FieldLabel htmlFor="campaign-buyer" label="Buyer" />
          <select id="campaign-buyer" value={form.buyerId} onChange={(e) => setForm((c) => ({ ...c, buyerId: e.target.value }))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800">
            <option value="">Please select buyer</option>
            {buyerOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
          <FormError error={errors.buyerId} />
        </div>
        <div>
          <FieldLabel htmlFor="campaign-type" label="Campaign type" />
          <select id="campaign-type" value={form.campaignType} onChange={(e) => setForm((c) => ({ ...c, campaignType: e.target.value }))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800">
            <option value="">Please select Campaign type</option>
            {CAMPAIGN_TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <FormError error={errors.campaignType} />
        </div>
        <div>
          <FieldLabel htmlFor="campaign-timezone" label="Timezone" />
          <select id="campaign-timezone" value={form.timezone} onChange={(e) => setForm((c) => ({ ...c, timezone: e.target.value }))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800">
            <option value="">Please select timezone</option>
            {TIMEZONE_OPTIONS.map((timezone) => (
              <option key={timezone} value={timezone}>{timezone}</option>
            ))}
          </select>
          <FormError error={errors.timezone} />
        </div>
        <div>
          <FieldLabel htmlFor="campaign-min-price" label="MinPrice" />
          <Input id="campaign-min-price" type="number" min={0} step="0.01" value={form.minPrice} onChange={(e) => setForm((c) => ({ ...c, minPrice: e.target.value }))} />
        </div>
        <FormError error={errors.form} />
      </div>
    </Modal>
  );
}
