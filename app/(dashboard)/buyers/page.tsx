"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CircleHelp } from "lucide-react";
import { BuyerAddModal } from "@/components/buyers/buyer-add-modal";
import {
  AddNewButton,
  CancelButton,
  ClearButton,
  DangerButton,
  DeleteSelectedButton,
  DetailNameLink,
  ExportButton,
  SearchButton,
  TableActionButton,
  TableActionLink,
} from "@/components/ui/action-buttons";
import { DataTable, type Column } from "@/components/ui/data-table";
import { IdBadge } from "@/components/ui/id-badge";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { FieldLabel } from "@/components/ui/form-controls";
import { buildEmptySearchDateRange, parseDateTimeValue } from "@/lib/date-range";
import { ListTableContainer } from "@/components/ui/list-table-container";
import { ListTableToolbar } from "@/components/ui/list-table-toolbar";
import { Modal } from "@/components/ui/modal";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageSection } from "@/components/ui/state";
import { useListLoadState } from "@/lib/use-list-load-state";
import {
  BUYER_MANAGER_OPTIONS,
  formatBuyerCreated,
  type BuyerCreatePayload,
  type BuyerListRecord,
} from "@/lib/buyer";
import { StatusBadge } from "@/components/ui/status-badge";
import { toast } from "@/lib/toast";

