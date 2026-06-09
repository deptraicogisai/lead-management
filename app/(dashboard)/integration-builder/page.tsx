"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, CircleHelp, Download, Filter, Plus, Settings2 } from "lucide-react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { IdBadge } from "@/components/ui/id-badge";
import { FieldLabel, FormError, Input, PrimaryButton } from "@/components/ui/form-controls";
import { Modal } from "@/components/ui/modal";
import { PageSection } from "@/components/ui/state";
import { cn } from "@/lib/utils";
import type { IntegrationBuilderRecord } from "@/lib/integration-builder";

type VerticalOption = {
  id: string;
  name: string;
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;
}

export default function IntegrationBuilderPage() {
  const [records, setRecords] = useState<IntegrationBuilderRecord[]>([]);
  const [verticalOptions, setVerticalOptions] = useState<VerticalOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingVerticals, setIsLoadingVerticals] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [idFilter, setIdFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [postingTypeFilter, setPostingTypeFilter] = useState("All");
  const [productFilter, setProductFilter] = useState("All");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    verticalId: "",
  });
  const [addFormErrors, setAddFormErrors] = useState<Record<string, string>>({});
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const fetchRecords = async () => {
      setIsLoading(true);
      setLoadError("");

      try {
        const response = await fetch("/api/integration-builder");
        if (!response.ok) {
          setLoadError("Failed to load integration builder records.");
          setRecords([]);
          return;
        }

        const data = (await response.json()) as IntegrationBuilderRecord[];
        setRecords(data);
      } catch {
        setLoadError("Failed to load integration builder records.");
        setRecords([]);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchRecords();
  }, [reloadKey]);

  useEffect(() => {
    const fetchVerticals = async () => {
      setIsLoadingVerticals(true);

      try {
        const response = await fetch("/api/industries");
        if (!response.ok) return;

        const payload = (await response.json()) as Array<{ id: string; name: string }>;
        setVerticalOptions(payload.map((vertical) => ({ id: vertical.id, name: vertical.name })));
      } finally {
        setIsLoadingVerticals(false);
      }
    };

    void fetchVerticals();
  }, []);

  const rows = useMemo(() => {
    return records.filter((record) => {
      const matchesId = idFilter.trim()
        ? String(record.displayId).includes(idFilter.trim()) || record.id.toLowerCase().includes(idFilter.trim().toLowerCase())
        : true;
      const matchesName = nameFilter.trim() ? record.name.toLowerCase().includes(nameFilter.trim().toLowerCase()) : true;
      const matchesStatus = statusFilter === "All" ? true : record.status === statusFilter;
      const matchesPostingType = postingTypeFilter === "All" ? true : record.postingType === postingTypeFilter;
      const matchesProduct = productFilter === "All" ? true : record.verticalId === productFilter;

      return matchesId && matchesName && matchesStatus && matchesPostingType && matchesProduct;
    });
  }, [records, idFilter, nameFilter, statusFilter, postingTypeFilter, productFilter]);

  const columns: Column<IntegrationBuilderRecord>[] = [
    {
      key: "id",
      label: (
        <span className="inline-flex items-center gap-1.5">
          <span>ID</span>
          <span
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-semibold text-slate-500 dark:border-slate-500 dark:text-slate-400"
            title="Integration builder record identifier"
          >
            <CircleHelp size={10} strokeWidth={2.5} />
          </span>
          <ChevronDown size={14} className="text-slate-500 dark:text-slate-400" aria-hidden />
        </span>
      ),
      render: (row) => <IdBadge id={row.displayId} />,
    },
    {
      key: "name",
      label: "Name",
      render: (row) => (
        <Link
          href={`/integration-builder/${encodeURIComponent(row.id)}`}
          className="font-medium text-blue-700 hover:underline dark:text-blue-300"
        >
          {row.name}
        </Link>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => (
        <span
          className={cn(
            "rounded-full px-2 py-1 text-xs font-semibold",
            row.status === "Active"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
              : row.status === "Paused"
                ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200"
                : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
          )}
        >
          {row.status}
        </span>
      ),
    },
    { key: "postingType", label: "Posting Type" },
    {
      key: "product",
      label: "Product",
      render: (row) => row.productLabel || row.product,
    },
    {
      key: "createdAt",
      label: "Created",
      render: (row) => <span className="whitespace-nowrap text-xs">{formatDateTime(row.createdAt)}</span>,
    },
    {
      key: "updatedAt",
      label: "Updated",
      render: (row) => <span className="whitespace-nowrap text-xs">{formatDateTime(row.updatedAt)}</span>,
    },
    {
      key: "actions",
      label: "Action",
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/integration-builder/${encodeURIComponent(row.id)}`}
            className="rounded-lg border border-emerald-700 bg-emerald-800 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            Configure
          </Link>
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            Clone
          </button>
          <button
            type="button"
            className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-50 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/20"
          >
            Export
          </button>
        </div>
      ),
    },
  ];

  const toggleRow = (rowId: string) => {
    setSelectedIds((current) => (current.includes(rowId) ? current.filter((id) => id !== rowId) : [...current, rowId]));
  };

  const toggleAllRows = (checked: boolean) => {
    setSelectedIds(checked ? rows.map((row) => row.id) : []);
  };

  const clearFilters = () => {
    setIdFilter("");
    setNameFilter("");
    setStatusFilter("All");
    setPostingTypeFilter("All");
    setProductFilter("All");
    setSelectedIds([]);
  };

  const resetAddForm = () => {
    setAddForm({
      name: "",
      verticalId: "",
    });
    setAddFormErrors({});
  };

  const handleOpenAddModal = () => {
    resetAddForm();
    setIsAddModalOpen(true);
  };

  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
    resetAddForm();
  };

  const handleAddRecord = async () => {
    const errors: Record<string, string> = {};

    if (!addForm.name.trim()) {
      errors.name = "Name is required.";
    }

    if (!addForm.verticalId.trim()) {
      errors.verticalId = "Product is required.";
    }

    if (Object.keys(errors).length > 0) {
      setAddFormErrors(errors);
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/integration-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addForm.name.trim(),
          verticalId: addForm.verticalId,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        setAddFormErrors({ form: payload?.message ?? "Failed to create record." });
        return;
      }

      handleCloseAddModal();
      setReloadKey((current) => current + 1);
    } catch {
      setAddFormErrors({ form: "Failed to create record." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageSection title="Integration Builder">
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900/70">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">ID</label>
                <Input value={idFilter} onChange={(event) => setIdFilter(event.target.value)} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Name</label>
                <Input value={nameFilter} onChange={(event) => setNameFilter(event.target.value)} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Status</label>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25"
                >
                  <option value="All">All</option>
                  <option value="Active">Active</option>
                  <option value="Draft">Draft</option>
                  <option value="Paused">Paused</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Posting Type</label>
                <select
                  value={postingTypeFilter}
                  onChange={(event) => setPostingTypeFilter(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25"
                >
                  <option value="All">All</option>
                  <option value="Direct Post">Direct Post</option>
                  <option value="Ping Post">Ping Post</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Product</label>
                <select
                  value={productFilter}
                  onChange={(event) => setProductFilter(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25"
                >
                  <option value="All">All</option>
                  {verticalOptions.map((vertical, index) => (
                    <option key={vertical.id} value={vertical.id}>
                      [{index + 1}] {vertical.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <PrimaryButton type="button" className="bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500">
                Search
              </PrimaryButton>

              <button
                type="button"
                onClick={clearFilters}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                Clear all
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-slate-600 dark:text-slate-300">
                Showing <span className="font-semibold text-slate-900 dark:text-slate-100">{rows.length > 0 ? 1 : 0}</span> to{" "}
                <span className="font-semibold text-slate-900 dark:text-slate-100">{rows.length}</span> of{" "}
                <span className="font-semibold text-slate-900 dark:text-slate-100">{records.length}</span> entries
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <Filter size={14} />
                  <span>Filter</span>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-700 bg-emerald-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                >
                  <Download size={15} />
                  <span>Export</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenAddModal}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-700 bg-emerald-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                >
                  <Plus size={15} />
                  <span>Add New Record</span>
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                >
                  <Settings2 size={15} />
                  <span>Show Columns</span>
                </button>
                <div className="rounded-xl border border-emerald-700 bg-emerald-800 px-3 py-2 text-sm font-medium text-white dark:border-emerald-500 dark:bg-emerald-600">
                  {selectedIds.length} selected
                </div>
              </div>
            </div>

            {loadError ? <p className="mb-4 text-sm text-red-600 dark:text-red-300">{loadError}</p> : null}

            {isLoading ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
                Loading integration builder records...
              </div>
            ) : (
              <DataTable<IntegrationBuilderRecord>
                columns={columns}
                rows={rows}
                emptyMessage="No integration builder records found."
                selectedRowIds={selectedIds}
                onToggleRow={toggleRow}
                onToggleAllRows={toggleAllRows}
              />
            )}
          </div>
        </div>
      </PageSection>

      <Modal
        open={isAddModalOpen}
        title="Add New"
        onClose={handleCloseAddModal}
        panelClassName="max-w-2xl"
        actions={
          <>
            <button
              type="button"
              onClick={handleCloseAddModal}
              disabled={isSaving}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <PrimaryButton
              type="button"
              onClick={() => void handleAddRecord()}
              disabled={isSaving}
              className="bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              {isSaving ? "Adding..." : "Add"}
            </PrimaryButton>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <FieldLabel htmlFor="integration-builder-name" label="Name" />
            <Input
              id="integration-builder-name"
              value={addForm.name}
              onChange={(event) => setAddForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Enter record name"
            />
            <FormError error={addFormErrors.name} />
          </div>

          <div>
            <FieldLabel htmlFor="integration-builder-product" label="Product" />
            <select
              id="integration-builder-product"
              value={addForm.verticalId}
              onChange={(event) => setAddForm((current) => ({ ...current, verticalId: event.target.value }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/25"
            >
              <option value="">{isLoadingVerticals ? "Loading verticals..." : "Please select product"}</option>
              {verticalOptions.map((vertical, index) => (
                <option key={vertical.id} value={vertical.id}>
                  [{index + 1}] {vertical.name}
                </option>
              ))}
            </select>
            <FormError error={addFormErrors.verticalId} />
          </div>

          <FormError error={addFormErrors.form} />
        </div>
      </Modal>
    </div>
  );
}
