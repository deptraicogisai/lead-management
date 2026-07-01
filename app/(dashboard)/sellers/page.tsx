"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SellerForm } from "@/components/forms/seller-form";
import {
  AddNewButton,
  CancelButton,
  ClearButton,
  DangerButton,
  DetailNameLink,
  ExportButton,
  SearchButton,
  TableActionButton,
  TableActionLink,
} from "@/components/ui/action-buttons";
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
import { StatusMultiSelect } from "@/components/ui/status-multi-select";
import { PublisherTagBadges } from "@/components/ui/publisher-tag-badges";
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

const STATUS_FILTER_OPTIONS = ["All", "Active", "Inactive", "Deleted"] as const;
const SELLER_STATUS_MULTI_OPTIONS = STATUS_FILTER_OPTIONS.filter((option) => option !== "All").map(
  (option) => ({ value: option, label: option })
);
const emptyDateRange = buildEmptySearchDateRange();

function apiConfigHref(row: Seller) {
  return `/api-config?sellerId=${encodeURIComponent(row.id)}&sellerName=${encodeURIComponent(row.name)}`;
}

function sellerDetailHref(row: Seller) {
  return `/sellers/${encodeURIComponent(row.id)}`;
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

  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [nameEmailFilter, setNameEmailFilter] = useState("");
  const [dateFrom, setDateFrom] = useState(emptyDateRange.from);
  const [dateTo, setDateTo] = useState(emptyDateRange.to);

  const [appliedFilters, setAppliedFilters] = useState({
    statusFilter: [] as string[],
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
        const statusValues =
          appliedFilters.statusFilter.length > 0
            ? appliedFilters.statusFilter
            : SELLER_STATUS_MULTI_OPTIONS.map((option) => option.value);
        params.set("status", statusValues.join(","));
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
  }, [page, pageSize, reloadKey, appliedFilters.nameEmail, appliedFilters.statusFilter]);

  const filteredRows = useMemo(() => {
    const fromDate = parseDateTimeValue(appliedFilters.dateFrom);
    const toDate = parseDateTimeValue(appliedFilters.dateTo);

    return sellerRows.filter((row) => {
      const matchesStatus =
        appliedFilters.statusFilter.length === 0
          ? true
          : appliedFilters.statusFilter.includes(row.status);

      const nameEmailSearch = appliedFilters.nameEmail.trim().toLowerCase();
      const matchesNameEmail = nameEmailSearch
        ? row.name.toLowerCase().includes(nameEmailSearch) ||
          row.email.toLowerCase().includes(nameEmailSearch) ||
          (row.publisherTag ?? "").toLowerCase().includes(nameEmailSearch)
        : true;

      const createdAt = row.createdAt ? new Date(row.createdAt) : null;
      const matchesDateFrom = !fromDate || !createdAt ? true : createdAt >= fromDate;
      const matchesDateTo = !toDate || !createdAt ? true : createdAt <= toDate;

      const search = tableFilter.trim().toLowerCase();
      const matchesTableFilter = search
        ? row.name.toLowerCase().includes(search) ||
          row.email.toLowerCase().includes(search) ||
          (row.publisherTag ?? "").toLowerCase().includes(search) ||
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
    setStatusFilter([]);
    setNameEmailFilter("");
    setDateFrom(resetDateRange.from);
    setDateTo(resetDateRange.to);
    setTableFilter("");
    setAppliedFilters({
      statusFilter: [],
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

  const handleCreate = () => {
    setEditingSellerId(null);
    setIsFormOpen(true);
  };

  const closeFormModal = () => {
    setEditingSellerId(null);
    setIsFormOpen(false);
  };

  const handleSubmitSeller = async (values: {
    name: string;
    email: string;
    publisherTag: string;
    status: Seller["status"];
  }) => {
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
        <Link href={sellerDetailHref(row)} className="group inline-flex">
          <IdBadge id={row.displayId ?? "-"} interactive />
        </Link>
      ),
    },
    {
      key: "name",
      label: "Name",
      render: (row) => <DetailNameLink href={sellerDetailHref(row)}>{row.name}</DetailNameLink>,
    },
    {
      key: "email",
      label: "Email",
      render: (row) => <span className="text-xs text-slate-700 dark:text-slate-200">{row.email}</span>,
    },
    {
      key: "publisherTag",
      label: "Publisher Tag",
      render: (row) => <PublisherTagBadges tag={row.publisherTag} />,
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
          <TableActionLink href={apiConfigHref(row)}>Channel</TableActionLink>
          <TableActionLink href={sellerDetailHref(row)}>Edit</TableActionLink>
          <TableActionButton variant="danger" onClick={() => setDeleteTarget(row)}>
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
            <div className="grid gap-4 md:grid-cols-3">
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
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Status</label>
                <StatusMultiSelect
                  options={SELLER_STATUS_MULTI_OPTIONS}
                  selected={statusFilter}
                  onChange={setStatusFilter}
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
                  <ExportButton disabled />
                  <AddNewButton type="button" onClick={handleCreate}>
                    Add New Publisher
                  </AddNewButton>
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
                  publisherTag: editingSeller.publisherTag ?? "",
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
            <CancelButton type="button" onClick={() => setDeleteTarget(null)} />
            <DangerButton type="button" onClick={handleDelete}>
              Delete
            </DangerButton>
          </>
        }
      />
    </div>
  );
}
