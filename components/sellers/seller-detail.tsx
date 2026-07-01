"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useBreadcrumbLabel } from "@/components/layout/breadcrumb-context";
import { Contact, CreditCard, Download, Info, Network, Pencil, Settings2, Share2, X } from "lucide-react";
import { FormError, Input, PrimaryButton } from "@/components/ui/form-controls";
import { IdBadge } from "@/components/ui/id-badge";
import { PublisherTagBadges } from "@/components/ui/publisher-tag-badges";
import { StatusBadge } from "@/components/ui/status-badge";
import { TagSuggestInput } from "@/components/ui/tag-suggest-input";
import { SellerContactsTab } from "@/components/sellers/seller-contacts-tab";
import { SellerPingTreeTab } from "@/components/sellers/seller-ping-tree-tab";
import { SellerTrafficSourcesTab } from "@/components/sellers/seller-traffic-sources-tab";
import { downloadCsv } from "@/lib/csv-export";
import { normalizePublisherTag } from "@/lib/publisher-tag";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const EDIT_FIELD_WIDTH = "max-w-[320px]";

const sellerTabs = [
  { id: "main", label: "Main", icon: Settings2 },
  { id: "contacts", label: "Contacts", icon: Contact },
  { id: "payment", label: "Payment", icon: CreditCard },
  { id: "traffic-sources", label: "Traffic Sources", icon: Share2 },
  { id: "ping-tree", label: "PingTree", icon: Network },
] as const;

type SellerTabId = (typeof sellerTabs)[number]["id"];

const SELLER_STATUS_OPTIONS: SellerDetailRecord["status"][] = ["Active", "Inactive", "Deleted"];

const selectClassName =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25";

function resolveSellerTabId(tab: string | null): SellerTabId {
  if (sellerTabs.some((item) => item.id === tab)) {
    return tab as SellerTabId;
  }
  return "main";
}

export type SellerDetailRecord = {
  id: string;
  displayId: number | null;
  name: string;
  email: string;
  region: string;
  publisherTag: string;
  status: "Active" | "Inactive" | "Deleted";
};

type SellerDetailProps = {
  seller: SellerDetailRecord;
};

type EditFormState = {
  name: string;
  email: string;
  publisherTag: string;
  status: SellerDetailRecord["status"];
};

type EditErrors = {
  name?: string;
  email?: string;
};

