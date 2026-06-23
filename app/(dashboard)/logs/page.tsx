"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PrimaryButton } from "@/components/ui/form-controls";
import { ListTableToolbar } from "@/components/ui/list-table-toolbar";
import { ListTableContainer } from "@/components/ui/list-table-container";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageSection } from "@/components/ui/state";
import { BuyerHttpLogSidebar } from "@/components/logs/buyer-http-log-sidebar";
import { resolveBuyerHttpExchangeFromLog } from "@/lib/buyer-http-log";
import { toast } from "@/lib/toast";
import { useListLoadState } from "@/lib/use-list-load-state";

type LogRow = {
  id: string;
  requestType: "seller-intake" | "buyer-delivery";
  sellerName: string;
  verticalName: string;
  campaignName: string;
  campaignType: string;
  targetName: string;
  postLeadUrl: string;
  requestPayload: Record<string, unknown>;
  responseBody: string;
  responseHeaders: Record<string, string>;
  errorMessage: string;
  deliveryStatus: "success" | "fail";
  httpStatus: number;
  createdAt: string;
};

type LogListResponse = {
  items: LogRow[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

const PREVIEW_LIMIT = 80;

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

function previewText(value: string) {
  return value.length > PREVIEW_LIMIT ? `${value.slice(0, PREVIEW_LIMIT)}...` : value;
}

function previewPayload(value: Record<string, unknown>) {
  return previewText(JSON.stringify(value));
}

function formatRequestType(value: LogRow["requestType"]) {
  return value === "seller-intake" ? "Seller Intake" : "Buyer Delivery";
}

export default function LogsPage() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const { isInitialLoad, isRefreshing, beginLoad, endLoad } = useListLoadState();
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const visibleRowIds = useMemo(() => rows.map((row) => row.id), [rows]);

  const fetchLogs = useCallback(
    async () => {
      beginLoad();

      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
          search,
        });
        const response = await fetch(`/api/logs?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to fetch logs.");
        }

        const data = (await response.json()) as LogListResponse;
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
    void fetchLogs();
  }, [fetchLogs]);

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
        ? "Delete all request logs? This action cannot be undone."
        : `Delete ${selectedIds.length} selected log item(s)? This action cannot be undone.`
    );
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch("/api/logs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isDeleteAll ? { deleteAll: true } : { ids: selectedIds }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(data?.message || "Failed to delete logs.");
      }

      setSelectedIds([]);
      if (isDeleteAll) {
        setPage(1);
      }
      await fetchLogs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete logs.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRefresh = async () => {
    await fetchLogs();
  };

  const columns: Column<LogRow>[] = [
    {
      key: "requestType",
      label: "Type",
      render: (row) => <StatusBadge status={formatRequestType(row.requestType)} />,
    },
    {
      key: "sellerName",
      label: "Seller",
      render: (row) => <span className="font-medium text-slate-800">{row.sellerName || "-"}</span>,
    },
    { key: "verticalName", label: "Vertical" },
    {
      key: "campaignName",
      label: "Campaign",
      render: (row) => <span className="font-medium text-slate-800 dark:text-slate-100">{row.campaignName || "—"}</span>,
    },
    {
      key: "campaignType",
      label: "Campaign Type",
      render: (row) =>
        row.campaignType ? (
          <StatusBadge status={row.campaignType} />
        ) : (
          <span className="text-xs text-slate-500">—</span>
        ),
    },
    { key: "targetName", label: "Buyer" },
    {
      key: "deliveryStatus",
      label: "Status",
      render: (row) => (
        <StatusBadge status={row.deliveryStatus === "success" ? "Success" : "Fail"} />
      ),
    },
    {
      key: "httpStatus",
      label: "HTTP Status",
      render: (row) => <span className="text-xs text-slate-700">{row.httpStatus || "-"}</span>,
    },
    {
      key: "postLeadUrl",
      label: "Post Lead URL",
      render: (row) => (
        <div className="max-w-sm break-words rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700">
          {row.postLeadUrl}
        </div>
      ),
    },
    {
      key: "requestPayload",
      label: "Posted Data",
      render: (row) => (
        <div className="max-w-sm space-y-2">
          <pre className="rounded-xl bg-slate-50 p-3 whitespace-pre-wrap break-words text-xs leading-5 text-slate-700 dark:bg-slate-800 dark:text-slate-100">
            {previewPayload(row.requestPayload)}
          </pre>
          <button
            type="button"
            onClick={() => setSelectedLog(row)}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-300 dark:hover:text-blue-200"
          >
            Open Log
          </button>
        </div>
      ),
    },
    {
      key: "responseBody",
      label: "Response",
      render: (row) => {
        const responseText = row.errorMessage || row.responseBody || "-";

        return (
          <div className="max-w-sm space-y-2">
            <pre className="rounded-xl bg-slate-50 p-3 whitespace-pre-wrap break-words text-xs leading-5 text-slate-700 dark:bg-slate-800 dark:text-slate-100">
              {previewText(responseText)}
            </pre>
            {responseText !== "-" ? (
              <button
                type="button"
                onClick={() => setSelectedLog(row)}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-300 dark:hover:text-blue-200"
              >
                Open Log
              </button>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "actions",
      label: "Log",
      render: (row) => (
        <button
          type="button"
          onClick={() => setSelectedLog(row)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          View
        </button>
      ),
    },
    {
      key: "createdAt",
      label: "Logged At",
      sortValue: (row) => new Date(row.createdAt).getTime(),
      render: (row) => <span className="whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">{formatDateTime(row.createdAt)}</span>,
    },
  ];

  const showingFrom = rows.length > 0 ? (page - 1) * pageSize + 1 : 0;
  const showingTo = rows.length > 0 ? Math.min(page * pageSize, totalItems) : 0;

  return (
    <PageSection title="Logs">
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
            filterPlaceholder="Type, seller, campaign, buyer, URL..."
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
            loadingMessage="Loading logs..."
          >
            <DataTable<LogRow>
              columns={columns}
              rows={rows}
              emptyMessage="No request logs yet."
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

      <BuyerHttpLogSidebar
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title={selectedLog ? `Buyer Log — ${selectedLog.targetName}` : "Buyer Log"}
        subtitle={
          selectedLog
            ? `${formatRequestType(selectedLog.requestType)} | ${selectedLog.sellerName || "—"} | ${selectedLog.verticalName || "—"}`
            : undefined
        }
        postedAt={selectedLog ? formatDateTime(selectedLog.createdAt) : undefined}
        deliveryStatus={selectedLog?.deliveryStatus}
        httpStatus={selectedLog?.httpStatus}
        postLeadUrl={selectedLog?.postLeadUrl}
        log={
          selectedLog
            ? resolveBuyerHttpExchangeFromLog({
                requestPayload: selectedLog.requestPayload,
                responseBody: selectedLog.responseBody,
                responseHeaders: selectedLog.responseHeaders,
                httpStatus: selectedLog.httpStatus,
                errorMessage: selectedLog.errorMessage,
              })
            : { request: null, response: null }
        }
      />
    </PageSection>
  );
}
