"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import {
  AddNewButton,
  ExportButton,
  TableActionButton,
} from "@/components/ui/action-buttons";
import {
  CancelButton,
  Checkbox,
  FieldLabel,
  Input,
  PrimaryButton,
  Select,
} from "@/components/ui/form-controls";
import { FormError } from "@/components/ui/form-controls";
import { IdBadge } from "@/components/ui/id-badge";
import {
  PublisherDistributionUsageAlert,
} from "@/components/ping-trees/publisher-distribution-usage-alert";
import { ListTableContainer } from "@/components/ui/list-table-container";
import { Modal } from "@/components/ui/modal";
import { ScrollableTableShell } from "@/components/ui/scrollable-table-shell";
import { PageSection } from "@/components/ui/state";
import { PageTabBar } from "@/components/ui/page-tab-bar";
import {
  SEARCH_FILTER_CONTROL_CLASS,
  SearchFilterActions,
  SearchFilterField,
  SearchFilterGrid,
  SearchFilterPanel,
  SearchFilterSelect,
} from "@/components/ui/search-filter-layout";
import { StatusBadge } from "@/components/ui/status-badge";
import { downloadCsv } from "@/lib/csv-export";
import {
  buildPingTreePercentMap,
  formatPingTreePercentLabel,
  PING_TREE_POSTING_TYPES,
  PING_TREE_PROCESSING_TYPES,
  type PingTreeConfigRecord,
  type PingTreeProcessingType,
} from "@/lib/ping-tree-config";
import { toast } from "@/lib/toast";
import { useListLoadState } from "@/lib/use-list-load-state";
import { cn } from "@/lib/utils";
import type { PublisherDistributionTreeUsage } from "@/lib/publisher-distribution";

type ProductOption = {
  verticalId: string;
  verticalName: string;
  productLabel: string;
};

type DraftFilters = {
  id: string;
  name: string;
  comment: string;
  postingType: string;
  product: string;
  showDeleted: boolean;
};

const emptyFilters: DraftFilters = {
  id: "",
  name: "",
  comment: "",
  postingType: "All",
  product: "All",
  showDeleted: false,
};

const EXPORT_HEADERS = ["ID", "Ping Tree Name", "Comment", "Product", "Status", "Global settings"];

/** The drag-drop editor is organised by campaign type; map each processing tab onto it. */
const PROCESSING_TO_CAMPAIGN_TYPE: Record<PingTreeProcessingType, "Redirect" | "Silent"> = {
  "Main processing": "Redirect",
  "Exit Page": "Redirect",
  "Exit Offer List": "Redirect",
  Silent: "Silent",
};

type FormState = {
  name: string;
  comment: string;
  verticalId: string;
};

const emptyForm: FormState = { name: "", comment: "", verticalId: "" };

