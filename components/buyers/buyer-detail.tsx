"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useBreadcrumbLabel } from "@/components/layout/breadcrumb-context";
import { useSystemSettings } from "@/components/settings/system-settings-context";
import {
  CircleHelp,
  ExternalLink,
  Globe,
  Info,
  List,
  ListFilter,
  Megaphone,
  Plug,
  Share2,
} from "lucide-react";
import { FormError, Input, PrimaryButton, SecondaryButton } from "@/components/ui/form-controls";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { CopyableValue } from "@/components/ui/copy-button";
import { buildBuyerLeadApiUrls, generateBuyerApiKey } from "@/lib/buyer-lead-api";
import {
  SearchableMultiSelect,
  type SearchableMultiSelectOption,
} from "@/components/ui/searchable-multi-select";
import { toast } from "@/lib/toast";
import { BuyerPlDnplSettings } from "@/components/buyers/buyer-pl-dnpl-settings";
import {
  normalizeBuyerStatus,
  BUYER_STATUS_DETAIL_OPTIONS,
  type BuyerListRecord,
  type BuyerStatus,
  type BuyerUpdatePayload,
} from "@/lib/buyer";
import type { IntegrationOption } from "@/lib/buyer-integrations";
import type { PresentListRecord } from "@/lib/present-list";
import { cn } from "@/lib/utils";
import { PageTabBar } from "@/components/ui/page-tab-bar";

const buyerTabs = [
  { id: "global", label: "Global", icon: Globe },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "sources", label: "Sources", icon: Share2 },
  { id: "pl-dnpl", label: "PL/DNPL", icon: ListFilter },
] as const;

type BuyerTabId = (typeof buyerTabs)[number]["id"];

