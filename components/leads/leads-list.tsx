"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PrimaryButton } from "@/components/ui/form-controls";
import { ListTableToolbar } from "@/components/ui/list-table-toolbar";
import { Modal } from "@/components/ui/modal";
import { ListTableContainer } from "@/components/ui/list-table-container";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageSection } from "@/components/ui/state";
import { toast } from "@/lib/toast";
import { useListLoadState } from "@/lib/use-list-load-state";

type LeadRow = {
  id: string;
  sellerName: string;
  rawData: string;
  status: "Accept" | "Reject";
  postedAt: string;
  userAgent: string;
  reasons: string[];
};

type LeadListResponse = {
  items: LeadRow[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

const RAW_DATA_PREVIEW_LIMIT = 50;

function getRawDataPreview(rawData: string) {
  if (rawData.length <= RAW_DATA_PREVIEW_LIMIT) {
    return rawData;
  }

  return `${rawData.slice(0, RAW_DATA_PREVIEW_LIMIT)}...`;
}

function formatRawData(rawData: string) {
  try {
    return JSON.stringify(JSON.parse(rawData), null, 2);
  } catch {
    return rawData;
  }
}

function formatPostedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

export function LeadsList() {
  const [rows, setRows] = useState<LeadRow[]>([]);
  const { isInitialLoad, isRefreshing, beginLoad, endLoad } = useListLoadState();
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedRawData, setSelectedRawData] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const columns: Column<LeadRow>[] = [
    {
      key: "sellerName",
      label: "Seller",
      render: (row) => <span className="font-medium text-slate-800">{row.sellerName}</span>,
    },
    {
      key: "rawData",
      label: "Raw Data",
      render: (row) => {
        const isTruncated = row.rawData.length > RAW_DATA_PREVIEW_LIMIT;

        return (
          <div className="max-w-lg space-y-2">
            <pre className="rounded-xl bg-slate-50 p-3 whitespace-pre-wrap break-words text-xs leading-5 text-slate-700 dark:bg-slate-800 dark:text-slate-100">
              {getRawDataPreview(row.rawData)}
            </pre>
            {isTruncated ? (
              <button
                type="button"
                onClick={() => setSelectedRawData(row.rawData)}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-300 dark:hover:text-blue-200"
              >
                Show Full Raw Data
              </button>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "postedAt",
      label: "Posted At",
      sortValue: (row) => new Date(row.postedAt).getTime(),
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">{row.postedAt ? formatPostedAt(row.postedAt) : ""}</span>
      ),
    },
    {
      key: "userAgent",
      label: "User Agent",
      render: (row) => (
        <div className="max-w-xs rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700 break-words dark:bg-slate-800 dark:text-slate-100">
          {row.userAgent || <span className="text-slate-400 dark:text-slate-400">Unknown</span>}
        </div>
      ),
    },
    {
      key: "reasons",
      label: "Reasons",
      sortValue: (row) => row.reasons.join(", "),
      render: (row) =>
        row.reasons.length > 0 ? (
          <ul className="max-w-sm space-y-2 text-xs text-red-600 dark:text-red-200">
            {row.reasons.map((error) => (
              <li key={error} className="rounded-lg bg-red-50 px-3 py-2 leading-5 dark:bg-red-500/15">
                {error}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-xs text-slate-500 dark:text-slate-300">None</span>
        ),
    },
  ];

  const visibleRowIds = useMemo(() => rows.map((row) => row.id), [rows]);

  const fetchLeads = useCallback(
    async () => {
      beginLoad();

      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
          search,
        });
        const response = await fetch(`/api/leads?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to fetch leads.");
        }

        const data = (await response.json()) as LeadListResponse;
        if (data.totalItems === 0 && page !== 1) {
          setPage(1);
          return;
        }

        if (page > data.totalPages) {
          setPage(data.totalPages);
          return;
        }

        setRows(data.items);
        setTotalItems(data.totalItems);
        setTotalPages(data.totalPages);
        setSelectedIds((current) => current.filter((id) => data.items.some((row) => row.id === id)));
      } finally {
        endLoad();
      }
    },
    [beginLoad, endLoad, page, pageSize, search]
  );

  useEffect(() => {
    void fetchLeads();
  }, [fetchLeads]);

  const toggleRowSelection = (rowId: string) => {
    setSelectedIds((current) => (current.includes(rowId) ? current.filter((id) => id !== rowId) : [...current, rowId]));
  };

  const toggleAllVisibleRows = (checked: boolean) => {
    setSelectedIds((current) => {
      if (checked) {
        return Array.from(new Set([...current, ...visibleRowIds]));
      }

      return current.filter((id) => !visibleRowIds.includes(id));
    });
  };

  const handleDelete = async (mode: "selected" | "all") => {
    const isDeleteAll = mode === "all";
    const hasSelectedRows = selectedIds.length > 0;
    if (!isDeleteAll && !hasSelectedRows) {
      return;
    }

    const confirmed = window.confirm(
      isDeleteAll
        ? "Delete all leads? This action cannot be undone."
        : `Delete ${selectedIds.length} selected lead(s)? This action cannot be undone.`
    );
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch("/api/leads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isDeleteAll ? { deleteAll: true } : { ids: selectedIds }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(data?.message || "Failed to delete leads.");
      }

      setSelectedIds([]);
      if (isDeleteAll) {
        setPage(1);
      }
      await fetchLeads();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete leads.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRefresh = async () => {
    await fetchLeads();
  };

  const showingFrom = rows.length > 0 ? (page - 1) * pageSize + 1 : 0;
  const showingTo = rows.length > 0 ? Math.min(page * pageSize, totalItems) : 0;

  return (
    <PageSection>
      <div className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <ListTableToolbar
            pageSize={pageSize}
            pageSizeOptions={[15, 50]}
            onPageSizeChange={(value) => {
              setPageSize(value);
              setPage(1);
            }}
            showingFrom={showingFrom}
            showingTo={showingTo}
            totalItems={totalItems}
            tableFilter={search}
            onTableFilterChange={(value) => {
              setSearch(value);
              setPage(1);
              setSelectedIds([]);
            }}
            filterPlaceholder="Seller, status, agent..."
            selectedCount={selectedIds.length}
            actions={
              <>
                <button
                  type="button"
                  onClick={() => void handleRefresh()}
                  disabled={isInitialLoad || isRefreshing || isDeleting}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                >
                  {isRefreshing ? "Refreshing..." : "Refresh"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete("selected")}
                  disabled={selectedIds.length === 0 || isInitialLoad || isRefreshing || isDeleting}
                  className="rounded-xl border border-amber-300 px-3 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-700/70 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/15"
                >
                  Delete Selected ({selectedIds.length})
                </button>
                <PrimaryButton
                  type="button"
                  onClick={() => void handleDelete("all")}
                  disabled={totalItems === 0 || isInitialLoad || isRefreshing || isDeleting}
                  className="bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400"
                >
                  {isDeleting ? "Deleting..." : "Delete All"}
                </PrimaryButton>
              </>
            }
          />

          <ListTableContainer
            isInitialLoad={isInitialLoad}
            isRefreshing={isRefreshing}
            loadingMessage="Loading leads..."
          >
            <DataTable<LeadRow>
              columns={columns}
              rows={rows}
              emptyMessage="No leads available yet."
              selectedRowIds={selectedIds}
              onToggleRow={toggleRowSelection}
              onToggleAllRows={toggleAllVisibleRows}
            />
          </ListTableContainer>
        </div>

        <PaginationControls
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageSizeChange={(value) => {
            setPageSize(value);
            setPage(1);
          }}
          onPageChange={setPage}
        />
      </div>
      <Modal
        open={selectedRawData !== null}
        title="Full Raw Data"
        description="Formatted JSON view for the selected lead payload."
        onClose={() => setSelectedRawData(null)}
        panelClassName="max-w-4xl"
        actions={
          <button
            type="button"
            onClick={() => setSelectedRawData(null)}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 dark:bg-blue-500 dark:text-white dark:hover:bg-blue-400"
          >
            Close
          </button>
        }
      >
        {selectedRawData ? (
          <pre className="max-h-[70vh] overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-800">
            {formatRawData(selectedRawData)}
          </pre>
        ) : null}
      </Modal>
    </PageSection>
  );
}