export function PingTreeConfigPage() {
  const [activeTab, setActiveTab] = useState<PingTreeProcessingType>("Main processing");
  const [records, setRecords] = useState<PingTreeConfigRecord[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const { isInitialLoad, isRefreshing, beginLoad, endLoad } = useListLoadState();

  const [draftFilters, setDraftFilters] = useState<DraftFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<DraftFilters>(emptyFilters);
  const [quickFilter, setQuickFilter] = useState("");

  // Create / Edit / Rename modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<FormState>(emptyForm);
  const [editTarget, setEditTarget] = useState<PingTreeConfigRecord | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [renameTarget, setRenameTarget] = useState<PingTreeConfigRecord | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<PingTreeConfigRecord | null>(null);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Config percentage modal
  const [configProductId, setConfigProductId] = useState<string | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, number>>({});
  const [configError, setConfigError] = useState("");
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [deletePublisherUsages, setDeletePublisherUsages] = useState<PublisherDistributionTreeUsage[]>([]);
  const [isDeleteUsageLoading, setIsDeleteUsageLoading] = useState(false);

  const loadRecords = useCallback(
    async (processingType: PingTreeProcessingType, includeDeleted: boolean) => {
      beginLoad();
      try {
        const params = new URLSearchParams({
          processingType,
          includeDeleted: includeDeleted ? "true" : "false",
        });
        const response = await fetch(`/api/ping-tree-configs?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as PingTreeConfigRecord[];
        setRecords(data);
      } finally {
        endLoad();
      }
    },
    [beginLoad, endLoad]
  );

  useEffect(() => {
    void loadRecords(activeTab, appliedFilters.showDeleted);
  }, [loadRecords, activeTab, appliedFilters.showDeleted]);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/ping-tree-configs/products");
      if (!response.ok) return;
      setProducts((await response.json()) as ProductOption[]);
    })();
  }, []);

  const handleTabChange = (tab: PingTreeProcessingType) => {
    setActiveTab(tab);
    setDraftFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setQuickFilter("");
  };

  const handleSearch = () => {
    setAppliedFilters({ ...draftFilters });
    void loadRecords(activeTab, draftFilters.showDeleted);
  };

  const handleClear = () => {
    setDraftFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setQuickFilter("");
  };

  const filteredRecords = useMemo(() => {
    const idQuery = appliedFilters.id.trim().toLowerCase();
    const nameQuery = appliedFilters.name.trim().toLowerCase();
    const commentQuery = appliedFilters.comment.trim().toLowerCase();
    const quick = quickFilter.trim().toLowerCase();

    return records.filter((record) => {
      const matchesId = idQuery ? String(record.displayId ?? "").toLowerCase().includes(idQuery) : true;
      const matchesName = nameQuery ? record.name.toLowerCase().includes(nameQuery) : true;
      const matchesComment = commentQuery ? record.comment.toLowerCase().includes(commentQuery) : true;
      const matchesPosting =
        appliedFilters.postingType === "All" ? true : record.postingType === appliedFilters.postingType;
      const matchesProduct =
        appliedFilters.product === "All" ? true : record.verticalId === appliedFilters.product;
      const matchesQuick = quick
        ? [String(record.displayId ?? ""), record.name, record.comment, record.productLabel, record.status]
            .join(" ")
            .toLowerCase()
            .includes(quick)
        : true;

      return matchesId && matchesName && matchesComment && matchesPosting && matchesProduct && matchesQuick;
    });
  }, [records, appliedFilters, quickFilter]);

  // Group filtered records by product, keeping product order from the products list.
  const groups = useMemo(() => {
    const byProduct = new Map<string, { label: string; rows: PingTreeConfigRecord[] }>();
    for (const record of filteredRecords) {
      const key = record.verticalId;
      if (!byProduct.has(key)) {
        byProduct.set(key, { label: record.productLabel, rows: [] });
      }
      byProduct.get(key)!.rows.push(record);
    }
    return Array.from(byProduct.entries()).map(([verticalId, value]) => ({
      verticalId,
      label: value.label,
      rows: value.rows,
    }));
  }, [filteredRecords]);

  const reload = () => void loadRecords(activeTab, appliedFilters.showDeleted);

  // ----- Create -----
  const openCreate = () => {
    setCreateForm({ ...emptyForm, verticalId: products[0]?.verticalId ?? "" });
    setFormError("");
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    if (!createForm.name.trim()) {
      setFormError("Name is required.");
      return;
    }
    if (!createForm.verticalId) {
      setFormError("Product is required.");
      return;
    }
    setIsSubmitting(true);
    setFormError("");
    try {
      const response = await fetch("/api/ping-tree-configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name.trim(),
          comment: createForm.comment.trim(),
          processingType: activeTab,
          verticalId: createForm.verticalId,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setFormError(payload?.message ?? "Failed to create ping tree.");
        return;
      }
      toast.success("Ping tree created.", "Ping Tree");
      setCreateOpen(false);
      reload();
    } catch {
      setFormError("Failed to create ping tree.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ----- Edit -----
  const openEdit = (record: PingTreeConfigRecord) => {
    setEditTarget(record);
    setEditForm({ name: record.name, comment: record.comment, verticalId: record.verticalId });
    setFormError("");
  };

  const submitEdit = async () => {
    if (!editTarget) return;
    if (!editForm.name.trim()) {
      setFormError("Name is required.");
      return;
    }
    setIsSubmitting(true);
    setFormError("");
    try {
      const response = await fetch(`/api/ping-tree-configs/${encodeURIComponent(editTarget.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          comment: editForm.comment.trim(),
          verticalId: editForm.verticalId,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setFormError(payload?.message ?? "Failed to update ping tree.");
        return;
      }
      toast.success("Ping tree updated.", "Ping Tree");
      setEditTarget(null);
      reload();
    } catch {
      setFormError("Failed to update ping tree.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ----- Rename -----
  const openRename = (record: PingTreeConfigRecord) => {
    setRenameTarget(record);
    setRenameValue(record.name);
    setFormError("");
  };

  const submitRename = async () => {
    if (!renameTarget) return;
    if (!renameValue.trim()) {
      setFormError("Name is required.");
      return;
    }
    setIsSubmitting(true);
    setFormError("");
    try {
      const response = await fetch(`/api/ping-tree-configs/${encodeURIComponent(renameTarget.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        setFormError(payload?.message ?? "Failed to rename ping tree.");
        return;
      }
      toast.success("Ping tree renamed.", "Ping Tree");
      setRenameTarget(null);
      reload();
    } catch {
      setFormError("Failed to rename ping tree.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ----- Duplicate -----
  const handleDuplicate = async (record: PingTreeConfigRecord) => {
    try {
      const response = await fetch(
        `/api/ping-tree-configs/duplicate/${encodeURIComponent(record.id)}`,
        { method: "POST" }
      );
      if (!response.ok) {
        toast.error("Failed to duplicate ping tree.", "Ping Tree");
        return;
      }
      toast.success("Ping tree duplicated.", "Ping Tree");
      reload();
    } catch {
      toast.error("Failed to duplicate ping tree.", "Ping Tree");
    }
  };

  // ----- Delete / Restore -----
  const submitDelete = async () => {
    if (!deleteTarget || deleteBlockedByPublisher) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/ping-tree-configs/${encodeURIComponent(deleteTarget.id)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        toast.error(payload?.message ?? "Failed to delete ping tree.", "Ping Tree");
        return;
      }
      toast.success("Ping tree deleted.", "Ping Tree");
      setDeleteTarget(null);
      reload();
    } catch {
      toast.error("Failed to delete ping tree.", "Ping Tree");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestore = async (record: PingTreeConfigRecord) => {
    try {
      const response = await fetch(`/api/ping-tree-configs/${encodeURIComponent(record.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Active" }),
      });
      if (!response.ok) {
        toast.error("Failed to restore ping tree.", "Ping Tree");
        return;
      }
      toast.success("Ping tree restored.", "Ping Tree");
      reload();
    } catch {
      toast.error("Failed to restore ping tree.", "Ping Tree");
    }
  };

  // ----- Config percentage -----
  const configRows = useMemo(
    () =>
      configProductId
        ? records.filter(
            (record) =>
              record.verticalId === configProductId &&
              record.processingType === activeTab &&
              record.status !== "Deleted"
          )
        : [],
    [activeTab, configProductId, records]
  );

  useEffect(() => {
    if (!deleteTarget) {
      setDeletePublisherUsages([]);
      setIsDeleteUsageLoading(false);
      return;
    }
    let cancelled = false;
    setIsDeleteUsageLoading(true);
    void (async () => {
      try {
        const params = new URLSearchParams({ configIds: deleteTarget.id });
        const response = await fetch(`/api/ping-tree-configs/publisher-usage?${params.toString()}`);
        if (!response.ok) return;
        const data = (await response.json()) as Record<string, PublisherDistributionTreeUsage[]>;
        if (!cancelled) setDeletePublisherUsages(data[deleteTarget.id] ?? []);
      } catch {
        if (!cancelled) setDeletePublisherUsages([]);
      } finally {
        if (!cancelled) setIsDeleteUsageLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deleteTarget]);

  const deleteBlockedByPublisher = deletePublisherUsages.length > 0;

  const openConfig = (verticalId: string) => {
    const rows = records.filter(
      (record) =>
        record.verticalId === verticalId &&
        record.processingType === activeTab &&
        record.status !== "Deleted"
    );
    const existing = Object.fromEntries(rows.map((row) => [row.id, row.percent]));
    setConfigValues(buildPingTreePercentMap(rows.map((row) => row.id), existing));
    setConfigError("");
    setConfigProductId(verticalId);
  };

  const configTotal = useMemo(
    () => Object.values(configValues).reduce((sum, value) => sum + (Number(value) || 0), 0),
    [configValues]
  );

  const setConfigValue = (treeId: string, value: number) => {
    setConfigValues((current) => ({ ...current, [treeId]: value }));
  };

  const setRowTo100 = (treeId: string) => {
    setConfigValues((current) => {
      const next: Record<string, number> = {};
      for (const key of Object.keys(current)) {
        next[key] = key === treeId ? 100 : 0;
      }
      return next;
    });
  };

  const submitConfig = async () => {
    if (configTotal > 100) {
      setConfigError(`Total percent is ${configTotal}%. It must not exceed 100%.`);
      return;
    }
    if (configTotal !== 100) {
      setConfigError(`Total percent must equal 100%. Current total is ${configTotal}%.`);
      return;
    }
    setIsSavingConfig(true);
    setConfigError("");
    try {
      const response = await fetch("/api/ping-tree-configs/config-percent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ percentages: configValues }),
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setConfigError(payload?.message ?? "Failed to update percentages.");
        return;
      }
      toast.success("Percentages updated.", "Ping Tree");
      setConfigProductId(null);
      reload();
    } catch {
      setConfigError("Failed to update percentages.");
    } finally {
      setIsSavingConfig(false);
    }
  };

  // ----- Export -----
  const handleExport = () => {
    if (filteredRecords.length === 0) {
      toast.error("No ping trees to export.", "Export");
      return;
    }
    downloadCsv(
      `ping-trees-${activeTab.toLowerCase().replace(/\s+/g, "-")}.csv`,
      EXPORT_HEADERS,
      filteredRecords.map((record) => [
        String(record.displayId ?? ""),
        record.name,
        record.comment,
        record.productLabel,
        record.status,
        formatPingTreePercentLabel(record.percent),
      ])
    );
  };

  const configProductLabel = products.find((product) => product.verticalId === configProductId)?.productLabel
    ?? records.find((record) => record.verticalId === configProductId)?.productLabel
    ?? "";

  return (
    <PageSection>
      <PageTabBar
        className="mb-5"
        tabs={PING_TREE_PROCESSING_TYPES.map((tab) => ({ id: tab, label: tab }))}
        activeTabId={activeTab}
        onTabChange={handleTabChange}
      />

      {/* Filters */}
      <SearchFilterPanel className="mb-5">
        <SearchFilterGrid>
          <SearchFilterField>
            <FieldLabel htmlFor="ptc-id" label="ID" />
            <Input
              id="ptc-id"
              className={SEARCH_FILTER_CONTROL_CLASS}
              value={draftFilters.id}
              onChange={(event) => setDraftFilters((f) => ({ ...f, id: event.target.value }))}
              onKeyDown={(event) => event.key === "Enter" && handleSearch()}
            />
          </SearchFilterField>
          <SearchFilterField>
            <FieldLabel htmlFor="ptc-name" label="Name" />
            <Input
              id="ptc-name"
              className={SEARCH_FILTER_CONTROL_CLASS}
              value={draftFilters.name}
              onChange={(event) => setDraftFilters((f) => ({ ...f, name: event.target.value }))}
              onKeyDown={(event) => event.key === "Enter" && handleSearch()}
            />
          </SearchFilterField>
          <SearchFilterField>
            <FieldLabel htmlFor="ptc-comment" label="Comment" />
            <Input
              id="ptc-comment"
              className={SEARCH_FILTER_CONTROL_CLASS}
              value={draftFilters.comment}
              onChange={(event) => setDraftFilters((f) => ({ ...f, comment: event.target.value }))}
              onKeyDown={(event) => event.key === "Enter" && handleSearch()}
            />
          </SearchFilterField>
          <SearchFilterSelect
            id="ptc-posting"
            label="Posting Type"
            value={draftFilters.postingType}
            onChange={(value) => setDraftFilters((f) => ({ ...f, postingType: value }))}
            options={[
              { value: "All", label: "All" },
              ...PING_TREE_POSTING_TYPES.map((type) => ({ value: type, label: type })),
            ]}
          />
          <SearchFilterSelect
            id="ptc-product"
            label="Product"
            value={draftFilters.product}
            onChange={(value) => setDraftFilters((f) => ({ ...f, product: value }))}
            options={[
              { value: "All", label: "All" },
              ...products.map((product) => ({
                value: product.verticalId,
                label: product.productLabel,
              })),
            ]}
          />
        </SearchFilterGrid>

        <SearchFilterActions onSearch={handleSearch} onClear={handleClear}>
          <Checkbox
            checked={draftFilters.showDeleted}
            onChange={(checked) => setDraftFilters((f) => ({ ...f, showDeleted: checked }))}
            label="Show Deleted"
            className="w-auto shrink-0"
          />
        </SearchFilterActions>
      </SearchFilterPanel>

      {/* Toolbar */}
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Showing {filteredRecords.length} {filteredRecords.length === 1 ? "entry" : "entries"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex w-full min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 sm:w-auto dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <span className="shrink-0">Filter:</span>
            <input
              type="text"
              value={quickFilter}
              onChange={(event) => setQuickFilter(event.target.value)}
              className="min-w-0 flex-1 border-none bg-transparent text-sm outline-none sm:w-36 dark:text-slate-100"
            />
          </div>
          <ExportButton onClick={handleExport}>Export to CSV</ExportButton>
          <AddNewButton type="button" onClick={openCreate}>
            Create New Ping Tree
          </AddNewButton>
        </div>
      </div>

      {/* Grid grouped by product */}
      <ListTableContainer
        isInitialLoad={isInitialLoad}
        isRefreshing={isRefreshing}
        loadingMessage="Loading ping trees..."
      >
        <ScrollableTableShell
          rowCount={groups.reduce((sum, group) => sum + group.rows.length, 0)}
          tableClassName="border-collapse"
          thead={
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <th className="whitespace-nowrap px-3 py-3">ID</th>
              <th className="whitespace-nowrap px-3 py-3">Ping Tree Name</th>
              <th className="max-w-[14rem] px-3 py-3">Comment</th>
              <th className="whitespace-nowrap px-3 py-3">Product</th>
              <th className="whitespace-nowrap px-3 py-3">Status</th>
              <th className="whitespace-nowrap px-3 py-3">Global settings</th>
              <th className="whitespace-nowrap px-3 py-3">Custom settings</th>
              <th className="whitespace-nowrap px-3 py-3 text-center">Action</th>
            </tr>
          }
        >
          <tbody>
            {groups.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                  No ping trees found for {activeTab}.
                </td>
              </tr>
            ) : (
              groups.map((group) => (
                <GroupRows
                  key={group.verticalId}
                  label={group.label}
                  rows={group.rows}
                  onConfig={() => openConfig(group.verticalId)}
                  onRename={openRename}
                  onDuplicate={handleDuplicate}
                  onDelete={setDeleteTarget}
                  onRestore={handleRestore}
                  onEdit={openEdit}
                />
              ))
            )}
          </tbody>
        </ScrollableTableShell>
      </ListTableContainer>

      {/* Create modal */}
      <Modal
        open={createOpen}
        title={`Create New Ping Tree (${activeTab})`}
        onClose={() => setCreateOpen(false)}
        actions={
          <>
            <CancelButton onClick={() => setCreateOpen(false)} disabled={isSubmitting} />
            <PrimaryButton onClick={submitCreate} disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add"}
            </PrimaryButton>
          </>
        }
      >
        <PingTreeForm form={createForm} setForm={setCreateForm} products={products} error={formError} />
      </Modal>

      {/* Edit modal */}
      <Modal
        open={editTarget !== null}
        title="Edit Ping Tree"
        onClose={() => setEditTarget(null)}
        actions={
          <>
            <CancelButton onClick={() => setEditTarget(null)} disabled={isSubmitting} />
            <PrimaryButton onClick={submitEdit} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save"}
            </PrimaryButton>
          </>
        }
      >
        <PingTreeForm form={editForm} setForm={setEditForm} products={products} error={formError} />
      </Modal>

      {/* Rename modal */}
      <Modal
        open={renameTarget !== null}
        title="Rename Ping Tree"
        onClose={() => setRenameTarget(null)}
        actions={
          <>
            <CancelButton onClick={() => setRenameTarget(null)} disabled={isSubmitting} />
            <PrimaryButton onClick={submitRename} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save"}
            </PrimaryButton>
          </>
        }
      >
        <FormError error={formError} />
        <FieldLabel htmlFor="ptc-rename" label="Name" required />
        <Input
          id="ptc-rename"
          value={renameValue}
          onChange={(event) => setRenameValue(event.target.value)}
          autoFocus
        />
      </Modal>

      {/* Delete confirm modal */}
      <Modal
        open={deleteTarget !== null}
        title="Delete Ping Tree"
        description={
          deleteTarget ? `Are you sure you want to delete "${deleteTarget.name}"?` : undefined
        }
        onClose={() => setDeleteTarget(null)}
        actions={
          <>
            <CancelButton onClick={() => setDeleteTarget(null)} disabled={isSubmitting} />
            <PrimaryButton
              onClick={submitDelete}
              disabled={isSubmitting || isDeleteUsageLoading || deleteBlockedByPublisher}
              className="border-red-600 bg-red-600 hover:bg-red-700 dark:border-red-500 dark:bg-red-500"
            >
              {isSubmitting ? "Deleting..." : "Delete"}
            </PrimaryButton>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {isDeleteUsageLoading
            ? "Checking publisher distribution assignments..."
            : deleteBlockedByPublisher
              ? "This ping tree cannot be deleted while it is assigned in Distribution by Publisher."
              : 'This will move the ping tree to deleted. You can show it again using the "Show Deleted" filter.'}
        </p>
        {deleteBlockedByPublisher ? (
          <PublisherDistributionUsageAlert
            className="mt-4"
            usages={deletePublisherUsages}
            variant="deleteBlocked"
          />
        ) : null}
      </Modal>

      {/* Config percentage modal */}
      <Modal
        open={configProductId !== null}
        title={`Config percentage for product ${configProductLabel}`}
        onClose={() => setConfigProductId(null)}
        panelClassName="max-w-xl"
        actions={
          <PrimaryButton onClick={submitConfig} disabled={isSavingConfig || configTotal !== 100}>
            {isSavingConfig ? "Applying..." : "Apply"}
          </PrimaryButton>
        }
      >
        <FormError error={configError} />
        {configRows.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No ping trees for this product yet.</p>
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="grid grid-cols-[minmax(0,1fr)_6.5rem_5.5rem_7rem] items-center gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-400">
                <span>Ping Tree Name</span>
                <span className="text-center">New Value</span>
                <span className="text-center">Current</span>
                <span className="text-center">Action</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {configRows.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-[minmax(0,1fr)_6.5rem_5.5rem_7rem] items-center gap-3 px-3 py-2.5"
                  >
                    <span className="truncate font-medium text-slate-800 dark:text-slate-100" title={row.name}>
                      {row.name}
                    </span>
                    <div className="flex items-center justify-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={configValues[row.id] ?? 0}
                        onChange={(event) =>
                          setConfigValue(row.id, Math.max(0, Math.min(100, Number(event.target.value) || 0)))
                        }
                        className="!h-9 w-[4.25rem] !px-2 text-center tabular-nums"
                      />
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">%</span>
                    </div>
                    <span className="text-center text-sm tabular-nums text-slate-600 dark:text-slate-300">
                      {row.percent}%
                    </span>
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={() => setRowTo100(row.id)}
                        className="rounded-lg bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600"
                      >
                        Set to 100%
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div
              className={cn(
                "mt-3 flex items-center justify-between rounded-xl border px-3 py-2 text-sm font-medium",
                configTotal === 100
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
              )}
            >
              <span>Total percent</span>
              <span className="tabular-nums">{configTotal}%</span>
            </div>
          </>
        )}
      </Modal>
    </PageSection>
  );
}

type GroupRowsProps = {
  label: string;
  rows: PingTreeConfigRecord[];
  onConfig: () => void;
  onRename: (record: PingTreeConfigRecord) => void;
  onDuplicate: (record: PingTreeConfigRecord) => void;
  onDelete: (record: PingTreeConfigRecord) => void;
  onRestore: (record: PingTreeConfigRecord) => void;
  onEdit: (record: PingTreeConfigRecord) => void;
};

function GroupRows({ label, rows, onConfig, onRename, onDuplicate, onDelete, onRestore, onEdit }: GroupRowsProps) {
  return (
    <>
      <tr className="border-b border-slate-300 bg-slate-200 dark:border-slate-600 dark:bg-slate-700/70">
        <td colSpan={8} className="px-3 py-2.5">
          <div className="relative flex items-center justify-center">
            <span className="text-center text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-slate-100">
              {label}
            </span>
            <button
              type="button"
              onClick={onConfig}
              className="absolute right-0 inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600"
            >
              <SlidersHorizontal size={13} aria-hidden className="shrink-0" />
              Config
            </button>
          </div>
        </td>
      </tr>
      {rows.map((row) => (
        <tr
          key={row.id}
          className="border-b border-slate-100 text-slate-700 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800/40"
        >
          <td className="whitespace-nowrap px-3 py-3 align-middle">
            <Link
              href={`/ping-tree-settings/editor?id=${row.id}&type=${PROCESSING_TO_CAMPAIGN_TYPE[row.processingType]}`}
              className="group inline-flex"
              title="Open ping tree editor"
            >
              <IdBadge id={row.displayId ?? "-"} interactive />
            </Link>
          </td>
          <td className="whitespace-nowrap px-3 py-3 align-middle font-medium text-slate-800 dark:text-slate-100">
            {row.name}
          </td>
          <td className="max-w-[14rem] truncate px-3 py-3 align-middle text-slate-600 dark:text-slate-300" title={row.comment || undefined}>
            {row.comment || "—"}
          </td>
          <td className="whitespace-nowrap px-3 py-3 align-middle text-xs text-slate-600 dark:text-slate-300">
            {row.productLabel}
          </td>
          <td className="whitespace-nowrap px-3 py-3 align-middle">
            <StatusBadge status={row.status} />
          </td>
          <td className="whitespace-nowrap px-3 py-3 align-middle">{formatPingTreePercentLabel(row.percent)}</td>
          <td className="whitespace-nowrap px-3 py-3 align-middle text-slate-400 dark:text-slate-500">—</td>
          <td className="whitespace-nowrap px-3 py-3 align-middle">
            <div className="inline-flex items-center justify-center gap-1.5">
              <TableActionButton onClick={() => onRename(row)}>Rename</TableActionButton>
              <TableActionButton onClick={() => onDuplicate(row)}>Duplicate</TableActionButton>
              {row.status === "Deleted" ? (
                <TableActionButton onClick={() => onRestore(row)}>Restore</TableActionButton>
              ) : (
                <TableActionButton variant="danger" onClick={() => onDelete(row)}>
                  Delete
                </TableActionButton>
              )}
              <TableActionButton onClick={() => onEdit(row)}>Edit</TableActionButton>
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

type PingTreeFormProps = {
  form: FormState;
  setForm: (updater: (current: FormState) => FormState) => void;
  products: ProductOption[];
  error: string;
};

function PingTreeForm({ form, setForm, products, error }: PingTreeFormProps) {
  return (
    <div className="space-y-4">
      <FormError error={error} />
      <div>
        <FieldLabel htmlFor="ptc-form-name" label="Name" required />
        <Input
          id="ptc-form-name"
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          autoFocus
        />
      </div>
      <div>
        <FieldLabel htmlFor="ptc-form-comment" label="Comment" />
        <textarea
          id="ptc-form-comment"
          value={form.comment}
          onChange={(event) => setForm((current) => ({ ...current, comment: event.target.value }))}
          rows={3}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50"
        />
      </div>
      <div>
        <FieldLabel htmlFor="ptc-form-product" label="Product" required />
        <Select
          id="ptc-form-product"
          value={form.verticalId}
          onChange={(event) => setForm((current) => ({ ...current, verticalId: event.target.value }))}
        >
          <option value="" disabled>
            Select a product
          </option>
          {products.map((product) => (
            <option key={product.verticalId} value={product.verticalId}>
              {product.productLabel}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