function resolveBuyerTabId(tab: string | null): BuyerTabId {
  if (buyerTabs.some((item) => item.id === tab)) {
    return tab as BuyerTabId;
  }
  return "global";
}

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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { testMode } = useSystemSettings();
  const activeTabId = resolveBuyerTabId(searchParams.get("tab"));
  const [name, setName] = useState(buyer.name);
  const [email, setEmail] = useState(buyer.email);
  const [status, setStatus] = useState<BuyerStatus>(normalizeBuyerStatus(buyer.status));
  const [apiKey, setApiKey] = useState(buyer.apiKey);
  const [postLeadUrl, setPostLeadUrl] = useState(buyer.postLeadUrl);
  const [selectedIntegrationIds, setSelectedIntegrationIds] = useState<string[]>(buyer.integrationIds);
  const [integrationOptions, setIntegrationOptions] = useState<IntegrationOption[]>([]);
  const [activeIntegrationIds, setActiveIntegrationIds] = useState<Set<string>>(new Set());
  const [isLoadingIntegrations, setIsLoadingIntegrations] = useState(true);
  const [isSavingIntegrations, setIsSavingIntegrations] = useState(false);
  const [blockedPublisherIds, setBlockedPublisherIds] = useState<string[]>(buyer.blockedPublisherIds);
  const [publisherOptions, setPublisherOptions] = useState<PublisherOption[]>([]);
  const [isLoadingPublishers, setIsLoadingPublishers] = useState(true);
  const [isSavingSources, setIsSavingSources] = useState(false);
  const [selectedPlDnplIds, setSelectedPlDnplIds] = useState<string[]>(buyer.plDnplListIds);
  const [copyPlDnplToOtherBuyers, setCopyPlDnplToOtherBuyers] = useState(false);
  const [copyPlDnplBuyerIds, setCopyPlDnplBuyerIds] = useState<string[]>([]);
  const [presentLists, setPresentLists] = useState<PresentListRecord[]>([]);
  const [isLoadingPresentLists, setIsLoadingPresentLists] = useState(false);
  const [isSavingPlDnpl, setIsSavingPlDnpl] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const activeTab = buyerTabs.find((tab) => tab.id === activeTabId) ?? buyerTabs[0];

  const handleTabChange = (tabId: BuyerTabId) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tabId === "global") {
      params.delete("tab");
    } else {
      params.set("tab", tabId);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  useBreadcrumbLabel(`[${buyer.displayId}] ${name}`);

  useEffect(() => {
    setName(buyer.name);
    setEmail(buyer.email);
    setStatus(normalizeBuyerStatus(buyer.status));
    setApiKey(buyer.apiKey);
    setPostLeadUrl(buyer.postLeadUrl);
    setSelectedIntegrationIds(buyer.integrationIds);
    setBlockedPublisherIds(buyer.blockedPublisherIds);
    setSelectedPlDnplIds(buyer.plDnplListIds);
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
          status: string;
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
        setActiveIntegrationIds(
          new Set(records.filter((record) => record.status === "Active").map((record) => record.id))
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
            };
          })
        );
      } finally {
        setIsLoadingPublishers(false);
      }
    };

    void fetchPublishers();
  }, []);

  useEffect(() => {
    const fetchPresentLists = async () => {
      setIsLoadingPresentLists(true);
      try {
        const response = await fetch("/api/present-lists?pageSize=1000");
        if (!response.ok) return;

        const payload = (await response.json()) as { items: PresentListRecord[] };
        setPresentLists(payload.items);
      } finally {
        setIsLoadingPresentLists(false);
      }
    };

    void fetchPresentLists();
  }, []);

  const integrationSelectOptions = useMemo((): SearchableMultiSelectOption[] => {
    return integrationOptions
      .filter(
        (option) =>
          activeIntegrationIds.has(option.id) || selectedIntegrationIds.includes(option.id)
      )
      .map((option) => ({
        id: option.id,
        displayId: option.displayId,
        label: option.name,
      }));
  }, [activeIntegrationIds, integrationOptions, selectedIntegrationIds]);

  const renderDetailRow = (labelText: string, control: ReactNode, showLinkIcon = false) => (
    <div className="grid gap-2 py-2 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-center sm:gap-6">
      <FieldLabelWithHelp htmlFor={`buyer-${labelText.toLowerCase().replace(/\s+/g, "-")}`} label={`${labelText}:`} showLinkIcon={showLinkIcon} />
      <div className="min-w-0">{control}</div>
    </div>
  );

  const handleGenerateApi = () => {
    const nextApiKey = generateBuyerApiKey();
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const urls = origin ? buildBuyerLeadApiUrls(origin) : null;
    setApiKey(nextApiKey);
    setPostLeadUrl(urls?.postUrl || postLeadUrl);
    if (saveError) setSaveError("");
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setSaveError("Name cannot be blank.");
      return;
    }

    const payload: BuyerUpdatePayload = {
      name: name.trim(),
      email: email.trim(),
      status,
      apiKey: apiKey.trim(),
      postLeadUrl: postLeadUrl.trim(),
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

  const handleSavePlDnpl = async () => {
    if (copyPlDnplToOtherBuyers && copyPlDnplBuyerIds.length === 0) {
      toast.error("Please select at least one buyer.", "Copy PL/DNPL");
      return;
    }

    setIsSavingPlDnpl(true);

    try {
      const response = await fetch(`/api/buyers/${encodeURIComponent(buyer.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plDnplListIds: selectedPlDnplIds,
          copyPlDnplToOtherBuyers,
        }),
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { message?: string } | null;
        toast.error(result?.message ?? "Failed to save PL/DNPL settings.");
        return;
      }

      if (copyPlDnplToOtherBuyers && copyPlDnplBuyerIds.length > 0) {
        const copyResponse = await fetch(`/api/buyers/${encodeURIComponent(buyer.id)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "copy-pl-dnpl",
            targetBuyerIds: copyPlDnplBuyerIds,
            plDnplListIds: selectedPlDnplIds,
          }),
        });

        const copyData = (await copyResponse.json().catch(() => null)) as {
          message?: string;
          updatedCount?: number;
        } | null;

        if (!copyResponse.ok) {
          toast.error(copyData?.message ?? "Failed to copy PL/DNPL settings.", "Copy PL/DNPL");
          return;
        }

        toast.success(
          copyData?.message ??
            `PL/DNPL settings saved and copied to ${copyData?.updatedCount ?? copyPlDnplBuyerIds.length} buyer(s).`
        );
        setCopyPlDnplToOtherBuyers(false);
        setCopyPlDnplBuyerIds([]);
      } else {
        toast.success("PL/DNPL settings saved successfully.");
      }

      router.refresh();
    } catch {
      toast.error("Failed to save PL/DNPL settings.");
    } finally {
      setIsSavingPlDnpl(false);
    }
  };

  const handleDuplicate = async () => {
    setIsDuplicating(true);
    setSaveError("");

    try {
      const response = await fetch(`/api/buyers/${encodeURIComponent(buyer.id)}/duplicate`, {
        method: "POST",
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { message?: string } | null;
        toast.error(result?.message ?? "Failed to duplicate buyer.");
        return;
      }

      const duplicated = (await response.json()) as BuyerListRecord;
      toast.success(`Buyer duplicated as "${duplicated.name}".`);
      router.push(`/buyers/${encodeURIComponent(duplicated.id)}`);
      router.refresh();
    } catch {
      toast.error("Failed to duplicate buyer.");
    } finally {
      setIsDuplicating(false);
    }
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
      <div className="flex justify-end gap-2 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
        <button
          type="button"
          disabled={isDuplicating || isDeleting}
          onClick={() => void handleDuplicate()}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          {isDuplicating ? "Duplicating..." : "Duplicate"}
        </button>
        <button
          type="button"
          disabled={isDeleting || isDuplicating}
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
            <DropdownSelect
              id="buyer-status"
              value={status}
              options={BUYER_STATUS_DETAIL_OPTIONS.map((option) => ({
                value: option,
                label: option,
              }))}
              onChange={(nextStatus) => setStatus(nextStatus as BuyerStatus)}
              className={selectClassName}
            />
          )}
          {testMode
            ? renderDetailRow(
                "Lead API",
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Used while Test Mode is on. Use Ping URL for Ping Post phase and Post URL for the
                      final post. Send <code className="text-[11px]">x-api-key</code> in the integration
                      request mapping header.
                    </p>
                    <SecondaryButton type="button" onClick={handleGenerateApi}>
                      Generate API
                    </SecondaryButton>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">API Key</p>
                      {apiKey ? (
                        <CopyableValue value={apiKey} copyLabel="Copy API key" />
                      ) : (
                        <Input id="buyer-api-key" value="" readOnly placeholder="Not generated yet" />
                      )}
                    </div>
                    {(() => {
                      const origin = typeof window !== "undefined" ? window.location.origin : "";
                      const urls = origin ? buildBuyerLeadApiUrls(origin) : null;
                      const pingUrl = urls?.pingUrl ?? "";
                      const postUrl = postLeadUrl || urls?.postUrl || "";
                      return (
                        <>
                          <div>
                            <p className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                              Ping URL
                            </p>
                            <p className="mb-1 text-[11px] text-slate-500 dark:text-slate-400">
                              <code className="text-[11px]">/api/lists/addlead/ping</code> — mock Ping
                              response
                            </p>
                            {pingUrl ? (
                              <CopyableValue value={pingUrl} copyLabel="Copy Ping URL" />
                            ) : (
                              <Input id="buyer-ping-lead-url" value="" readOnly placeholder="Generate API first" />
                            )}
                          </div>
                          <div>
                            <p className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                              Post URL
                            </p>
                            <p className="mb-1 text-[11px] text-slate-500 dark:text-slate-400">
                              <code className="text-[11px]">/api/lists/addlead/post</code> — mock Post
                              response
                            </p>
                            {postUrl ? (
                              <CopyableValue value={postUrl} copyLabel="Copy Post URL" />
                            ) : (
                              <Input
                                id="buyer-post-lead-url"
                                value=""
                                readOnly
                                placeholder="Generated automatically"
                              />
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )
            : null}
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
            <SearchableMultiSelect
              id="buyer-available-integrations"
              selectedIds={selectedIntegrationIds}
              onChange={setSelectedIntegrationIds}
              options={integrationSelectOptions}
              labelOptions={integrationSelectOptions}
              isLoading={isLoadingIntegrations}
              placeholder="Select integrations..."
              searchPlaceholder="Search integrations..."
              emptyMessage="No integrations available."
            />
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
    <div className="overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="px-6 py-8">
        <div className="mx-auto w-full max-w-4xl space-y-1">
          <p className="pb-4 text-sm text-slate-500 dark:text-slate-400">
            Publishers not selected below are allowed to post leads to this buyer.
          </p>

          {renderDetailRow(
            "Block Publishers",
            <SearchableMultiSelect
              id="buyer-block-publishers"
              selectedIds={blockedPublisherIds}
              onChange={setBlockedPublisherIds}
              options={publisherOptions}
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

  const renderPlDnplTab = () => (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="px-6 py-8">
        <div className="mx-auto w-full max-w-3xl space-y-6">
          {isLoadingPresentLists ? (
            <p className="text-sm text-slate-500">Loading present lists...</p>
          ) : (
            <BuyerPlDnplSettings
              buyerId={buyer.id}
              presentLists={presentLists}
              selectedIds={selectedPlDnplIds}
              copyToOtherBuyers={copyPlDnplToOtherBuyers}
              copyBuyerIds={copyPlDnplBuyerIds}
              onSelectedIdsChange={setSelectedPlDnplIds}
              onCopyToOtherBuyersChange={setCopyPlDnplToOtherBuyers}
              onCopyBuyerIdsChange={setCopyPlDnplBuyerIds}
            />
          )}

          <div className="flex justify-end">
            <PrimaryButton
              type="button"
              disabled={isSavingPlDnpl || isLoadingPresentLists}
              onClick={() => void handleSavePlDnpl()}
              className="bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              {isSavingPlDnpl ? "Saving..." : "Save"}
            </PrimaryButton>
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

        <PageTabBar tabs={buyerTabs} activeTabId={activeTab.id} onTabChange={handleTabChange} />

        {activeTab.id === "global"
          ? renderGlobalTab()
          : activeTab.id === "integrations"
            ? renderIntegrationsTab()
            : activeTab.id === "sources"
              ? renderSourcesTab()
              : activeTab.id === "pl-dnpl"
                ? renderPlDnplTab()
                : renderPlaceholderTab()}
      </section>
    </div>
  );
}
