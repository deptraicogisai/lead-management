"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import { CancelButton, DangerButton } from "@/components/ui/action-buttons";
import { PrimaryButton } from "@/components/ui/form-controls";
import { Modal } from "@/components/ui/modal";
import { SectionLoading } from "@/components/ui/loading-indicator";
import { PageSection } from "@/components/ui/state";
import type { DataCleanupTargetDefinition } from "@/lib/data-cleanup";
import { toast } from "@/lib/toast";

type CleanupItem = DataCleanupTargetDefinition & {
  count: number;
};

type CleanupResponse = {
  items: CleanupItem[];
};

type ClearResponse = {
  message?: string;
  results: Array<{ key: string; label: string; clearedCount: number }>;
  items: CleanupItem[];
};

const CATEGORY_ORDER = ["Operational Data", "Configuration"] as const;

export function DataCleanupSettingsPage() {
  const [items, setItems] = useState<CleanupItem[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const loadItems = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/settings/data-cleanup");
      if (!response.ok) {
        throw new Error("Failed to load settings.");
      }

      const data = (await response.json()) as CleanupResponse;
      setItems(data.items);
    } catch {
      toast.error("Failed to load data cleanup settings.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const groupedItems = useMemo(() => {
    return CATEGORY_ORDER.map((category) => ({
      category,
      items: items.filter((item) => item.category === category),
    })).filter((group) => group.items.length > 0);
  }, [items]);

  const selectableKeys = useMemo(
    () => items.filter((item) => item.count > 0).map((item) => item.key),
    [items]
  );

  const selectedCount = selectedKeys.length;
  const selectedWithData = selectedKeys.filter((key) => items.some((item) => item.key === key && item.count > 0));

  const toggleItem = (key: string) => {
    setSelectedKeys((current) => (current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]));
  };

  const toggleCategory = (category: (typeof CATEGORY_ORDER)[number], checked: boolean) => {
    const categoryKeys = items.filter((item) => item.category === category && item.count > 0).map((item) => item.key);

    setSelectedKeys((current) => {
      if (!checked) {
        return current.filter((key) => !categoryKeys.includes(key));
      }

      return [...new Set([...current, ...categoryKeys])];
    });
  };

  const handleSelectAll = () => {
    setSelectedKeys(selectableKeys);
  };

  const handleClearSelection = () => {
    setSelectedKeys([]);
  };

  const handleOpenConfirm = () => {
    if (selectedWithData.length === 0) {
      toast.error("Select at least one list that still has records.");
      return;
    }

    setConfirmOpen(true);
  };

  const handleClearSelected = async () => {
    if (selectedWithData.length === 0) {
      return;
    }

    setIsClearing(true);

    try {
      const response = await fetch("/api/settings/data-cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets: selectedWithData }),
      });

      const result = (await response.json().catch(() => null)) as ClearResponse | { message?: string } | null;

      if (!response.ok) {
        toast.error(result && "message" in result ? result.message ?? "Failed to clear selected lists." : "Failed to clear selected lists.");
        return;
      }

      const payload = result as ClearResponse;
      const totalCleared = payload.results.reduce((sum, entry) => sum + entry.clearedCount, 0);

      setItems(payload.items);
      setSelectedKeys([]);
      setConfirmOpen(false);
      toast.success(
        totalCleared > 0
          ? `Cleared ${totalCleared} record(s) across ${payload.results.length} list(s).`
          : "Selected lists are already empty."
      );
    } catch {
      toast.error("Failed to clear selected lists.");
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageSection title="List Cleanup">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Select the lists you want to clean up. All selected records are permanently deleted and cannot be recovered.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <PrimaryButton type="button" onClick={handleSelectAll} disabled={isLoading || selectableKeys.length === 0}>
            Select All With Data
          </PrimaryButton>
          <CancelButton type="button" onClick={handleClearSelection} disabled={isLoading || selectedCount === 0}>
            Clear Selection
          </CancelButton>
          <DangerButton
            type="button"
            onClick={handleOpenConfirm}
            disabled={isLoading || isClearing || selectedWithData.length === 0}
          >
            <Trash2 size={16} />
            Clear Selected Lists
          </DangerButton>
        </div>

        <div className="mt-6 space-y-6">
          {isLoading ? (
            <SectionLoading message="Loading list counts..." />
          ) : (
            groupedItems.map((group) => {
              const categoryKeys = group.items.filter((item) => item.count > 0).map((item) => item.key);
              const selectedInCategory = categoryKeys.filter((key) => selectedKeys.includes(key));
              const allCategorySelected =
                categoryKeys.length > 0 && selectedInCategory.length === categoryKeys.length;

              return (
                <div
                  key={group.category}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/70"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                      {group.category}
                    </h4>
                    <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={allCategorySelected}
                        disabled={categoryKeys.length === 0}
                        onChange={(event) => toggleCategory(group.category, event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      Select category
                    </label>
                  </div>

                  <div className="space-y-3">
                    {group.items.map((item) => (
                      <label
                        key={item.key}
                        className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
                      >
                        <input
                          type="checkbox"
                          checked={selectedKeys.includes(item.key)}
                          disabled={item.count === 0}
                          onChange={() => toggleItem(item.key)}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.label}</span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {item.count} record{item.count === 1 ? "" : "s"}
                            </span>
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-500/15 dark:text-red-300">
                              Permanent delete
                            </span>
                          </span>
                          <span className="mt-1 block text-sm text-slate-600 dark:text-slate-300">{item.description}</span>
                          <Link
                            href={item.listHref}
                            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
                          >
                            Open list
                            <ExternalLink size={12} />
                          </Link>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </PageSection>

      <Modal
        open={confirmOpen}
        title="Clear Selected Lists"
        description="All selected records will be permanently deleted. This action cannot be undone."
        onClose={() => {
          if (!isClearing) setConfirmOpen(false);
        }}
        panelClassName="max-w-lg"
        actions={
          <>
            <CancelButton type="button" onClick={() => setConfirmOpen(false)} disabled={isClearing}>
              Cancel
            </CancelButton>
            <DangerButton type="button" onClick={() => void handleClearSelected()} disabled={isClearing}>
              {isClearing ? "Clearing..." : "Confirm Clear"}
            </DangerButton>
          </>
        }
      >
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-300">
          {selectedWithData.map((key) => {
            const item = items.find((entry) => entry.key === key);
            if (!item) return null;

            return (
              <li key={key}>
                {item.label} ({item.count} record{item.count === 1 ? "" : "s"})
              </li>
            );
          })}
        </ul>
      </Modal>
    </div>
  );
}
