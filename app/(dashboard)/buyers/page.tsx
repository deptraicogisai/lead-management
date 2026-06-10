"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CircleHelp, Plus } from "lucide-react";
import { BuyerAddModal } from "@/components/buyers/buyer-add-modal";
import { ClearButton, DetailNameLink, ExportButton, SearchButton } from "@/components/ui/action-buttons";
import { DataTable, type Column } from "@/components/ui/data-table";
import { IdBadge } from "@/components/ui/id-badge";
import { Input } from "@/components/ui/form-controls";
import { ListTableContainer } from "@/components/ui/list-table-container";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageSection } from "@/components/ui/state";
import { PAGE_SIZE_OPTIONS } from "@/lib/pagination";
import { useListLoadState } from "@/lib/use-list-load-state";
import {
  BUYER_MANAGER_OPTIONS,
  formatBuyerCreated,
  type BuyerCreatePayload,
  type BuyerListRecord,
} from "@/lib/buyer";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

type BuyerListResponse = {
  items: BuyerListRecord[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

function parseDateInput(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

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
  const [reloadKey, setReloadKey] = useState(0);

  const [agentFilter, setAgentFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("2000-01-01");
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));

  const [appliedFilters, setAppliedFilters] = useState({
    agentFilter: "All",
    dateFrom: "2000-01-01",
    dateTo: new Date().toISOString().slice(0, 10),
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
    const fromDate = parseDateInput(appliedFilters.dateFrom);
    const toDate = parseDateInput(appliedFilters.dateTo);

    return buyerRows.filter((row) => {
      const matchesAgent =
        appliedFilters.agentFilter === "All" ? true : row.personalManagerId === appliedFilters.agentFilter;

      const createdAt = row.createdAt ? new Date(row.createdAt) : null;
      const matchesDateFrom = !fromDate || !createdAt ? true : createdAt >= fromDate;
      const matchesDateTo = !toDate || !createdAt ? true : createdAt <= new Date(`${appliedFilters.dateTo}T23:59:59`);

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
    const today = new Date().toISOString().slice(0, 10);
    setAgentFilter("All");
    setDateFrom("2000-01-01");
    setDateTo(today);
    setTableFilter("");
    setAppliedFilters({
      agentFilter: "All",
      dateFrom: "2000-01-01",
      dateTo: today,
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

      if (!response.ok) return;

      setIsAddModalOpen(false);
      setPage(1);
      setReloadKey((current) => current + 1);
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
      render: (row) => <span className="whitespace-nowrap text-xs">{formatBuyerCreated(row.createdAt)}</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusBadge status={row.status} variant="outline" />,
    },
    {
      key: "integrations",
      label: "Integrations",
      render: (row) => (
        <div className="max-w-xs space-y-1 text-xs text-slate-700 dark:text-slate-200">
          {row.integrations.length > 0 ? row.integrations.map((item) => <p key={item}>{item}</p>) : <span>-</span>}
        </div>
      ),
    },
  ];

  const showingFrom = filteredRows.length > 0 ? (page - 1) * pageSize + 1 : 0;
  const showingTo = filteredRows.length > 0 ? Math.min(page * pageSize, totalItems) : 0;

  return (
    <div className="space-y-6">
      <PageSection title="Buyer List">
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
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Date Range</label>
                <div className="flex items-center gap-2">
                  <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
                  <span className="text-sm text-slate-500">-</span>
                  <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <SearchButton onClick={handleSearch} />
              <ClearButton onClick={clearFilters} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                  {[15, 50].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => {
                        setPageSize(size);
                        setPage(1);
                      }}
                      className={cn(
                        "px-3 py-2 text-sm font-medium transition",
                        pageSize === size
                          ? "bg-emerald-800 text-white dark:bg-emerald-600"
                          : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  Showing <span className="font-semibold text-slate-900 dark:text-slate-100">{showingFrom}</span> to{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{showingTo}</span> of{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{totalItems}</span> entries
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <CircleHelp size={14} />
                  <span>Filter:</span>
                  <input
                    type="text"
                    value={tableFilter}
                    onChange={(event) => setTableFilter(event.target.value)}
                    className="w-28 border-none bg-transparent text-sm outline-none dark:text-slate-100"
                    placeholder=""
                  />
                </div>
                <ExportButton disabled />
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-700 bg-emerald-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600"
                >
                  <Plus size={15} />
                  Add New Buyer
                </button>
                {selectedIds.length > 0 ? (
                  <span className="inline-flex items-center rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                    {selectedIds.length} selected
                  </span>
                ) : null}
              </div>
            </div>

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
    </div>
  );
}
