"use client";

import { useEffect, useState } from "react";
import { CancelButton, FieldLabel, FormError, Input, PrimaryButton, Select } from "@/components/ui/form-controls";
import { Modal } from "@/components/ui/modal";
import { MAPPING_API_TYPE_OPTIONS, type MappingApiType } from "@/lib/mapping-api-type";

const STATUS_OPTIONS = ["Active", "Inactive"] as const;

type VerticalOption = {
  id: string;
  name: string;
};

type CreateSellerApiModalProps = {
  open: boolean;
  sellerId: string;
  onClose: () => void;
  onCreated: () => void;
};

export function CreateSellerApiModal({ open, sellerId, onClose, onCreated }: CreateSellerApiModalProps) {
  const [verticalOptions, setVerticalOptions] = useState<VerticalOption[]>([]);
  const [isLoadingVerticals, setIsLoadingVerticals] = useState(false);
  const [form, setForm] = useState({
    apiName: "",
    verticalId: "",
    apiType: "Redirect" as MappingApiType,
    status: "Active" as (typeof STATUS_OPTIONS)[number],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    const fetchVerticals = async () => {
      setIsLoadingVerticals(true);
      try {
        const response = await fetch("/api/industries");
        if (!response.ok) return;
        const data = (await response.json()) as VerticalOption[];
        setVerticalOptions(data);
      } finally {
        setIsLoadingVerticals(false);
      }
    };

    void fetchVerticals();
  }, [open]);

  const reset = () => {
    setForm({ apiName: "", verticalId: "", apiType: "Redirect", status: "Active" });
    setErrors({});
    setFormError("");
    setIsSaving(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    const nextErrors: Record<string, string> = {};
    if (!form.apiName.trim()) nextErrors.apiName = "Publisher Channel name is required.";
    if (!form.verticalId) nextErrors.verticalId = "Vertical is required.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSaving(true);
    setFormError("");

    try {
      const response = await fetch(`/api/sellers/${encodeURIComponent(sellerId)}/verticals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiName: form.apiName.trim(),
          verticalId: form.verticalId,
          apiType: form.apiType,
          status: form.status,
        }),
      });

      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setFormError(result?.message ?? "Failed to create publisher channel.");
        return;
      }

      reset();
      onCreated();
      onClose();
    } catch {
      setFormError("Failed to create publisher channel.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Create Publisher Channel"
      description="Each publisher channel receives a unique API key. A publisher can have multiple channels, including multiple channels for the same vertical."
      onClose={handleClose}
      panelClassName="max-w-lg"
      actions={
        <>
          <CancelButton type="button"
            onClick={handleClose}
            disabled={isSaving}
            
          >Cancel</CancelButton>
          <PrimaryButton type="button" disabled={isSaving} onClick={() => void handleSubmit()}>
            {isSaving ? "Creating..." : "Create Publisher Channel"}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        <FormError error={formError} />
        <div>
          <FieldLabel htmlFor="create-api-name" label="Publisher Channel" />
          <FormError error={errors.apiName} />
          <Input
            id="create-api-name"
            value={form.apiName}
            invalid={Boolean(errors.apiName)}
            onChange={(event) => setForm((current) => ({ ...current, apiName: event.target.value }))}
            placeholder="Enter publisher channel name"
          />
        </div>

        <div>
          <FieldLabel htmlFor="create-api-vertical" label="Vertical" />
          <FormError error={errors.verticalId} />
          <Select
            id="create-api-vertical"
            value={form.verticalId}
            invalid={Boolean(errors.verticalId)}
            disabled={isLoadingVerticals}
            onChange={(event) => setForm((current) => ({ ...current, verticalId: event.target.value }))}
          >
            <option value="">{isLoadingVerticals ? "Loading verticals..." : "Please select vertical"}</option>
            {verticalOptions.map((vertical, index) => (
              <option key={vertical.id} value={vertical.id}>
                [{index + 1}] {vertical.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <FieldLabel htmlFor="create-api-type" label="Type" />
          <Select
            id="create-api-type"
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
          <FieldLabel htmlFor="create-api-status" label="Status" />
          <Select
            id="create-api-status"
            value={form.status}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                status: event.target.value as (typeof STATUS_OPTIONS)[number] }))
            }
          >
            {STATUS_OPTIONS.map((status) => (
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
