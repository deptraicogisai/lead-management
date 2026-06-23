"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClearButton, SearchButton, TableActionButton } from "@/components/ui/action-buttons";
import { BuyerHttpLogSidebar } from "@/components/logs/buyer-http-log-sidebar";
import { DataTable, type Column } from "@/components/ui/data-table";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { FieldLabel, Input } from "@/components/ui/form-controls";
import { ListTableContainer } from "@/components/ui/list-table-container";
import { ListTableToolbar } from "@/components/ui/list-table-toolbar";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageSection } from "@/components/ui/state";
import { StatusBadge } from "@/components/ui/status-badge";
import { REPORT_PAGE_SIZE_OPTIONS } from "@/lib/pagination";
import { resolveBuyerHttpExchangeFromLog } from "@/lib/buyer-http-log";
import { useListLoadState } from "@/lib/use-list-load-state";
import {
  defaultBuyerLeadDetailsFilters,
  formatBuyerLeadPrice,
  formatBuyerLeadStatusLabel,
  formatBuyerLeadTime,
  buildBuyerLeadDisplayCode,
  type BuyerLeadDetailsFilters,
  type BuyerLeadDetailsRow,
} from "@/lib/buyer-lead-details";

type BuyerLeadDetailsResponse = {
  rows: BuyerLeadDetailsRow[];
  total: number;
  page: number;
  pageSize: number;
};

const STATUS_OPTIONS = ["All", "Accept", "Reject", "Skipped", "Error", "Timeout"];

function buildDefaultFilters(): BuyerLeadDetailsFilters {
  return { ...defaultBuyerLeadDetailsFilters };
}

