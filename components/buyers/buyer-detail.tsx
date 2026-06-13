"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useBreadcrumbLabel } from "@/components/layout/breadcrumb-context";
import {
  CircleHelp,
  ExternalLink,
  Globe,
  Info,
  List,
  Megaphone,
  Plug,
  Share2,
  X,
} from "lucide-react";
import { FormError, Input, PrimaryButton } from "@/components/ui/form-controls";
import {
  SearchableMultiSelect,
  type SearchableMultiSelectOption,
} from "@/components/ui/searchable-multi-select";
import { toast } from "@/lib/toast";
import {
  normalizeBuyerStatus,
  type BuyerListRecord,
  type BuyerUpdatePayload,
} from "@/lib/buyer";
import type { IntegrationOption } from "@/lib/buyer-integrations";
import { cn } from "@/lib/utils";

const buyerTabs = [
  { id: "global", label: "Global", icon: Globe },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "sources", label: "Sources", icon: Share2 },
] as const;

type BuyerTabId = (typeof buyerTabs)[number]["id"];

type PublisherOption = SearchableMultiSelectOption & {
  name: string;
  email: string;
  status: "Active" | "Inactive";
  displayId: number;
};

const rightHeaderActions = [
  { label: "Lead Details", icon: List, href: "/reports/buyer/lead-details" },
  { label: "Campaigns", icon: Megaphone, href: "/campaigns" },
] as const;

const selectClassName =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25";

function FieldLabelWithHelp({
  htmlFor,
  label,
  showLinkIcon = false,
}: {
  htmlFor: string;
  label: string;
  showLinkIcon?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className={cn("text-sm font-medium text-slate-700 dark:text-slate-200", "sm:text-right")}>
      <span className="inline-flex items-center justify-end gap-1.5">
        <span>{label}</span>
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-slate-500 dark:border-slate-500 dark:text-slate-400">
          <CircleHelp size={10} strokeWidth={2.5} />
        </span>
        {showLinkIcon ? <ExternalLink size={12} className="text-slate-500 dark:text-slate-400" /> : null}
      </span>
    </label>
  );
}

type BuyerDetailProps = {
  buyer: BuyerListRecord;
};

