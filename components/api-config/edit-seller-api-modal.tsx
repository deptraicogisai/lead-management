"use client";

import { useEffect, useState } from "react";
import { FieldLabel, FormError, Input, PrimaryButton, Select } from "@/components/ui/form-controls";
import { Modal } from "@/components/ui/modal";

const STATUS_OPTIONS = ["Active", "Inactive"] as const;

type EditSellerApiModalProps = {
  open: boolean;
  sellerId: string;
  mapping: {
    id: string;
    apiName: string;
    verticalName: string;
    status: "Active" | "Inactive";
  } | null;
  onClose: () => void;
  onUpdated: () => void;
};

export function EditSellerApiModal({ open, sellerId, mapping, onClose, onUpdated }: EditSellerApiModalProps) {
  const [form, setForm] = useState({
    apiName: "",
    status: "Active" as (typeof STATUS_OPTIONS)[number],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open || !mapping) return;

    setForm({
      apiName: mapping.apiName,
      status: mapping.status,
    });
    setErrors({});
    setFormError("");
    setIsSaving(false);
  }, [open, mapping]);

  const handleClose = () => {
    setErrors({});
    setFormError("");
    setIsSaving(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (!mapping) return;

    const nextErrors: Record<string, string> = {};
    if (!form.apiName.trim()) nextErrors.apiName = "API Name is required.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSaving(true);
    setFormError("");

    try {
      const response = await fetch(
        `/api/sellers/${encodeURIComponent(sellerId)}/verticals/mappings/${encodeURIComponent(mapping.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiName: form.apiName.trim(),
            status: form.status,
          }),
        }
      );

      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setFormError(result?.message ?? "Failed to update API.");
        return;
      }

      onUpdated();
      handleClose();
    } catch {
      setFormError("Failed to update API.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Edit API"
      onClose={handleClose}
      panelClassName="max-w-lg"
      actions={
        <>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:text-slate-100"
          >
            Cancel
          </button>
          <PrimaryButton type="button" disabled={isSaving} onClick={() => void handleSubmit()} className="bg-emerald-700 hover:bg-emerald-800">
            {isSaving ? "Saving..." : "Save Changes"}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <FieldLabel htmlFor="edit-api-name" label="API Name" />
          <Input
            id="edit-api-name"
            value={form.apiName}
            onChange={(event) => setForm((current) => ({ ...current, apiName: event.target.value }))}
            placeholder="Enter API name"
          />
          <FormError error={errors.apiName} />
        </div>

        <div>
          <FieldLabel htmlFor="edit-api-vertical" label="Vertical" />
          <Input id="edit-api-vertical" value={mapping?.verticalName ?? ""} disabled />
        </div>

        <div>
          <FieldLabel htmlFor="edit-api-status" label="Status" />
          <Select
            id="edit-api-status"
            value={form.status}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                status: event.target.value as (typeof STATUS_OPTIONS)[number],
              }))
            }
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
        </div>

        <FormError error={formError} />
      </div>
    </Modal>
  );
}
