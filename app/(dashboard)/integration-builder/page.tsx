"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { CircleHelp, Copy, Download, RotateCcw } from "lucide-react";
import {
  AddNewButton,
  CancelButton,
  ClearButton,
  DangerButton,
  DeleteSelectedButton,
  SearchButton,
  TableActionButton,
  TableActionLink,
} from "@/components/ui/action-buttons";
import { DataTable, type Column } from "@/components/ui/data-table";
import { IdBadge } from "@/components/ui/id-badge";
import { FieldLabel, FormError, Input, PrimaryButton } from "@/components/ui/form-controls";
import { Modal } from "@/components/ui/modal";
import { ListTableContainer } from "@/components/ui/list-table-container";
import { ListTableToolbar } from "@/components/ui/list-table-toolbar";
import { PageSection } from "@/components/ui/state";
import { StatusMultiSelect } from "@/components/ui/status-multi-select";
import { useListLoadState } from "@/lib/use-list-load-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import {
  buildIntegrationBuilderExportFileName,
  buildIntegrationBuilderExportPayload,
  downloadJsonFile,
  resolveIntegrationExportProductId,
} from "@/lib/integration-builder-export";
import type { IntegrationBuilderRecord } from "@/lib/integration-builder";
import type { IntegrationBuilderExportPayload } from "@/lib/integration-builder-export";
import { parseIntegrationBuilderImportSchema } from "@/lib/integration-builder-import";

type VerticalOption = {
  id: string;
  name: string;
};

type IntegrationBuilderCreateType = "new" | "import";

const INTEGRATION_BUILDER_STATUS_FILTER_OPTIONS = [
  { value: "Active", label: "Active" },
  { value: "Disabled", label: "Disabled" },
  { value: "Deleted", label: "Deleted" },
];

const addFormSelectClassName =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/25";