export function BuyerDetail({ buyer }: BuyerDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTabId, setActiveTabId] = useState<BuyerTabId>(() => {
    const tab = searchParams.get("tab");
    if (tab === "integrations") return "integrations";
    if (tab === "sources") return "sources";
    return "global";
  });
  const [name, setName] = useState(buyer.name);
  const [email, setEmail] = useState(buyer.email);
  const [status, setStatus] = useState<"Active" | "Inactive">(normalizeBuyerStatus(buyer.status));
  const [selectedIntegrationIds, setSelectedIntegrationIds] = useState<string[]>(buyer.integrationIds);
  const [integrationOptions, setIntegrationOptions] = useState<IntegrationOption[]>([]);
  const [isLoadingIntegrations, setIsLoadingIntegrations] = useState(true);
  const [integrationPickerValue, setIntegrationPickerValue] = useState("");
  const [isSavingIntegrations, setIsSavingIntegrations] = useState(false);
  const [allowedPublisherIds, setAllowedPublisherIds] = useState<string[]>(buyer.allowedPublisherIds);
  const [blockedPublisherIds, setBlockedPublisherIds] = useState<string[]>(buyer.blockedPublisherIds);
  const [publisherOptions, setPublisherOptions] = useState<PublisherOption[]>([]);
  const [isLoadingPublishers, setIsLoadingPublishers] = useState(true);
  const [isSavingSources, setIsSavingSources] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const activeTab = buyerTabs.find((tab) => tab.id === activeTabId) ?? buyerTabs[0];

  useBreadcrumbLabel(`[${buyer.displayId}] ${name}`);

  useEffect(() => {
    setName(buyer.name);
    setEmail(buyer.email);
    setStatus(normalizeBuyerStatus(buyer.status));
    setSelectedIntegrationIds(buyer.integrationIds);
    setAllowedPublisherIds(buyer.allowedPublisherIds);
    setBlockedPublisherIds(buyer.blockedPublisherIds);
  }, [buyer]);

  useEffect(() => {
    const fetchIntegrationOptions = async () => {
      setIsLoadingIntegrations(true);
      try {
        const response = await fetch("/api/integration-builder");
        if (!response.ok) return;

        const records = (await response.json()) as Array<{
          id: string;
          displayId: number;
          name: string;
          product: string;
          productLabel: string;
        }>;

        setIntegrationOptions(
          records.map((record) => ({
            id: record.id,
            displayId: record.displayId,
            name: record.name,
            product: record.product,
            label: `[${record.displayId}] ${record.name} (Custom) (${record.product})`,
          }))
        );
      } finally {
        setIsLoadingIntegrations(false);
      }
    };

    void fetchIntegrationOptions();
  }, []);

  useEffect(() => {
    const fetchPublishers = async () => {
      setIsLoadingPublishers(true);
      try {
        const response = await fetch("/api/sellers");
        if (!response.ok) return;

        const records = (await response.json()) as Array<{
          id: string;
          displayId?: number;
          name: string;
          email: string;
          status: "Active" | "Inactive";
        }>;

        setPublisherOptions(
          records.map((record, index) => {
            const displayId = record.displayId ?? index + 1001;
            return {
              id: record.id,
              displayId,
              name: record.name,
              email: record.email,
              status: record.status,
              label: record.name,
              description: `${record.email} · ${record.status}`,
            };
          })
        );
      } finally {
        setIsLoadingPublishers(false);
      }
    };

    void fetchPublishers();
  }, []);

  const selectedIntegrations = useMemo(
    () =>
      selectedIntegrationIds
        .map((id) => integrationOptions.find((option) => option.id === id))
        .filter((option): option is IntegrationOption => Boolean(option)),
    [integrationOptions, selectedIntegrationIds]
  );

  const availableIntegrationOptions = useMemo(
    () => integrationOptions.filter((option) => !selectedIntegrationIds.includes(option.id)),
    [integrationOptions, selectedIntegrationIds]
  );

  const allowPublisherOptions = useMemo(
    () => publisherOptions.filter((publisher) => !blockedPublisherIds.includes(publisher.id)),
    [blockedPublisherIds, publisherOptions]
  );

  const blockPublisherOptions = useMemo(
    () => publisherOptions.filter((publisher) => !allowedPublisherIds.includes(publisher.id)),
    [allowedPublisherIds, publisherOptions]
  );

  const handleAllowedPublishersChange = (ids: string[]) => {
    setAllowedPublisherIds(ids);
    setBlockedPublisherIds((current) => current.filter((id) => !ids.includes(id)));
  };

  const handleBlockedPublishersChange = (ids: string[]) => {
    setBlockedPublisherIds(ids);
    setAllowedPublisherIds((current) => current.filter((id) => !ids.includes(id)));
  };

  const renderDetailRow = (labelText: string, control: ReactNode, showLinkIcon = false) => (
    <div className="grid gap-2 py-2 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-center sm:gap-6">
      <FieldLabelWithHelp htmlFor={`buyer-${labelText.toLowerCase().replace(/\s+/g, "-")}`} label={`${labelText}:`} showLinkIcon={showLinkIcon} />
      <div className="min-w-0">{control}</div>
    </div>
  );

  const handleSave = async () => {
    if (!name.trim()) {
      setSaveError("Name cannot be blank.");
      return;
    }

    const payload: BuyerUpdatePayload = {
      name: name.trim(),
      email: email.trim(),
      status,
    };

    setIsSaving(true);
    setSaveError("");

    try {
      const response = await fetch(`/api/buyers/${encodeURIComponent(buyer.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { message?: string } | null;
        toast.error(result?.message ?? "Failed to save buyer.");
        return;
      }

      toast.success("Buyer saved successfully.");
      router.refresh();
    } catch {
      toast.error("Failed to save buyer.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveIntegrations = async () => {
    setIsSavingIntegrations(true);

    try {
      const response = await fetch(`/api/buyers/${encodeURIComponent(buyer.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrationIds: selectedIntegrationIds }),
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { message?: string } | null;
        toast.error(result?.message ?? "Failed to save integrations.");
        return;
      }

      toast.success("Integrations saved successfully.");
      router.refresh();
    } catch {
      toast.error("Failed to save integrations.");
    } finally {
      setIsSavingIntegrations(false);
    }
  };

  const handleSaveSources = async () => {
    setIsSavingSources(true);

    try {
      const response = await fetch(`/api/buyers/${encodeURIComponent(buyer.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allowedPublisherIds,
          blockedPublisherIds,
        }),
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { message?: string } | null;
        toast.error(result?.message ?? "Failed to save sources.");
        return;
      }

      toast.success("Sources saved successfully.");
      router.refresh();
    } catch {
      toast.error("Failed to save sources.");
    } finally {
      setIsSavingSources(false);
    }
  };

  const addIntegration = (integrationId: string) => {
    if (!integrationId || selectedIntegrationIds.includes(integrationId)) return;
    setSelectedIntegrationIds((current) => [...current, integrationId]);
    setIntegrationPickerValue("");
  };

  const removeIntegration = (integrationId: string) => {
    setSelectedIntegrationIds((current) => current.filter((id) => id !== integrationId));
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete buyer "${name}"?`)) return;

    setIsDeleting(true);
    setDeleteError("");

    try {
      const response = await fetch(`/api/buyers/${encodeURIComponent(buyer.id)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { message?: string } | null;
        setDeleteError(result?.message ?? "Failed to delete buyer.");
        return;
      }

      router.push("/buyers");
      router.refresh();
    } catch {
      setDeleteError("Failed to delete buyer.");
    } finally {
      setIsDeleting(false);
    }
  };

  const renderGlobalTab = () => (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex justify-end border-b border-slate-200 px-6 py-4 dark:border-slate-700">
        <button
          type="button"
          disabled={isDeleting}
          onClick={() => void handleDelete()}
          className="rounded-xl border border-orange-500 bg-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-600 disabled:opacity-60"
        >
          {isDeleting ? "Deleting..." : "Delete Buyer"}
        </button>
      </div>

      <div className="px-6 py-8">
        <div className="mx-auto w-full max-w-3xl space-y-1">
          {renderDetailRow(
            "Name",
            <Input
              id="buyer-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (saveError) setSaveError("");
              }}
            />
          )}
          {renderDetailRow(
            "Email",
            <Input
              id="buyer-email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (saveError) setSaveError("");
              }}
            />
          )}
          {renderDetailRow(
            "Status",
            <select
              id="buyer-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as "Active" | "Inactive")}
              className={selectClassName}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          )}
          <div className="grid gap-2 pt-6 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
            <div aria-hidden />
            <div className="space-y-2">
              <PrimaryButton
                type="button"
                disabled={isSaving}
                onClick={() => void handleSave()}
                className="bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                {isSaving ? "Saving..." : "Save"}
              </PrimaryButton>
              <FormError error={saveError || deleteError} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderIntegrationsTab = () => (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="px-6 py-8">
        <div className="mx-auto w-full max-w-4xl space-y-1">
          {renderDetailRow(
            "Available integrations",
            <div className="flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                {selectedIntegrations.map((integration) => (
                  <span
                    key={integration.id}
                    className="inline-flex max-w-full items-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <span className="truncate">{integration.label}</span>
                    <button
                      type="button"
                      onClick={() => removeIntegration(integration.id)}
                      className="shrink-0 rounded p-0.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                      aria-label={`Remove ${integration.label}`}
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}

                <select
                  id="buyer-available-integrations"
                  value={integrationPickerValue}
                  onChange={(event) => {
                    const value = event.target.value;
                    setIntegrationPickerValue(value);
                    addIntegration(value);
                  }}
                  disabled={isLoadingIntegrations || availableIntegrationOptions.length === 0}
                  className="min-w-[12rem] flex-1 border-0 bg-transparent py-1.5 text-sm text-slate-800 outline-none dark:text-slate-50"
                >
                  <option value="">
                    {isLoadingIntegrations
                      ? "Loading integrations..."
                      : availableIntegrationOptions.length === 0
                        ? selectedIntegrations.length > 0
                          ? ""
                          : "No integrations available"
                        : "Select integration"}
                  </option>
                  {availableIntegrationOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="grid gap-2 pt-6 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
            <div aria-hidden />
            <div className="space-y-2">
              <PrimaryButton
                type="button"
                disabled={isSavingIntegrations}
                onClick={() => void handleSaveIntegrations()}
                className="bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                {isSavingIntegrations ? "Saving..." : "Save"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSourcesTab = () => (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="px-6 py-8">
        <div className="mx-auto w-full max-w-4xl space-y-1">
          {renderDetailRow(
            "Allow Publishers",
            <SearchableMultiSelect
              id="buyer-allow-publishers"
              selectedIds={allowedPublisherIds}
              onChange={handleAllowedPublishersChange}
              options={allowPublisherOptions}
              labelOptions={publisherOptions}
              isLoading={isLoadingPublishers}
              placeholder="Select allowed publishers..."
              searchPlaceholder="Search publishers..."
              emptyMessage="No publishers available."
            />
          )}

          {renderDetailRow(
            "Block Publishers",
            <SearchableMultiSelect
              id="buyer-block-publishers"
              selectedIds={blockedPublisherIds}
              onChange={handleBlockedPublishersChange}
              options={blockPublisherOptions}
              labelOptions={publisherOptions}
              isLoading={isLoadingPublishers}
              placeholder="Select blocked publishers..."
              searchPlaceholder="Search publishers..."
              emptyMessage="No publishers available."
            />
          )}

          <div className="grid gap-2 pt-6 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
            <div aria-hidden />
            <div className="space-y-2">
              <PrimaryButton
                type="button"
                disabled={isSavingSources}
                onClick={() => void handleSaveSources()}
                className="bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                {isSavingSources ? "Saving..." : "Save"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPlaceholderTab = () => (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">
          <Globe size={20} />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{activeTab.label}</h3>
          <p className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            This section is ready for the detailed buyer configuration controls you want to add next.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 dark:border-slate-600 dark:bg-slate-800/40">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
          <Info size={16} />
          <h4 className="text-sm font-semibold">Coming Soon</h4>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          The tab layout now matches your buyer detail reference. Global settings are fully wired to the database.
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="flex flex-wrap gap-2">
            {rightHeaderActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-700 bg-emerald-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                >
                  <Icon size={16} />
                  {action.label}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          <span className="font-medium text-slate-700 dark:text-slate-200">Active Users:</span>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500 text-sm font-semibold text-white">
            M
          </span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/70">
          <div className="flex min-w-max items-center gap-2">
            {buyerTabs.map((tab) => {
              const isActive = tab.id === activeTab.id;
              const Icon = tab.icon;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTabId(tab.id)}
                  className={cn(
                    "inline-flex items-center gap-2 whitespace-nowrap rounded-2xl border px-4 py-2.5 text-sm font-medium transition duration-200",
                    isActive
                      ? "border-emerald-700 bg-emerald-800 text-white shadow-sm dark:border-emerald-500 dark:bg-emerald-600"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                  )}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {activeTab.id === "global"
          ? renderGlobalTab()
          : activeTab.id === "integrations"
            ? renderIntegrationsTab()
            : activeTab.id === "sources"
              ? renderSourcesTab()
              : renderPlaceholderTab()}
      </section>
    </div>
  );
}
