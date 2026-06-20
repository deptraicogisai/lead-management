"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CircleHelp, Copy, Download, Plus, Trash2 } from "lucide-react";
import { ClearButton, ComingSoonButton, ExportButton, SearchButton } from "@/components/ui/action-buttons";
import { DataTable, type Column } from "@/components/ui/data-table";
import { IdBadge } from "@/components/ui/id-badge";
import { FieldLabel, FormError, Input, PrimaryButton } from "@/components/ui/form-controls";
import { Modal } from "@/components/ui/modal";
import { ListTableContainer } from "@/components/ui/list-table-container";
import { ListTableToolbar } from "@/components/ui/list-table-toolbar";
import { PageSection } from "@/components/ui/state";
import { useListLoadState } from "@/lib/use-list-load-state";
import { StatusBadge } from "@/components/ui/status-badge";
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
  const { isInitialLoad, isRefreshing, beginLoad, endLoad } = useListLoadState();
  const [isLoadingVerticals, setIsLoadingVerticals] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [idFilter, setIdFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [productFilter, setProductFilter] = useState("All");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    verticalId: "",
  });
  const [addFormErrors, setAddFormErrors] = useState<Record<string, string>>({});
  const [reloadKey, setReloadKey] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState<
    { mode: "single"; record: IntegrationBuilderRecord } | { mode: "bulk"; ids: string[] } | null
  >(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [tableFilter, setTableFilter] = useState("");

  useEffect(() => {
    const fetchRecords = async () => {
      beginLoad();
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
        endLoad();
      }
    };

    void fetchRecords();
  }, [beginLoad, endLoad, reloadKey]);

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
      const matchesProduct = productFilter === "All" ? true : record.verticalId === productFilter;

      const search = tableFilter.trim().toLowerCase();
      const matchesTableFilter = search
        ? [String(record.displayId), record.name, record.productLabel, record.product, record.status]
            .join(" ")
            .toLowerCase()
            .includes(search)
        : true;

      return matchesId && matchesName && matchesStatus && matchesProduct && matchesTableFilter;
    });
  }, [records, idFilter, nameFilter, statusFilter, productFilter, tableFilter]);

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
        </span>
      ),
      sortValue: (row) => row.displayId,
      render: (row) => (
        <Link href={`/integration-builder/${encodeURIComponent(row.id)}`} className="group inline-flex">
          <IdBadge id={row.displayId} interactive />
        </Link>
      ),
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
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "product",
      label: "Product",
      sortValue: (row) => row.productLabel || row.product,
      render: (row) => row.productLabel || row.product,
    },
    {
      key: "createdAt",
      label: "Created",
      sortValue: (row) => new Date(row.createdAt).getTime(),
      render: (row) => <span className="whitespace-nowrap text-xs">{formatDateTime(row.createdAt)}</span>,
    },
    {
      key: "updatedAt",
      label: "Updated",
      sortValue: (row) => new Date(row.updatedAt).getTime(),
      render: (row) => <span className="whitespace-nowrap text-xs">{formatDateTime(row.updatedAt)}</span>,
    },
    {
      key: "actions",
      label: "Action",
      sortable: false,
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/integration-builder/${encodeURIComponent(row.id)}`}
            className="rounded-lg border border-emerald-700 bg-emerald-800 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            Configure
          </Link>
          <ComingSoonButton icon={Copy} className="rounded-lg px-3 py-1.5">
            Clone
          </ComingSoonButton>
          <ComingSoonButton icon={Download} className="rounded-lg border-blue-200 px-3 py-1.5 text-blue-700 dark:border-blue-500/40 dark:text-blue-200">
            Export
          </ComingSoonButton>
          <button
            type="button"
            onClick={() => setDeleteConfirm({ mode: "single", record: row })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200 dark:hover:bg-red-500/20"
          >
            <Trash2 size={13} />
            <span>Remove</span>
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
    setProductFilter("All");
    setTableFilter("");
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

  const deleteRecordsByIds = async (idsToDelete: string[]) => {
    if (idsToDelete.length === 0) return { deletedCount: 0, errorMessage: "" };

    let deletedCount = 0;
    let errorMessage = "";

    for (const id of idsToDelete) {
      const response = await fetch(`/api/integration-builder/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      const result = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        errorMessage = result?.message ?? "Failed to remove integration builder record.";
        break;
      }

      deletedCount += 1;
    }

    return { deletedCount, errorMessage };
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;

    setIsDeleting(true);
    setDeleteError("");

    const idsToDelete =
      deleteConfirm.mode === "single" ? [deleteConfirm.record.id] : deleteConfirm.ids;
    const { deletedCount, errorMessage } = await deleteRecordsByIds(idsToDelete);
    const removedIds = idsToDelete.slice(0, deletedCount);

    if (removedIds.length > 0) {
      setRecords((current) => current.filter((record) => !removedIds.includes(record.id)));
      setSelectedIds((current) => current.filter((id) => !removedIds.includes(id)));
    }

    if (errorMessage) {
      setDeleteError(errorMessage);
      setIsDeleting(false);
      return;
    }

    setDeleteConfirm(null);
    setIsDeleting(false);
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
      <PageSection>
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
              <SearchButton />
              <ClearButton onClick={clearFilters} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <ListTableToolbar
              showingFrom={rows.length > 0 ? 1 : 0}
              showingTo={rows.length}
              totalItems={records.length}
              tableFilter={tableFilter}
              onTableFilterChange={setTableFilter}
              selectedCount={selectedIds.length}
              actions={
                <>
                  <ExportButton disabled />
                  <button
                    type="button"
                    onClick={handleOpenAddModal}
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-700 bg-emerald-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                  >
                    <Plus size={15} />
                    <span>Add New Record</span>
                  </button>
                  {selectedIds.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm({ mode: "bulk", ids: [...selectedIds] })}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200 dark:hover:bg-red-500/20"
                    >
                      <Trash2 size={15} />
                      <span>Remove ({selectedIds.length})</span>
                    </button>
                  ) : null}
                </>
              }
            />

            {loadError ? <p className="mb-4 text-sm text-red-600 dark:text-red-300">{loadError}</p> : null}
            {deleteError ? <p className="mb-4 text-sm text-red-600 dark:text-red-300">{deleteError}</p> : null}

            <ListTableContainer
              isInitialLoad={isInitialLoad}
              isRefreshing={isRefreshing}
              loadingMessage="Loading integration builder records..."
            >
              <DataTable<IntegrationBuilderRecord>
                columns={columns}
                rows={rows}
                emptyMessage="No integration builder records found."
                selectedRowIds={selectedIds}
                onToggleRow={toggleRow}
                onToggleAllRows={toggleAllRows}
              />
            </ListTableContainer>
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

      <Modal
        open={deleteConfirm !== null}
        title={deleteConfirm?.mode === "bulk" ? "Remove Selected Records" : "Remove Integration"}
        description={
          deleteConfirm?.mode === "single"
            ? `Remove integration "${deleteConfirm.record.name}"? This action cannot be undone.`
            : deleteConfirm?.mode === "bulk"
              ? `Remove ${deleteConfirm.ids.length} selected integration record(s)? This action cannot be undone.`
              : undefined
        }
        onClose={() => {
          if (!isDeleting) {
            setDeleteConfirm(null);
            setDeleteError("");
          }
        }}
        actions={
          <>
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => {
                setDeleteConfirm(null);
                setDeleteError("");
              }}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => void handleConfirmDelete()}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 dark:bg-red-500 dark:hover:bg-red-400"
            >
              {isDeleting ? "Removing..." : "Remove"}
            </button>
          </>
        }
      />
    </div>
  );
}
