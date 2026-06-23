"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { FieldLabel, FormError, Input, PrimaryButton, CancelButton } from "@/components/ui/form-controls";

type IndustryFormValues = {
  name: string;
  description: string;
};

type IndustryFormProps = {
  initialValues?: IndustryFormValues;
  isEditing?: boolean;
  onSubmitIndustry: (values: IndustryFormValues) => Promise<void> | void;
  onCancelEdit?: () => void;
};

const defaultValues: IndustryFormValues = {
  name: "",
  description: "",
};

export function IndustryForm({
  initialValues,
  isEditing = false,
  onSubmitIndustry,
  onCancelEdit,
}: IndustryFormProps) {
  const [form, setForm] = useState<IndustryFormValues>(initialValues ?? defaultValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};

    if (!form.name.trim()) nextErrors.name = "Vertical name is required.";
    if (!form.description.trim()) nextErrors.description = "Description is required.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    await onSubmitIndustry({
      name: form.name.trim(),
      description: form.description.trim(),
    });

    if (!isEditing) {
      setForm(defaultValues);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <FieldLabel htmlFor="industry-name" label="Vertical Name" />
        <Input
          id="industry-name"
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          placeholder="Mortgage"
        />
        <FormError error={errors.name} />
      </div>

      <div>
        <FieldLabel htmlFor="industry-description" label="Description" />
        <Input
          id="industry-description"
          value={form.description}
          onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
          placeholder="Describe this industry niche"
        />
        <FormError error={errors.description} />
      </div>

      <div className="flex items-center justify-end gap-3">
        {isEditing && onCancelEdit ? (
          <CancelButton type="button" onClick={onCancelEdit} />
        ) : null}
        <PrimaryButton type="submit">{isEditing ? "Update Vertical" : "Create Vertical"}</PrimaryButton>
      </div>
    </form>
  );
}