type BuyerListResponse = {
  items: BuyerListRecord[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

const emptyDateRange = buildEmptySearchDateRange();

export default function BuyersPage() {
  const [buyerRows, setBuyerRows] = useState<BuyerListRecord[]>([]);
  const { isInitialLoad, isRefreshing, beginLoad, endLoad } = useListLoadState();
  const [isSaving, setIsSaving] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [tableFilter, setTableFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteMode, setDeleteMode] = useState<"single" | "bulk" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BuyerListRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [agentFilter, setAgentFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState(emptyDateRange.from);
  const [dateTo, setDateTo] = useState(emptyDateRange.to);

  const [appliedFilters, setAppliedFilters] = useState({
    agentFilter: "All",
    dateFrom: emptyDateRange.from,
    dateTo: emptyDateRange.to,
  });

  useEffect(() => {
    const fetchBuyers = async () => {
      beginLoad();
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        });
        const response = await fetch(`/api/buyers?${params.toString()}`);
        if (!response.ok) return;

        const data = (await response.json()) as BuyerListResponse;
        setBuyerRows(data.items);
        setTotalItems(data.totalItems);
        setTotalPages(data.totalPages);
      } finally {
        endLoad();
      }
    };

    void fetchBuyers();
  }, [page, pageSize, reloadKey]);

  const filteredRows = useMemo(() => {
    const fromDate = parseDateTimeValue(appliedFilters.dateFrom);
    const toDate = parseDateTimeValue(appliedFilters.dateTo);

    return buyerRows.filter((row) => {
      const matchesAgent =
        appliedFilters.agentFilter === "All" ? true : row.personalManagerId === appliedFilters.agentFilter;

      const createdAt = row.createdAt ? new Date(row.createdAt) : null;
      const matchesDateFrom = !fromDate || !createdAt ? true : createdAt >= fromDate;
      const matchesDateTo = !toDate || !createdAt ? true : createdAt <= toDate;

      const search = tableFilter.trim().toLowerCase();
      const matchesTableFilter = search
        ? row.name.toLowerCase().includes(search) ||
          String(row.displayId).includes(search) ||
          row.integrations.some((item) => item.toLowerCase().includes(search))
        : true;

      return matchesAgent && matchesDateFrom && matchesDateTo && matchesTableFilter;
    });
  }, [buyerRows, appliedFilters, tableFilter]);

  const handleSearch = () => {
    setAppliedFilters({
      agentFilter,
      dateFrom,
      dateTo,
    });
    setPage(1);
  };

  const clearFilters = () => {
    const resetDateRange = buildEmptySearchDateRange();
    setAgentFilter("All");
    setDateFrom(resetDateRange.from);
    setDateTo(resetDateRange.to);
    setTableFilter("");
    setAppliedFilters({
      agentFilter: "All",
      dateFrom: resetDateRange.from,
      dateTo: resetDateRange.to,
    });
    setSelectedIds([]);
    setPage(1);
  };

  const handleAddBuyer = async (values: BuyerCreatePayload) => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/buyers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const result = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        toast.error(result?.message ?? "Failed to create buyer.");
        return;
      }

      toast.success("Buyer created successfully.");
      setIsAddModalOpen(false);
      setPage(1);
      setReloadKey((current) => current + 1);
    } catch {
      toast.error("Failed to create buyer.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleRow = (rowId: string) => {
    setSelectedIds((current) => (current.includes(rowId) ? current.filter((id) => id !== rowId) : [...current, rowId]));
  };

  const toggleAllRows = (checked: boolean) => {
    setSelectedIds(checked ? filteredRows.map((row) => row.id) : []);
  };

  const closeDeleteModal = () => {
    if (isDeleting) return;
    setDeleteMode(null);
    setDeleteTarget(null);
  };

  const openSingleDelete = (row: BuyerListRecord) => {
    setDeleteTarget(row);
    setDeleteMode("single");
  };

  const openBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setDeleteTarget(null);
    setDeleteMode("bulk");
  };

  const handleDelete = async () => {
    const idsToDelete =
      deleteMode === "bulk" ? selectedIds : deleteTarget ? [deleteTarget.id] : [];

    if (idsToDelete.length === 0) return;

    setIsDeleting(true);

    try {
      const results = await Promise.all(
        idsToDelete.map(async (id) => {
          const response = await fetch(`/api/buyers/${encodeURIComponent(id)}`, { method: "DELETE" });
          const result = (await response.json().catch(() => null)) as { message?: string } | null;
          return { id, ok: response.ok, message: result?.message };
        })
      );

      const succeeded = results.filter((result) => result.ok);
      const failed = results.filter((result) => !result.ok);

      if (succeeded.length === 0) {
        toast.error(failed[0]?.message ?? "Failed to delete buyer.");
        return;
      }

      const deletedIds = new Set(succeeded.map((result) => result.id));
      setSelectedIds((current) => current.filter((id) => !deletedIds.has(id)));
      setDeleteMode(null);
      setDeleteTarget(null);

      if (failed.length > 0) {
        toast.error(`Deleted ${succeeded.length} buyer(s). ${failed.length} failed.`);
      } else if (deleteMode === "bulk") {
        toast.success(`Deleted ${succeeded.length} buyer(s).`);
      } else {
        toast.success("Buyer deleted.");
      }

      if (buyerRows.length <= succeeded.length && page > 1) {
        setPage((current) => current - 1);
      } else {
        setReloadKey((current) => current + 1);
      }
    } catch {
      toast.error("Failed to delete buyer.");
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<BuyerListRecord>[] = [
    {
      key: "id",
      label: (
        <span className="inline-flex items-center gap-1.5">
          <span>ID</span>
          <span
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-slate-500 dark:border-slate-500"
            title="Buyer record identifier"
          >
            <CircleHelp size={10} strokeWidth={2.5} />
          </span>
        </span>
      ),
      sortValue: (row) => row.displayId,
      render: (row) => (
        <Link href={`/buyers/${encodeURIComponent(row.id)}`} className="group inline-flex">
          <IdBadge id={row.displayId} interactive />
        </Link>
      ),
    },
    {
      key: "name",
      label: "Name",
      render: (row) => (
        <DetailNameLink href={`/buyers/${encodeURIComponent(row.id)}`}>{row.name}</DetailNameLink>
      ),
    },
    {
      key: "createdAt",
      label: "Created",
      sortValue: (row) => (row.createdAt ? new Date(row.createdAt).getTime() : 0),
      render: (row) => <span className="whitespace-nowrap text-xs">{formatBuyerCreated(row.createdAt)}</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "integrations",
      label: "Integrations",
      sortValue: (row) => row.integrations.join(", "),
      render: (row) => (
        <div className="max-w-xs space-y-1 text-xs text-slate-700 dark:text-slate-200">
          {row.integrations.length > 0 ? row.integrations.map((item) => <p key={item}>{item}</p>) : <span>-</span>}
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <TableActionLink href={`/buyers/${encodeURIComponent(row.id)}`}>View</TableActionLink>
          <TableActionButton variant="danger" onClick={() => openSingleDelete(row)}>
            Delete
          </TableActionButton>
        </div>
      ),
    },
  ];

  const showingFrom = filteredRows.length > 0 ? (page - 1) * pageSize + 1 : 0;
  const showingTo = filteredRows.length > 0 ? Math.min(page * pageSize, totalItems) : 0;

  return (
    <div className="space-y-6">
      <PageSection>
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900/70">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Buyer Agent</label>
                <select
                  value={agentFilter}
                  onChange={(event) => setAgentFilter(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50"
                >
                  <option value="All">All</option>
                  {BUYER_MANAGER_OPTIONS.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      [{manager.id}] {manager.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel htmlFor="buyer-date-range" label="Date" />
                <DateRangePicker
                  id="buyer-date-range"
                  value={{ from: dateFrom, to: dateTo }}
                  onChange={(range) => {
                    setDateFrom(range.from);
                    setDateTo(range.to);
                  }}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
              <SearchButton onClick={handleSearch} />
              <ClearButton onClick={clearFilters} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <ListTableToolbar
              pageSize={pageSize}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              showingFrom={showingFrom}
              showingTo={showingTo}
              totalItems={totalItems}
              tableFilter={tableFilter}
              onTableFilterChange={setTableFilter}
              selectedCount={selectedIds.length}
              actions={
                <>
                  <DeleteSelectedButton
                    count={selectedIds.length}
                    onClick={openBulkDelete}
                    disabled={selectedIds.length === 0 || isDeleting || isInitialLoad || isRefreshing}
                  />
                  <ExportButton disabled />
                  <AddNewButton type="button" onClick={() => setIsAddModalOpen(true)}>
                    Add New Buyer
                  </AddNewButton>
                </>
              }
            />

            <ListTableContainer
              isInitialLoad={isInitialLoad}
              isRefreshing={isRefreshing}
              loadingMessage="Loading buyers..."
            >
              <DataTable<BuyerListRecord>
                columns={columns}
                rows={filteredRows}
                emptyMessage="No buyers found."
                selectedRowIds={selectedIds}
                onToggleRow={toggleRow}
                onToggleAllRows={toggleAllRows}
              />
            </ListTableContainer>
          </div>

          <PaginationControls
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            pageSizeOptions={[15, 50]}
            onPageSizeChange={(value) => {
              setPageSize(value);
              setPage(1);
            }}
            onPageChange={setPage}
          />
        </div>
      </PageSection>

      <BuyerAddModal
        open={isAddModalOpen}
        isSaving={isSaving}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddBuyer}
      />

      <Modal
        open={deleteMode !== null}
        title={deleteMode === "bulk" ? "Delete Selected Buyers" : "Delete Buyer"}
        description={
          deleteMode === "bulk"
            ? `Delete ${selectedIds.length} selected buyer(s)? This action cannot be undone.`
            : deleteTarget
              ? `Delete buyer "${deleteTarget.name}"? This action cannot be undone.`
              : undefined
        }
        onClose={closeDeleteModal}
        actions={
          <>
            <CancelButton type="button" disabled={isDeleting} onClick={closeDeleteModal} />
            <DangerButton type="button" disabled={isDeleting} onClick={() => void handleDelete()}>
              {isDeleting ? "Deleting..." : "Delete"}
            </DangerButton>
          </>
        }
      />
    </div>
  );
}