export function SellerDetail({ seller }: SellerDetailProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTabId = resolveSellerTabId(searchParams.get("tab"));

  const activeTab = sellerTabs.find((tab) => tab.id === activeTabId) ?? sellerTabs[0];

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<EditFormState>({
    name: seller.name,
    email: seller.email,
    publisherTag: seller.publisherTag,
    status: seller.status,
  });
  const [errors, setErrors] = useState<EditErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);

  useBreadcrumbLabel(`[${seller.displayId ?? "-"}] ${seller.name}`);

  useEffect(() => {
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

    void loadTagSuggestions();
  }, []);

  const handleTabChange = (tabId: SellerTabId) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tabId === "main") {
      params.delete("tab");
    } else {
      params.set("tab", tabId);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const handleExportCsv = () => {
    const headers = ["ID", "Name", "Email", "Publisher Tag", "Status"];
    const rows = [
      [
        String(seller.displayId ?? ""),
        seller.name,
        seller.email,
        seller.publisherTag,
        seller.status,
      ],
    ];
    downloadCsv(`publisher-${seller.displayId ?? seller.id}.csv`, headers, rows);
  };

  const startEditing = () => {
    setForm({
      name: seller.name,
      email: seller.email,
      publisherTag: seller.publisherTag,
      status: seller.status,
    });
    setErrors({});
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setErrors({});
  };

  const updateForm = <K extends keyof EditFormState>(key: K, value: EditFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === "name" || key === "email") {
      const fieldKey = key as keyof EditErrors;
      setErrors((current) => {
        if (!current[fieldKey]) return current;
        const next = { ...current };
        delete next[fieldKey];
        return next;
      });
    }
  };

  const handleSave = async () => {
    const nextErrors: EditErrors = {};
    if (!form.name.trim()) nextErrors.name = "Name is required.";
    if (!form.email.includes("@")) nextErrors.email = "A valid email is required.";

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});

    setIsSaving(true);
    try {
      const response = await fetch(`/api/sellers/${encodeURIComponent(seller.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          publisherTag: normalizePublisherTag(form.publisherTag),
          status: form.status,
          region: seller.region,
        }),
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { message?: string } | null;
        toast.error(result?.message ?? "Failed to update publisher.");
        return;
      }

      toast.success("Publisher updated successfully.");
      setIsEditing(false);
      router.refresh();
    } catch {
      toast.error("Failed to update publisher.");
    } finally {
      setIsSaving(false);
    }
  };

  const renderRow = (labelText: string, value: ReactNode, required = false) => (
    <div className="grid grid-cols-1 gap-1 border-b border-slate-100 px-4 py-3 last:border-b-0 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center sm:gap-6 dark:border-slate-800">
      <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
        {labelText}
        {required && isEditing ? <span className="text-red-600 dark:text-red-400"> *</span> : null}
      </span>
      <div className="min-w-0 text-sm text-slate-800 dark:text-slate-100">{value}</div>
    </div>
  );

  const renderMainTab = () => (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap justify-end gap-2 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
        {isEditing ? (
          <>
            <button
              type="button"
              onClick={cancelEditing}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              <X size={16} />
              Cancel
            </button>
            <PrimaryButton
              type="button"
              icon={false}
              disabled={isSaving}
              onClick={() => void handleSave()}
              className="bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              {isSaving ? "Saving..." : "Save"}
            </PrimaryButton>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={startEditing}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-700 bg-transparent px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
            >
              <Pencil size={16} />
              Edit
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-700 bg-emerald-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              <Download size={16} />
              Export to CSV
            </button>
          </>
        )}
      </div>

      <div className="px-6 py-6">
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
          {renderRow("ID", <IdBadge id={seller.displayId ?? "-"} />)}

          {renderRow(
            "Name",
            isEditing ? (
              <div className={EDIT_FIELD_WIDTH}>
                <FormError error={errors.name} />
                <Input
                  value={form.name}
                  invalid={Boolean(errors.name)}
                  onChange={(event) => updateForm("name", event.target.value)}
                  placeholder="Publisher name"
                />
              </div>
            ) : (
              <span className="font-medium">{seller.name || "—"}</span>
            ),
            true
          )}

          {renderRow(
            "Email",
            isEditing ? (
              <div className={EDIT_FIELD_WIDTH}>
                <FormError error={errors.email} />
                <Input
                  type="email"
                  value={form.email}
                  invalid={Boolean(errors.email)}
                  onChange={(event) => updateForm("email", event.target.value)}
                  placeholder="name@example.com"
                />
              </div>
            ) : (
              seller.email || "—"
            ),
            true
          )}

          {renderRow(
            "Publisher Tag",
            isEditing ? (
              <div className={EDIT_FIELD_WIDTH}>
                <TagSuggestInput
                  value={form.publisherTag}
                  onChange={(publisherTag) => updateForm("publisherTag", publisherTag)}
                  suggestions={tagSuggestions}
                  placeholder="Internal, Premium"
                />
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  Type at least 2 characters to see previously used tags, or enter a new tag.
                </p>
              </div>
            ) : (
              <PublisherTagBadges tag={seller.publisherTag} />
            )
          )}

          {renderRow(
            "Status",
            isEditing ? (
              <select
                value={form.status}
                onChange={(event) => updateForm("status", event.target.value as SellerDetailRecord["status"])}
                className={cn(selectClassName, EDIT_FIELD_WIDTH)}
              >
                {SELLER_STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <StatusBadge status={seller.status} />
            )
          )}
        </div>
      </div>
    </div>
  );

  const renderPlaceholderTab = () => (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">
          <activeTab.icon size={20} />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{activeTab.label}</h3>
          <p className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            This section is ready for the detailed {activeTab.label.toLowerCase()} configuration you want to add next.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 dark:border-slate-600 dark:bg-slate-800/40">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
          <Info size={16} />
          <h4 className="text-sm font-semibold">Coming Soon</h4>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          The {activeTab.label} tab is part of the publisher detail layout and will be wired up next.
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <section className="space-y-5">
        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          <span className="font-medium text-slate-700 dark:text-slate-200">Active Users:</span>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500 text-sm font-semibold text-white">
            {(seller.name.trim()[0] ?? "P").toUpperCase()}
          </span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/70">
          <div className="flex min-w-max items-center gap-2">
            {sellerTabs.map((tab) => {
              const isActive = tab.id === activeTab.id;
              const Icon = tab.icon;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
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

        {activeTab.id === "main"
          ? renderMainTab()
          : activeTab.id === "contacts"
            ? <SellerContactsTab sellerId={seller.id} />
            : activeTab.id === "traffic-sources"
              ? <SellerTrafficSourcesTab sellerId={seller.id} />
              : activeTab.id === "ping-tree"
                ? <SellerPingTreeTab sellerId={seller.id} />
                : renderPlaceholderTab()}
      </section>
    </div>
  );
}