const fieldErrorBorderClassName =
  "animate-field-invalid border-red-400 focus:border-red-500 focus:ring-red-100 dark:border-red-500/70 dark:focus:border-red-500";

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
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [productFilter, setProductFilter] = useState("All");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    verticalId: "",
    type: "new" as IntegrationBuilderCreateType,
  });
  const [importSchema, setImportSchema] = useState<IntegrationBuilderExportPayload | null>(null);
  const [importSchemaFileName, setImportSchemaFileName] = useState("");
  const [addFormErrors, setAddFormErrors] = useState<Record<string, string>>({});
  const [reloadKey, setReloadKey] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState<
    { mode: "single"; record: IntegrationBuilderRecord } | { mode: "bulk"; ids: string[] } | null
  >(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [tableFilter, setTableFilter] = useState("");
  const [cloneTarget, setCloneTarget] = useState<IntegrationBuilderRecord | null>(null);
  const [cloneName, setCloneName] = useState("");
  const [cloneError, setCloneError] = useState("");
  const [isCloning, setIsCloning] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);

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
      const matchesStatus = statusFilter.length === 0 ? true : statusFilter.includes(record.status);
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

  const handleExportRecord = async (record: IntegrationBuilderRecord) => {
    setExportingId(record.id);

    try {
      const response = await fetch(`/api/integration-builder/${encodeURIComponent(record.id)}`);
      if (!response.ok) {
        throw new Error("Failed to load integration builder record.");
      }

      const fullRecord = (await response.json()) as IntegrationBuilderRecord;
      const productId = resolveIntegrationExportProductId(fullRecord, verticalOptions);
      const payload = buildIntegrationBuilderExportPayload(fullRecord, productId);

      downloadJsonFile(buildIntegrationBuilderExportFileName(fullRecord.name), payload);
      toast.success("Integration exported successfully.", "Export");
    } catch {
      toast.error("Failed to export integration builder record.", "Export");
    } finally {
      setExportingId(null);
    }
  };

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
          <TableActionLink href={`/integration-builder/${encodeURIComponent(row.id)}`}>
            Configure
          </TableActionLink>
          <TableActionButton
            type="button"
            icon={Copy}
            onClick={() => {
              setCloneTarget(row);
              setCloneName(`${row.name} Copy`);
              setCloneError("");
            }}
          >
            Clone
          </TableActionButton>
          <TableActionButton
            type="button"
            icon={Download}
            onClick={() => void handleExportRecord(row)}
            disabled={exportingId === row.id}
          >
            {exportingId === row.id ? "Exporting..." : "Export"}
          </TableActionButton>
          {row.status === "Deleted" ? (
            <TableActionButton
              type="button"
              icon={false}
              onClick={() => void handleRestoreRecord(row)}
              disabled={restoringId === row.id}
              className="min-w-[6.5rem] justify-center"
            >
              <RotateCcw
                size={12}
                aria-hidden
                className={cn("shrink-0", restoringId === row.id && "animate-spin")}
              />
              {restoringId === row.id ? "Restoring..." : "Restore"}
            </TableActionButton>
          ) : (
            <TableActionButton
              type="button"
              variant="danger"
              onClick={() => setDeleteConfirm({ mode: "single", record: row })}
            >
              Delete
            </TableActionButton>
          )}
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
    setStatusFilter([]);
    setProductFilter("All");
    setTableFilter("");
    setSelectedIds([]);
  };

  const resetAddForm = () => {
    setAddForm({
      name: "",
      verticalId: "",
      type: "new",
    });
    setImportSchema(null);
    setImportSchemaFileName("");
    setAddFormErrors({});
  };

  const handleSchemaFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      setImportSchema(null);
      setImportSchemaFileName("");
      return;
    }

    try {
      const text = await file.text();
      const raw = JSON.parse(text) as unknown;
      const parsed = parseIntegrationBuilderImportSchema(raw);

      if (!parsed.ok) {
        setImportSchema(null);
        setImportSchemaFileName("");
        setAddFormErrors((current) => ({ ...current, schemaFile: parsed.message }));
        return;
      }

      setImportSchema(parsed.schema);
      setImportSchemaFileName(file.name);
      setAddFormErrors((current) => ({ ...current, schemaFile: "" }));
    } catch {
      setImportSchema(null);
      setImportSchemaFileName("");
      setAddFormErrors((current) => ({ ...current, schemaFile: "Invalid JSON file." }));
    } finally {
      event.target.value = "";
    }
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
      setRecords((current) =>
        current.map((record) =>
          removedIds.includes(record.id) ? { ...record, status: "Deleted" } : record
        )
      );
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

  const handleRestoreRecord = async (record: IntegrationBuilderRecord) => {
    setRestoringId(record.id);

    try {
      const [response] = await Promise.all([
        fetch(`/api/integration-builder/${encodeURIComponent(record.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "Disabled" }),
        }),
        new Promise((resolve) => setTimeout(resolve, 700)),
      ]);
      const result = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        toast.error(result?.message ?? "Failed to restore integration builder record.");
        return;
      }

      setRecords((current) =>
        current.map((item) => (item.id === record.id ? { ...item, status: "Disabled" } : item))
      );
      toast.success("Integration builder record restored.");
    } catch {
      toast.error("Failed to restore integration builder record.");
    } finally {
      setRestoringId(null);
    }
  };

  const handleCloseCloneModal = () => {
    if (isCloning) return;
    setCloneTarget(null);
    setCloneName("");
    setCloneError("");
  };

  const handleCloneRecord = async () => {
    if (!cloneTarget) return;

    if (!cloneName.trim()) {
      setCloneError("Name is required.");
      return;
    }

    setIsCloning(true);
    setCloneError("");

    try {
      const response = await fetch(`/api/integration-builder/${encodeURIComponent(cloneTarget.id)}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cloneName.trim() }),
      });

      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        setCloneError(payload?.message ?? "Failed to clone integration builder record.");
        return;
      }

      toast.success("Integration builder cloned successfully.", "Clone");
      handleCloseCloneModal();
      setReloadKey((current) => current + 1);
    } catch {
      setCloneError("Failed to clone integration builder record.");
    } finally {
      setIsCloning(false);
    }
  };

  const handleAddRecord = async () => {
    const errors: Record<string, string> = {};

    if (addForm.type === "new") {
      if (!addForm.name.trim()) {
        errors.name = "Name is required.";
      }

      if (!addForm.verticalId.trim()) {
        errors.verticalId = "Product is required.";
      }
    }

    if (addForm.type === "import" && !importSchema) {
      errors.schemaFile = "Schema file is required.";
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
        body: JSON.stringify(
          addForm.type === "import"
            ? {
                createType: "import",
                importSchema,
              }
            : {
                name: addForm.name.trim(),
                verticalId: addForm.verticalId,
                createType: "new",
              }
        ),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        setAddFormErrors({ form: payload?.message ?? "Failed to create record." });
        return;
      }

      handleCloseAddModal();
      setReloadKey((current) => current + 1);
      toast.success(
        addForm.type === "import" ? "Integration imported successfully." : "Integration created successfully.",
        "Add New"
      );
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
                <StatusMultiSelect
                  options={INTEGRATION_BUILDER_STATUS_FILTER_OPTIONS}
                  selected={statusFilter}
                  onChange={setStatusFilter}
                />
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

            <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
              <SearchButton type="button" />
              <ClearButton type="button" onClick={clearFilters} />
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
                  <DeleteSelectedButton
                    count={selectedIds.length}
                    label="Delete Selected"
                    onClick={() => setDeleteConfirm({ mode: "bulk", ids: [...selectedIds] })}
                    disabled={selectedIds.length === 0 || isDeleting || isInitialLoad || isRefreshing}
                  />
                  <AddNewButton type="button" onClick={handleOpenAddModal}>
                    Add New Record
                  </AddNewButton>
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
            <CancelButton type="button" onClick={handleCloseAddModal} disabled={isSaving} />
            <PrimaryButton type="button" onClick={() => void handleAddRecord()} disabled={isSaving}>
              {isSaving ? "Adding..." : "Add"}
            </PrimaryButton>
          </>
        }
      >
        <div className="space-y-4">
          <FormError error={addFormErrors.form} />
          <div>
            <FieldLabel htmlFor="integration-builder-type" label="Type" />
            <select
              id="integration-builder-type"
              value={addForm.type}
              onChange={(event) => {
                const nextType = event.target.value as IntegrationBuilderCreateType;
                setAddForm((current) => ({ ...current, type: nextType }));
                setAddFormErrors((current) => ({ ...current, schemaFile: "" }));

                if (nextType === "new") {
                  setImportSchema(null);
                  setImportSchemaFileName("");
                }
              }}
              className={addFormSelectClassName}
            >
              <option value="new">New</option>
              <option value="import">Import</option>
            </select>
          </div>

          {addForm.type === "new" ? (
            <>
              <div>
                <FieldLabel htmlFor="integration-builder-name" label="Name" />
                <FormError error={addFormErrors.name} />
                <Input
                  id="integration-builder-name"
                  value={addForm.name}
                  invalid={Boolean(addFormErrors.name)}
                  onChange={(event) => setAddForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Enter record name"
                />
              </div>

              <div>
                <FieldLabel htmlFor="integration-builder-product" label="Product" />
                <FormError error={addFormErrors.verticalId} />
                <select
                  id="integration-builder-product"
                  value={addForm.verticalId}
                  onChange={(event) => setAddForm((current) => ({ ...current, verticalId: event.target.value }))}
                  className={cn(addFormSelectClassName, Boolean(addFormErrors.verticalId) && fieldErrorBorderClassName)}
                >
                  <option value="">{isLoadingVerticals ? "Loading verticals..." : "Please select product"}</option>
                  {verticalOptions.map((vertical, index) => (
                    <option key={vertical.id} value={vertical.id}>
                      [{index + 1}] {vertical.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : null}

          {addForm.type === "import" ? (
            <div>
              <FieldLabel htmlFor="integration-builder-schema-file" label="Schema File" />
              <FormError error={addFormErrors.schemaFile} />
              <div className="space-y-2">
                <input
                  id="integration-builder-schema-file"
                  type="file"
                  accept=".json,application/json"
                  onChange={(event) => void handleSchemaFileChange(event)}
                  className={cn(
                    "block w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:file:bg-slate-700 dark:file:text-slate-100 dark:hover:file:bg-slate-600",
                    Boolean(addFormErrors.schemaFile) && fieldErrorBorderClassName
                  )}
                />
                {importSchemaFileName ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">Selected: {importSchemaFileName}</p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={cloneTarget !== null}
        title="Clone Integration"
        description={
          cloneTarget
            ? `Create a copy of "${cloneTarget.name}" with all configuration, mappings, and settings.`
            : undefined
        }
        onClose={handleCloseCloneModal}
        panelClassName="max-w-lg"
        actions={
          <>
            <CancelButton type="button" onClick={handleCloseCloneModal} disabled={isCloning} />
            <PrimaryButton type="button" onClick={() => void handleCloneRecord()} disabled={isCloning}>
              {isCloning ? "Cloning..." : "Clone"}
            </PrimaryButton>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <FieldLabel htmlFor="integration-builder-clone-name" label="Name" />
            <FormError error={cloneError} />
            <Input
              id="integration-builder-clone-name"
              value={cloneName}
              invalid={Boolean(cloneError)}
              onChange={(event) => {
                setCloneName(event.target.value);
                if (cloneError) setCloneError("");
              }}
              placeholder="Enter integration name"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={deleteConfirm !== null}
        title={deleteConfirm?.mode === "bulk" ? "Delete Selected Records" : "Delete Integration"}
        description={
          deleteConfirm?.mode === "single"
            ? `Delete integration "${deleteConfirm.record.name}"? Its status will change to Deleted and can be restored later.`
            : deleteConfirm?.mode === "bulk"
              ? `Delete ${deleteConfirm.ids.length} selected integration record(s)? Their status will change to Deleted and can be restored later.`
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
            <CancelButton
              type="button"
              disabled={isDeleting}
              onClick={() => {
                setDeleteConfirm(null);
                setDeleteError("");
              }}
            />
            <DangerButton type="button" disabled={isDeleting} onClick={() => void handleConfirmDelete()}>
              {isDeleting ? "Deleting..." : "Delete"}
            </DangerButton>
          </>
        }
      />
    </div>
  );
}
