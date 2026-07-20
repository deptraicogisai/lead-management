"use client";

import { useState } from "react";
import { CancelButton, FieldLabel, FormError, Input, PrimaryButton } from "@/components/ui/form-controls";
import { Modal } from "@/components/ui/modal";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { TimezoneSelect } from "@/components/ui/timezone-select";
import { CAMPAIGN_TYPE_OPTIONS } from "@/lib/campaign";
import type { CampaignExportPayload } from "@/lib/campaign-export";
import { parseCampaignImportSchema } from "@/lib/campaign-import";
import { cn } from "@/lib/utils";

type Option = { id: string; label: string };

type CampaignCreateType = "new" | "import";

type CampaignCreateModalProps = {
  open: boolean;
  verticalOptions: Array<Option & { name?: string }>;
  buyerOptions: Option[];
  onClose: () => void;
  onCreated: () => void;
};

const formSelectClassName =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800";

const fieldErrorBorderClassName =
  "animate-field-invalid border-red-400 focus:border-red-500 focus:ring-red-100 dark:border-red-500/70 dark:focus:border-red-500";

export function CampaignCreateModal({
  open,
  verticalOptions,
  buyerOptions,
  onClose,
  onCreated,
}: CampaignCreateModalProps) {
  const [createType, setCreateType] = useState<CampaignCreateType>("new");
  const [form, setForm] = useState({
    name: "",
    verticalId: "",
    buyerId: "",
    campaignType: "",
    timezone: "",
    minPrice: "0",
  });
  const [importSchema, setImportSchema] = useState<CampaignExportPayload | null>(null);
  const [importSchemaFileName, setImportSchemaFileName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const reset = () => {
    setCreateType("new");
    setForm({ name: "", verticalId: "", buyerId: "", campaignType: "", timezone: "", minPrice: "0" });
    setImportSchema(null);
    setImportSchemaFileName("");
    setErrors({});
    setIsSaving(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSchemaFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setImportSchema(null);
      setImportSchemaFileName("");
      return;
    }

    try {
      const raw = JSON.parse(await file.text()) as unknown;
      const parsed = parseCampaignImportSchema(raw);
      if (!parsed.ok) {
        setErrors({ schemaFile: parsed.message });
        setImportSchema(null);
        setImportSchemaFileName("");
        return;
      }

      setImportSchema(parsed.schema);
      setImportSchemaFileName(file.name);
      setErrors((current) => ({ ...current, schemaFile: "" }));
    } catch {
      setErrors({ schemaFile: "Unable to read campaign JSON file." });
      setImportSchema(null);
      setImportSchemaFileName("");
    }
  };

  const handleSubmit = async () => {
    const nextErrors: Record<string, string> = {};

    if (createType === "import") {
      if (!importSchema) {
        nextErrors.schemaFile = "Please select a valid campaign JSON file.";
      }
    } else {
      if (!form.name.trim()) nextErrors.name = "Name is required.";
      if (!form.verticalId) nextErrors.verticalId = "Product is required.";
      if (!form.buyerId) nextErrors.buyerId = "Buyer is required.";
      if (!form.campaignType) nextErrors.campaignType = "Campaign type is required.";
      if (!form.timezone) nextErrors.timezone = "Timezone is required.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSaving(true);

    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          createType === "import"
            ? {
                createType: "import",
                importSchema,
              }
            : {
                createType: "new",
                name: form.name.trim(),
                verticalId: form.verticalId,
                buyerId: form.buyerId,
                campaignType: form.campaignType,
                timezone: form.timezone,
                minPrice: Number(form.minPrice),
                status: "Active",
              }
        ),
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
          <CancelButton type="button" disabled={isSaving} onClick={handleClose}>
            Cancel
          </CancelButton>
          <PrimaryButton type="button" disabled={isSaving} onClick={() => void handleSubmit()}>
            {isSaving ? "Adding..." : "Add"}
          </PrimaryButton>
        </>
      }
    >
      <div className="grid gap-4">
        <FormError error={errors.form} />
        <div>
          <FieldLabel htmlFor="campaign-create-type" label="Type" />
          <DropdownSelect
            id="campaign-create-type"
            value={createType}
            options={[
              { value: "new", label: "New" },
              { value: "import", label: "Import" },
            ]}
            onChange={(value) => {
              const nextType = value as CampaignCreateType;
              setCreateType(nextType);
              setErrors((current) => ({ ...current, schemaFile: "" }));
              if (nextType === "new") {
                setImportSchema(null);
                setImportSchemaFileName("");
              }
            }}
            className={formSelectClassName}
          />
        </div>

        {createType === "new" ? (
          <>
            <div>
              <FieldLabel htmlFor="campaign-name" label="Name" />
              <FormError error={errors.name} />
              <Input
                id="campaign-name"
                value={form.name}
                invalid={Boolean(errors.name)}
                onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
              />
            </div>
            <div>
              <FieldLabel htmlFor="campaign-product" label="Product" />
              <FormError error={errors.verticalId} />
              <DropdownSelect
                id="campaign-product"
                value={form.verticalId}
                options={verticalOptions.map((option) => ({
                  value: option.id,
                  label: option.label,
                }))}
                onChange={(verticalId) => setForm((current) => ({ ...current, verticalId }))}
                placeholder="Please select product"
                className={cn(formSelectClassName, Boolean(errors.verticalId) && fieldErrorBorderClassName)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="campaign-buyer" label="Buyer" />
              <FormError error={errors.buyerId} />
              <DropdownSelect
                id="campaign-buyer"
                value={form.buyerId}
                options={buyerOptions.map((option) => ({
                  value: option.id,
                  label: option.label,
                }))}
                onChange={(buyerId) => setForm((current) => ({ ...current, buyerId }))}
                placeholder="Please select buyer"
                className={cn(formSelectClassName, Boolean(errors.buyerId) && fieldErrorBorderClassName)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="campaign-type" label="Campaign type" />
              <FormError error={errors.campaignType} />
              <DropdownSelect
                id="campaign-type"
                value={form.campaignType}
                options={CAMPAIGN_TYPE_OPTIONS.map((type) => ({ value: type, label: type }))}
                onChange={(campaignType) => setForm((current) => ({ ...current, campaignType }))}
                placeholder="Please select Campaign type"
                className={cn(formSelectClassName, Boolean(errors.campaignType) && fieldErrorBorderClassName)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="campaign-timezone" label="Timezone" />
              <FormError error={errors.timezone} />
              <TimezoneSelect
                id="campaign-timezone"
                value={form.timezone}
                onChange={(timezone) => setForm((current) => ({ ...current, timezone }))}
                className={cn(formSelectClassName, Boolean(errors.timezone) && fieldErrorBorderClassName)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="campaign-min-price" label="MinPrice" />
              <Input
                id="campaign-min-price"
                type="number"
                min={0}
                step="0.01"
                value={form.minPrice}
                onChange={(e) => setForm((c) => ({ ...c, minPrice: e.target.value }))}
              />
            </div>
          </>
        ) : (
          <div>
            <FieldLabel htmlFor="campaign-schema-file" label="Schema File" />
            <FormError error={errors.schemaFile} />
            <input
              id="campaign-schema-file"
              type="file"
              accept=".json,application/json"
              onChange={(event) => void handleSchemaFileChange(event)}
              className={cn(
                "block w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:file:bg-slate-700 dark:file:text-slate-100 dark:hover:file:bg-slate-600",
                Boolean(errors.schemaFile) && fieldErrorBorderClassName
              )}
            />
            {importSchemaFileName ? (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Selected: {importSchemaFileName}</p>
            ) : null}
          </div>
        )}
      </div>
    </Modal>
  );
}
