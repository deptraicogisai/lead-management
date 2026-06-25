"use client";

import { useEffect, useState } from "react";
import { CancelButton, FieldLabel, FormError, Input, PrimaryButton, Select } from "@/components/ui/form-controls";
import { Modal } from "@/components/ui/modal";
import { MAPPING_API_TYPE_OPTIONS, type MappingApiType } from "@/lib/mapping-api-type";

const API_STATUS_OPTIONS = ["Active", "Inactive", "Deleted"] as const;
type ApiStatus = (typeof API_STATUS_OPTIONS)[number];

type EditSellerApiModalProps = {
  open: boolean;
  sellerId: string;
  mapping: {
    id: string;
    apiName: string;
    verticalName: string;
    apiType: MappingApiType;
    status: ApiStatus;
  } | null;
  onClose: () => void;
  onUpdated: () => void;
};

export function EditSellerApiModal({ open, sellerId, mapping, onClose, onUpdated }: EditSellerApiModalProps) {
  const [form, setForm] = useState({
    apiName: "",
    apiType: "Redirect" as MappingApiType,
    status: "Active" as ApiStatus,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open || !mapping) return;

    setForm({
      apiName: mapping.apiName,
      apiType: mapping.apiType,
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
    if (!form.apiName.trim()) nextErrors.apiName = "Publisher Channel name is required.";
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
            apiType: form.apiType,
            status: form.status,
          }),
        }
      );

      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setFormError(result?.message ?? "Failed to update publisher channel.");
        return;
      }

      onUpdated();
      handleClose();
    } catch {
      setFormError("Failed to update publisher channel.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Edit Publisher Channel"
      onClose={handleClose}
      panelClassName="max-w-lg"
      actions={
        <>
          <CancelButton type="button"
            onClick={handleClose}
            disabled={isSaving}
            
          >Cancel</CancelButton>
          <PrimaryButton type="button" disabled={isSaving} onClick={() => void handleSubmit()}>
            {isSaving ? "Saving..." : "Save Changes"}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        <FormError error={formError} />
        <div>
          <FieldLabel htmlFor="edit-api-name" label="Publisher Channel" />
          <FormError error={errors.apiName} />
          <Input
            id="edit-api-name"
            value={form.apiName}
            invalid={Boolean(errors.apiName)}
            onChange={(event) => setForm((current) => ({ ...current, apiName: event.target.value }))}
            placeholder="Enter publisher channel name"
          />
        </div>

        <div>
          <FieldLabel htmlFor="edit-api-vertical" label="Vertical" />
          <Input id="edit-api-vertical" value={mapping?.verticalName ?? ""} disabled />
        </div>

        <div>
          <FieldLabel htmlFor="edit-api-type" label="Type" />
          <Select
            id="edit-api-type"
            value={form.apiType}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                apiType: event.target.value as MappingApiType,
              }))
            }
          >
            {MAPPING_API_TYPE_OPTIONS.map((apiType) => (
              <option key={apiType} value={apiType}>
                {apiType}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <FieldLabel htmlFor="edit-api-status" label="Status" />
          <Select
            id="edit-api-status"
            value={form.status}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                status: event.target.value as ApiStatus }))
            }
          >
            {API_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </Modal>
  );
}
