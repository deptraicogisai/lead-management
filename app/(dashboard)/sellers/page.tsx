"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { SellerForm } from "@/components/forms/seller-form";
import { ClearButton, DetailNameLink, ExportButton, SearchButton } from "@/components/ui/action-buttons";
import { DataTable, type Column } from "@/components/ui/data-table";
import { IdBadge } from "@/components/ui/id-badge";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { FieldLabel, Input } from "@/components/ui/form-controls";
import { buildEmptySearchDateRange, parseDateTimeValue } from "@/lib/date-range";
import { ListTableContainer } from "@/components/ui/list-table-container";
import { ListTableToolbar } from "@/components/ui/list-table-toolbar";
import { Modal } from "@/components/ui/modal";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageSection } from "@/components/ui/state";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatBuyerCreated } from "@/lib/buyer";
import type { Seller } from "@/lib/mock-data";
import { useListLoadState } from "@/lib/use-list-load-state";

type SellerListResponse = {
  items: Seller[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

const STATUS_FILTER_OPTIONS = ["All", "Active", "Inactive"] as const;
const emptyDateRange = buildEmptySearchDateRange();

function apiConfigHref(row: Seller) {
  return `/api-config?sellerId=${encodeURIComponent(row.id)}&sellerName=${encodeURIComponent(row.name)}`;
}

export default function SellersPage() {
  const [sellerRows, setSellerRows] = useState<Seller[]>([]);
  const [editingSellerId, setEditingSellerId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { isInitialLoad, isRefreshing, beginLoad, endLoad } = useListLoadState();
  const [deleteTarget, setDeleteTarget] = useState<Seller | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [tableFilter, setTableFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTER_OPTIONS)[number]>("All");
  const [nameEmailFilter, setNameEmailFilter] = useState("");
  const [dateFrom, setDateFrom] = useState(emptyDateRange.from);
  const [dateTo, setDateTo] = useState(emptyDateRange.to);

  const [appliedFilters, setAppliedFilters] = useState({
    statusFilter: "All" as (typeof STATUS_FILTER_OPTIONS)[number],
    nameEmail: "",
    dateFrom: emptyDateRange.from,
    dateTo: emptyDateRange.to,
  });

  const editingSeller = sellerRows.find((seller) => seller.id === editingSellerId) ?? null;

  useEffect(() => {
    const fetchSellers = async () => {
      beginLoad();
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        });
        const search = appliedFilters.nameEmail.trim();
        if (search) {
          params.set("search", search);
        }
        const response = await fetch(`/api/sellers?${params.toString()}`);
        if (!response.ok) return;

        const data = (await response.json()) as SellerListResponse;
        setSellerRows(data.items);
        setTotalItems(data.totalItems);
        setTotalPages(data.totalPages);
      } finally {
        endLoad();
      }
    };

    void fetchSellers();
  }, [page, pageSize, reloadKey, appliedFilters.nameEmail]);

  const filteredRows = useMemo(() => {
    const fromDate = parseDateTimeValue(appliedFilters.dateFrom);
    const toDate = parseDateTimeValue(appliedFilters.dateTo);

    return sellerRows.filter((row) => {
      const matchesStatus =
        appliedFilters.statusFilter === "All" ? true : row.status === appliedFilters.statusFilter;

      const nameEmailSearch = appliedFilters.nameEmail.trim().toLowerCase();
      const matchesNameEmail = nameEmailSearch
        ? row.name.toLowerCase().includes(nameEmailSearch) || row.email.toLowerCase().includes(nameEmailSearch)
        : true;

      const createdAt = row.createdAt ? new Date(row.createdAt) : null;
      const matchesDateFrom = !fromDate || !createdAt ? true : createdAt >= fromDate;
      const matchesDateTo = !toDate || !createdAt ? true : createdAt <= toDate;

      const search = tableFilter.trim().toLowerCase();
      const matchesTableFilter = search
        ? row.name.toLowerCase().includes(search) ||
          row.email.toLowerCase().includes(search) ||
          row.status.toLowerCase().includes(search) ||
          String(row.displayId ?? "").includes(search)
        : true;

      return matchesStatus && matchesNameEmail && matchesDateFrom && matchesDateTo && matchesTableFilter;
    });
  }, [sellerRows, appliedFilters, tableFilter]);

  const handleSearch = () => {
    setAppliedFilters({
      statusFilter,
      nameEmail: nameEmailFilter.trim(),
      dateFrom,
      dateTo,
    });
    setPage(1);
  };

  const clearFilters = () => {
    const resetDateRange = buildEmptySearchDateRange();
    setStatusFilter("All");
    setNameEmailFilter("");
    setDateFrom(resetDateRange.from);
    setDateTo(resetDateRange.to);
    setTableFilter("");
    setAppliedFilters({
      statusFilter: "All",
      nameEmail: "",
      dateFrom: resetDateRange.from,
      dateTo: resetDateRange.to,
    });
    setSelectedIds([]);
    setPage(1);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    const response = await fetch(`/api/sellers/${encodeURIComponent(deleteTarget.id)}`, { method: "DELETE" });
    if (!response.ok) return;

    if (editingSellerId === deleteTarget.id) {
      setEditingSellerId(null);
      setIsFormOpen(false);
    }
    setDeleteTarget(null);
    if (sellerRows.length === 1 && page > 1) {
      setPage((prev) => prev - 1);
    } else {
      setReloadKey((prev) => prev + 1);
    }
  };

  const handleEdit = (row: Seller) => {
    setEditingSellerId(row.id);
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setEditingSellerId(null);
    setIsFormOpen(true);
  };

  const closeFormModal = () => {
    setEditingSellerId(null);
    setIsFormOpen(false);
  };

  const handleSubmitSeller = async (values: { name: string; email: string; status: Seller["status"] }) => {
    if (editingSellerId) {
      const response = await fetch(`/api/sellers/${encodeURIComponent(editingSellerId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) return;

      closeFormModal();
      setReloadKey((prev) => prev + 1);
      return;
    }

    const response = await fetch("/api/sellers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!response.ok) return;

    closeFormModal();
    setPage(1);
    setReloadKey((prev) => prev + 1);
  };

  const toggleRow = (rowId: string) => {
    setSelectedIds((current) => (current.includes(rowId) ? current.filter((id) => id !== rowId) : [...current, rowId]));
  };

  const toggleAllRows = (checked: boolean) => {
    setSelectedIds(checked ? filteredRows.map((row) => row.id) : []);
  };

  const columns: Column<Seller>[] = [
    {
      key: "id",
      label: "ID",
      sortValue: (row) => row.displayId ?? 0,
      render: (row) => (
        <Link href={apiConfigHref(row)} className="group inline-flex">
          <IdBadge id={row.displayId ?? "-"} interactive />
        </Link>
      ),
    },
    {
      key: "name",
      label: "Name",
      render: (row) => <DetailNameLink href={apiConfigHref(row)}>{row.name}</DetailNameLink>,
    },
    {
      key: "email",
      label: "Email",
      render: (row) => <span className="text-xs text-slate-700 dark:text-slate-200">{row.email}</span>,
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
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <Link
            href={apiConfigHref(row)}
            className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            API Config
          </Link>
          <button
            type="button"
            onClick={() => handleEdit(row)}
            className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(row)}
            className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200 dark:hover:bg-red-500/20"
          >
            Delete
          </button>
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
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Status</label>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as (typeof STATUS_FILTER_OPTIONS)[number])}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50"
                >
                  {STATUS_FILTER_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel htmlFor="publisher-name-email" label="Name / Email" />
                <Input
                  id="publisher-name-email"
                  value={nameEmailFilter}
                  onChange={(event) => setNameEmailFilter(event.target.value)}
                  placeholder="Search by name or email"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleSearch();
                    }
                  }}
                />
              </div>

              <div>
                <FieldLabel htmlFor="publisher-date-range" label="Date" />
                <DateRangePicker
                  id="publisher-date-range"
                  value={{ from: dateFrom, to: dateTo }}
                  onChange={(range) => {
                    setDateFrom(range.from);
                    setDateTo(range.to);
                  }}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
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
                  <ExportButton disabled />
                  <button
                    type="button"
                    onClick={handleCreate}
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-700 bg-emerald-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600"
                  >
                    <Plus size={15} />
                    Add New Publisher
                  </button>
                </>
              }
            />

            <ListTableContainer
              isInitialLoad={isInitialLoad}
              isRefreshing={isRefreshing}
              loadingMessage="Loading publishers..."
            >
              <DataTable<Seller>
                columns={columns}
                rows={filteredRows}
                emptyMessage="No publishers found."
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

      <Modal
        open={isFormOpen}
        title={editingSeller ? `Edit Publisher - ${editingSeller.name}` : "Create Publisher"}
        onClose={closeFormModal}
        panelClassName="max-w-2xl"
      >
        <SellerForm
          key={editingSellerId ?? "create-seller"}
          initialValues={
            editingSeller
              ? {
                  name: editingSeller.name,
                  email: editingSeller.email,
                  status: editingSeller.status,
                }
              : undefined
          }
          isEditing={Boolean(editingSeller)}
          onCancelEdit={closeFormModal}
          onSubmitSeller={handleSubmitSeller}
        />
      </Modal>

      <Modal
        open={deleteTarget !== null}
        title="Delete Publisher"
        description={deleteTarget ? `Delete publisher "${deleteTarget.name}"?` : undefined}
        onClose={() => setDeleteTarget(null)}
        actions={
          <>
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 dark:bg-red-500 dark:text-white dark:hover:bg-red-400"
            >
              Delete
            </button>
          </>
        }
      />
    </div>
  );
}