export function BuyerLeadDetailsPage() {
  const [draftFilters, setDraftFilters] = useState<BuyerLeadDetailsFilters>(() => buildDefaultFilters());
  const [appliedFilters, setAppliedFilters] = useState<BuyerLeadDetailsFilters>(() => buildDefaultFilters());
  const [rows, setRows] = useState<BuyerLeadDetailsRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(100);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const { isInitialLoad, isRefreshing, beginLoad, endLoad } = useListLoadState();
  const [viewRow, setViewRow] = useState<BuyerLeadDetailsRow | null>(null);

  const updateDraft = (patch: Partial<BuyerLeadDetailsFilters>) => {
    setDraftFilters((current) => ({ ...current, ...patch }));
  };

  const buildQuery = useCallback(
    (filters: BuyerLeadDetailsFilters, nextPage: number, nextPageSize: number) => {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(nextPageSize),
      });

      if (filters.leadId.trim()) params.set("leadId", filters.leadId.trim());
      if (filters.buyerId.trim()) params.set("buyerId", filters.buyerId.trim());
      if (filters.campaignId.trim()) params.set("campaignId", filters.campaignId.trim());
      if (filters.status !== "All") params.set("status", filters.status);
      if (filters.dateFrom) params.set("dateFrom", new Date(filters.dateFrom).toISOString());
      if (filters.dateTo) params.set("dateTo", new Date(filters.dateTo).toISOString());
      if (filters.tableSearch.trim()) params.set("tableSearch", filters.tableSearch.trim());

      return params.toString();
    },
    []
  );

  const loadRows = useCallback(
    async (filters: BuyerLeadDetailsFilters, nextPage: number, nextPageSize: number) => {
      beginLoad();

      try {
        const response = await fetch(`/api/reports/buyer/lead-details?${buildQuery(filters, nextPage, nextPageSize)}`);
        if (!response.ok) {
          throw new Error("Failed to load buyer lead details.");
        }

        const data = (await response.json()) as BuyerLeadDetailsResponse;
        setRows(
          data.rows.map((row) => ({
            ...row,
            displayLeadCode: buildBuyerLeadDisplayCode(row.leadId),
          }))
        );
        setTotalItems(data.total);
        setTotalPages(Math.max(1, Math.ceil(data.total / nextPageSize)));
      } finally {
        endLoad();
      }
    },
    [buildQuery, beginLoad, endLoad]
  );

  useEffect(() => {
    void loadRows(appliedFilters, page, pageSize);
  }, [appliedFilters, page, pageSize, loadRows]);

  const handleSearch = () => {
    setAppliedFilters({ ...draftFilters });
    setPage(1);
  };

  const handleClearAll = () => {
    const defaults = buildDefaultFilters();
    setDraftFilters(defaults);
    setAppliedFilters(defaults);
    setPage(1);
  };

  const columns: Column<BuyerLeadDetailsRow>[] = useMemo(
    () => [
      {
        key: "displayLeadCode",
        label: "Lead ID",
        sortValue: (row) => row.displayLeadCode,
        render: (row) => (
          <div className="flex items-center gap-2 whitespace-nowrap">
            <TableActionButton type="button" onClick={() => setViewRow(row)}>
              Log
            </TableActionButton>
            <span className="font-mono text-xs">{row.displayLeadCode}</span>
          </div>
        ),
      },
      {
        key: "postedAt",
        label: "Posted Date",
        sortValue: (row) => row.postedAt,
        render: (row) => formatBuyerLeadTime(row.postedAt),
      },
      {
        key: "campaignName",
        label: "Campaign",
        sortValue: (row) => row.campaignName,
        render: (row) =>
          row.campaignDisplayId ? `[${row.campaignDisplayId}] ${row.campaignName}` : row.campaignName || "—",
      },
      {
        key: "pingTreeType",
        label: "Type",
        sortValue: (row) => row.pingTreeType,
        render: (row) => row.pingTreeType,
      },
      {
        key: "buyerCompany",
        label: "Buyer",
        sortValue: (row) => row.buyerCompany,
        render: (row) => row.buyerCompany || "—",
      },
      {
        key: "buyerStatus",
        label: "Status",
        sortValue: (row) => row.buyerStatus,
        render: (row) => (
          <StatusBadge
            status={row.buyerStatus}
            label={formatBuyerLeadStatusLabel(row.buyerStatus)}
          />
        ),
      },
      {
        key: "price",
        label: "Price",
        sortValue: (row) => row.price ?? 0,
        render: (row) => formatBuyerLeadPrice(row.price),
      },
      {
        key: "postLeadUrl",
        label: "Post URL",
        sortValue: (row) => row.postLeadUrl,
        render: (row) => (
          <span className="block max-w-xs truncate font-mono text-xs" title={row.postLeadUrl}>
            {row.postLeadUrl || "—"}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <PageSection title="Buyer Lead Details">
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900/70">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <FieldLabel htmlFor="buyer-lead-id" label="Lead ID" />
              <Input
                id="buyer-lead-id"
                value={draftFilters.leadId}
                onChange={(event) => updateDraft({ leadId: event.target.value })}
                placeholder="Mongo lead id"
              />
            </div>
            <div>
              <FieldLabel htmlFor="buyer-lead-buyer-id" label="Buyer ID" />
              <Input
                id="buyer-lead-buyer-id"
                value={draftFilters.buyerId}
                onChange={(event) => updateDraft({ buyerId: event.target.value })}
                placeholder="Buyer id"
              />
            </div>
            <div>
              <FieldLabel htmlFor="buyer-lead-campaign-id" label="Campaign ID" />
              <Input
                id="buyer-lead-campaign-id"
                value={draftFilters.campaignId}
                onChange={(event) => updateDraft({ campaignId: event.target.value })}
                placeholder="Campaign id"
              />
            </div>
            <div>
              <FieldLabel htmlFor="buyer-lead-status" label="Status" />
              <select
                id="buyer-lead-status"
                value={draftFilters.status}
                onChange={(event) => updateDraft({ status: event.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 xl:col-span-2">
              <FieldLabel htmlFor="buyer-lead-date-range" label="Posted Date" />
              <DateRangePicker
                id="buyer-lead-date-range"
                value={{ from: draftFilters.dateFrom, to: draftFilters.dateTo }}
                onChange={(range) => updateDraft({ dateFrom: range.from, dateTo: range.to })}
              />
            </div>
            <div className="md:col-span-2 xl:col-span-2">
              <FieldLabel htmlFor="buyer-lead-search" label="Search" />
              <Input
                id="buyer-lead-search"
                value={draftFilters.tableSearch}
                onChange={(event) => updateDraft({ tableSearch: event.target.value })}
                placeholder="Campaign, buyer, post URL..."
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
            <SearchButton type="button" onClick={handleSearch} />
            <ClearButton type="button" onClick={handleClearAll} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <ListTableToolbar
            showingFrom={rows.length === 0 ? 0 : (page - 1) * pageSize + 1}
            showingTo={rows.length === 0 ? 0 : (page - 1) * pageSize + rows.length}
            totalItems={totalItems}
            pageSize={pageSize}
            pageSizeOptions={[...REPORT_PAGE_SIZE_OPTIONS]}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize);
              setPage(1);
            }}
          />

          <ListTableContainer
            isInitialLoad={isInitialLoad}
            isRefreshing={isRefreshing}
            loadingMessage="Loading buyer lead details..."
          >
            <DataTable columns={columns} rows={rows} emptyMessage="No buyer deliveries found." />

            <div className="mt-4">
              <PaginationControls
                page={page}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
                pageSizeOptions={[...REPORT_PAGE_SIZE_OPTIONS]}
                onPageChange={setPage}
                onPageSizeChange={(nextPageSize) => {
                  setPageSize(nextPageSize);
                  setPage(1);
                }}
              />
            </div>
          </ListTableContainer>
        </div>
      </div>

      <BuyerHttpLogSidebar
        open={Boolean(viewRow)}
        onClose={() => setViewRow(null)}
        title={viewRow ? `Buyer Post Log — ${viewRow.displayLeadCode}` : "Buyer Post Log"}
        subtitle={
          viewRow
            ? `${viewRow.campaignName || "Campaign"} | ${viewRow.buyerCompany || "Buyer"} | ${viewRow.pingTreeType}`
            : undefined
        }
        postedAt={viewRow ? formatBuyerLeadTime(viewRow.postedAt) : undefined}
        buyerStatus={viewRow ? formatBuyerLeadStatusLabel(viewRow.buyerStatus) : undefined}
        httpStatus={viewRow?.httpStatus}
        postLeadUrl={viewRow?.postLeadUrl}
        log={
          viewRow
            ? resolveBuyerHttpExchangeFromLog({
                requestPayload: viewRow.requestPayload,
                responseBody: viewRow.responseBody,
                responseHeaders: viewRow.responseHeaders,
                httpStatus: viewRow.httpStatus,
                errorMessage: viewRow.errorReason || viewRow.rejectReason,
              })
            : { request: null, response: null }
        }
      />
    </PageSection>
  );
}
