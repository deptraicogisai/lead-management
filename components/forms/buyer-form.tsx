"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useSystemSettings } from "@/components/settings/system-settings-context";
import { buildBuyerLeadApiUrls, buildBuyerLeadPostUrl, generateBuyerApiKey } from "@/lib/buyer-lead-api";
import { type BuyerCreatePayload } from "@/lib/buyer";
import { CopyableValue } from "@/components/ui/copy-button";
import { FieldLabel, FormError, Input, PrimaryButton, SecondaryButton } from "@/components/ui/form-controls";
import { DropdownSelect } from "@/components/ui/dropdown-select";

type BuyerFormProps = {
  isSaving?: boolean;
  onSubmit: (values: BuyerCreatePayload) => Promise<void> | void;
};

const defaultValues: BuyerCreatePayload = {
  name: "",
  email: "",
  status: "Active",
  apiKey: "",
  postLeadUrl: "",
};

export function BuyerForm({ isSaving = false, onSubmit }: BuyerFormProps) {
  const { testMode } = useSystemSettings();
  const [form, setForm] = useState<BuyerCreatePayload>(defaultValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (typeof window === "undefined" || !testMode) return;
    setForm((current) => ({
      ...current,
      postLeadUrl: current.postLeadUrl?.trim() || buildBuyerLeadPostUrl(window.location.origin),
    }));
  }, [testMode]);

  const handleGenerateApi = () => {
    const apiKey = generateBuyerApiKey();
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const urls = origin ? buildBuyerLeadApiUrls(origin) : null;
    setForm((current) => ({
      ...current,
      apiKey,
      postLeadUrl: urls?.postUrl || "",
    }));
    setErrors((current) => {
      const next = { ...current };
      delete next.apiKey;
      delete next.postLeadUrl;
      return next;
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};

    if (!form.name.trim()) nextErrors.name = "Buyer name is required.";
    if (!form.email.includes("@")) nextErrors.email = "A valid email is required.";
    if (testMode && !form.apiKey?.trim()) {
      nextErrors.apiKey = "Generate an API key before creating the buyer.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const apiKey = form.apiKey?.trim() || (testMode ? generateBuyerApiKey() : "");
    const postLeadUrl =
      form.postLeadUrl?.trim() || (testMode && origin ? buildBuyerLeadPostUrl(origin) : "");

    await onSubmit({
      name: form.name.trim(),
      email: form.email.trim(),
      status: form.status,
      apiKey,
      postLeadUrl,
    });
  };

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
      <div>
        <FieldLabel htmlFor="buyer-name" label="Buyer Name" />
        <FormError error={errors.name} />
        <Input
          id="buyer-name"
          value={form.name}
          invalid={Boolean(errors.name)}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          placeholder="Acme Financial"
        />
      </div>

      <div>
        <FieldLabel htmlFor="buyer-email" label="Buyer Email" />
        <FormError error={errors.email} />
        <Input
          id="buyer-email"
          type="email"
          value={form.email}
          invalid={Boolean(errors.email)}
          onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          placeholder="ops@acme.com"
        />
      </div>

      <div>
        <FieldLabel htmlFor="buyer-status" label="Buyer Status" />
        <DropdownSelect
          id="buyer-status"
          value={form.status}
          options={[
            { value: "Active", label: "Active" },
            { value: "Inactive", label: "Inactive" },
          ]}
          onChange={(status) =>
            setForm((current) => ({ ...current, status: status as BuyerCreatePayload["status"] }))
          }
        />
      </div>

      {testMode ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Buyer Lead API</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Used while Test Mode is on. Generate Ping + Post mock URLs and send{" "}
                <code className="text-[11px]">x-api-key</code> in the integration request mapping header.
              </p>
            </div>
            <SecondaryButton type="button" onClick={handleGenerateApi}>
              Generate API
            </SecondaryButton>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <FieldLabel htmlFor="buyer-api-key" label="API Key (x-api-key header)" />
              <FormError error={errors.apiKey} />
              <Input
                id="buyer-api-key"
                value={form.apiKey ?? ""}
                readOnly
                invalid={Boolean(errors.apiKey)}
                placeholder="Click Generate API"
              />
            </div>

            {(() => {
              const origin = typeof window !== "undefined" ? window.location.origin : "";
              const urls = origin ? buildBuyerLeadApiUrls(origin) : null;
              const pingUrl = urls?.pingUrl ?? "";
              const postUrl = form.postLeadUrl?.trim() || urls?.postUrl || "";
              return (
                <>
                  <div>
                    <FieldLabel htmlFor="buyer-ping-lead-url" label="Ping URL" />
                    <p className="mb-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <code className="text-[11px]">/api/lists/addlead/ping</code>
                    </p>
                    {pingUrl ? (
                      <CopyableValue value={pingUrl} copyLabel="Copy Ping URL" />
                    ) : (
                      <Input id="buyer-ping-lead-url" value="" readOnly placeholder="Click Generate API" />
                    )}
                  </div>
                  <div>
                    <FieldLabel htmlFor="buyer-post-lead-url" label="Post URL" />
                    <FormError error={errors.postLeadUrl} />
                    <p className="mb-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <code className="text-[11px]">/api/lists/addlead/post</code>
                    </p>
                    {postUrl ? (
                      <CopyableValue value={postUrl} copyLabel="Copy Post URL" />
                    ) : (
                      <Input
                        id="buyer-post-lead-url"
                        value=""
                        readOnly
                        invalid={Boolean(errors.postLeadUrl)}
                        placeholder="Generated automatically"
                      />
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        <PrimaryButton type="submit" disabled={isSaving}>
          {isSaving ? "Creating..." : "Create Buyer"}
        </PrimaryButton>
      </div>
    </form>
  );
}
