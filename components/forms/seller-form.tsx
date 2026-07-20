"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Seller } from "@/lib/mock-data";
import { TagSuggestInput } from "@/components/ui/tag-suggest-input";
import { FieldLabel, FormError, Input, PrimaryButton, CancelButton } from "@/components/ui/form-controls";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { normalizePublisherTag } from "@/lib/publisher-tag";

const SELLER_STATUS_DETAIL_OPTIONS: Seller["status"][] = ["Active", "Inactive", "Deleted"];

type SellerFormValues = {
  name: string;
  email: string;
  publisherTag: string;
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
  publisherTag: "",
  status: "Active",
};

export function SellerForm({ initialValues, isEditing = false, onSubmitSeller, onCancelEdit }: SellerFormProps) {
  const [form, setForm] = useState<SellerFormValues>(initialValues ?? defaultValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (!initialValues) {
      setForm(defaultValues);
      return;
    }

    setForm(initialValues);
  }, [
    isEditing,
    initialValues?.name,
    initialValues?.email,
    initialValues?.publisherTag,
    initialValues?.status,
  ]);

  const loadTagSuggestions = async () => {
    try {
      const response = await fetch("/api/sellers/tags");
      if (!response.ok) return;

      const data = (await response.json()) as { tags?: string[] };
      setTagSuggestions(Array.isArray(data.tags) ? data.tags : []);
    } catch {
      setTagSuggestions([]);
    }
  };

  useEffect(() => {
    void loadTagSuggestions();
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!form.name.trim()) newErrors.name = "Publisher name is required.";
    if (!form.email.includes("@")) newErrors.email = "A valid email is required.";

    setErrors(newErrors);
    if (Object.keys(newErrors).length === 0) {
      await onSubmitSeller({
        name: form.name.trim(),
        email: form.email.trim(),
        publisherTag: normalizePublisherTag(form.publisherTag),
        status: form.status,
      });
      await loadTagSuggestions();
      if (!isEditing) {
        setForm(defaultValues);
      }
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <FieldLabel htmlFor="seller-name" label="Publisher Name" />
        <FormError error={errors.name} />
        <Input
          id="seller-name"
          value={form.name}
          invalid={Boolean(errors.name)}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="NorthStar Media"
        />
      </div>

      <div>
        <FieldLabel htmlFor="seller-email" label="Publisher Email" />
        <FormError error={errors.email} />
        <Input
          id="seller-email"
          type="email"
          value={form.email}
          invalid={Boolean(errors.email)}
          onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          placeholder="ops@northstar.com"
        />
      </div>

      <div>
        <FieldLabel htmlFor="seller-publisher-tag" label="Publisher Tag" />
        <TagSuggestInput
          id="seller-publisher-tag"
          value={form.publisherTag}
          onChange={(publisherTag) => setForm((prev) => ({ ...prev, publisherTag }))}
          suggestions={tagSuggestions}
          placeholder="Internal"
        />
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          Type at least 2 characters to see previously used tags, or enter a new tag.
        </p>
      </div>

      <div>
        <FieldLabel htmlFor="seller-status" label="Publisher Status" />
        <DropdownSelect
          id="seller-status"
          value={form.status}
          options={SELLER_STATUS_DETAIL_OPTIONS.map((status) => ({
            value: status,
            label: status,
          }))}
          onChange={(status) =>
            setForm((previous) => ({ ...previous, status: status as Seller["status"] }))
          }
        />
      </div>

      <div className="flex items-center justify-end gap-3">
        {isEditing && onCancelEdit ? (
          <CancelButton type="button" onClick={onCancelEdit} />
        ) : null}
        <PrimaryButton type="submit">{isEditing ? "Update Publisher" : "Create Publisher"}</PrimaryButton>
      </div>
    </form>
  );
}
