"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, Download, Eye } from "lucide-react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { FieldLabel, Input } from "@/components/ui/form-controls";
import {
  SEARCH_FILTER_CONTROL_CLASS,
  SEARCH_FILTER_DATE_RANGE_CLASS,
  SearchFilterActions,
  SearchFilterField,
  SearchFilterGrid,
  SearchFilterPanel,
  SearchFilterSelect,
} from "@/components/ui/search-filter-layout";
import { Modal } from "@/components/ui/modal";
import { ListTableContainer } from "@/components/ui/list-table-container";
import { ListTableToolbar } from "@/components/ui/list-table-toolbar";
import { ToolbarDropdownMenu, toolbarDropdownItemClassName } from "@/components/ui/toolbar-dropdown-menu";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageSection } from "@/components/ui/state";
import { REPORT_PAGE_SIZE_OPTIONS } from "@/lib/pagination";
import { downloadCsv } from "@/lib/csv-export";
import { useListLoadState } from "@/lib/use-list-load-state";
import {
  defaultPublisherLeadDetailsFilters,
  formatPayloadFieldValue,
  formatPublisherLeadTableTime,
  formatPublisherLeadTime,
  parsePublisherLeadDetailsFiltersFromSearchParams,
  type PublisherLeadDetailsFilters,
  type PublisherLeadDetailsRow,
  type PublisherLeadFieldColumn,
} from "@/lib/publisher-lead-details";
import { StatusBadge } from "@/components/ui/status-badge";
import { getStatusBadgePresentation } from "@/lib/status-badge";
import { IdBadge } from "@/components/ui/id-badge";
import { toolbarPrimaryButtonClassName } from "@/lib/button-styles";
import { cn } from "@/lib/utils";

type FilterOption = {
  id: string;
  label: string;
};

type PublisherLeadDetailsResponse = {
  items: PublisherLeadDetailsRow[];
  fieldColumns: PublisherLeadFieldColumn[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  filters: {
    products: FilterOption[];
    publishers: FilterOption[];
  };
};

const STATUS_OPTIONS = ["All", "Sold", "Intake Reject", "Reject", "Post Error", "Test"];
const METHOD_OPTIONS = ["All"];
const REDIRECT_STATUS_OPTIONS = ["All", "Redirected", "Not Redirected"];

function RedirectCell({
  label,
  redirectConfirmed,
  isRedirectCampaign,
}: {
  label: string;
  redirectConfirmed: boolean;
  isRedirectCampaign: boolean;
}) {
  if (label === "—" || !isRedirectCampaign) {
    return <span className="whitespace-nowrap text-slate-400 dark:text-slate-500">—</span>;
  }

  const presentation = getStatusBadgePresentation(redirectConfirmed ? "Sold" : "Reject", "outline");

  return (
    <span
      title={label}
      className="inline-flex max-w-[28rem] truncate rounded-full border px-2 py-0.5 text-xs font-semibold"
      style={presentation.style}
    >
      {label}
    </span>
  );
}

function buildDefaultFilters(searchParams?: Pick<URLSearchParams, "get">): PublisherLeadDetailsFilters {
  return {
    ...defaultPublisherLeadDetailsFilters,
    ...(searchParams ? parsePublisherLeadDetailsFiltersFromSearchParams(searchParams) : {}),
  };
}

export function PublisherLeadDetailsPage() {
  const searchParams = useSearchParams();
  const [draftFilters, setDraftFilters] = useState<PublisherLeadDetailsFilters>(() =>
    buildDefaultFilters(searchParams)
  );
  const [appliedFilters, setAppliedFilters] = useState<PublisherLeadDetailsFilters>(() =>
    buildDefaultFilters(searchParams)
  );
  const [rows, setRows] = useState<PublisherLeadDetailsRow[]>([]);
  const [fieldColumns, setFieldColumns] = useState<PublisherLeadFieldColumn[]>([]);
  const [products, setProducts] = useState<FilterOption[]>([]);
  const [publishers, setPublishers] = useState<FilterOption[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(100);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const { isInitialLoad, isRefreshing, beginLoad, endLoad } = useListLoadState();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewLead, setViewLead] = useState<PublisherLeadDetailsRow | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  const updateDraft = (patch: Partial<PublisherLeadDetailsFilters>) => {
    setDraftFilters((current) => ({ ...current, ...patch }));
  };

  const buildQuery = useCallback(
    (filters: PublisherLeadDetailsFilters, nextPage: number, nextPageSize: number) => {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(nextPageSize),
      });

      if (filters.leadId.trim()) params.set("leadId", filters.leadId.trim());
      if (filters.dateFrom) params.set("dateFrom", new Date(filters.dateFrom).toISOString());
      if (filters.dateTo) params.set("dateTo", new Date(filters.dateTo).toISOString());
      if (filters.productId) params.set("productId", filters.productId);
      if (filters.status !== "All") params.set("status", filters.status);
      if (filters.publisherId) params.set("publisherId", filters.publisherId);
      if (filters.leadScope) params.set("leadScope", filters.leadScope);
      if (filters.redirectStatus !== "All") params.set("redirectStatus", filters.redirectStatus);
      if (filters.tableSearch.trim()) params.set("tableSearch", filters.tableSearch.trim());

      return params.toString();
    },
    []
  );

  const loadRows = useCallback(
    async (filters: PublisherLeadDetailsFilters, nextPage: number, nextPageSize: number) => {
      beginLoad();

      try {
        const response = await fetch(`/api/reports/publisher/lead-details?${buildQuery(filters, nextPage, nextPageSize)}`);
        if (!response.ok) {
          throw new Error("Failed to load publisher lead details.");
        }

        const data = (await response.json()) as PublisherLeadDetailsResponse;
        const loadedProducts = data.filters.products;

        if (loadedProducts.length > 0 && !filters.productId) {
          const firstProductId = loadedProducts[0].id;
          const nextFilters = { ...filters, productId: firstProductId };
          setProducts(loadedProducts);
          setPublishers(data.filters.publishers);
          setDraftFilters(nextFilters);
          setAppliedFilters(nextFilters);
          endLoad();
          return;
        }

        setRows(data.items);
        setFieldColumns(data.fieldColumns ?? []);
        setTotalItems(data.totalItems);
        setTotalPages(data.totalPages);
        setProducts(loadedProducts);
        setPublishers(data.filters.publishers);
        setSelectedIds((current) => current.filter((id) => data.items.some((row) => row.id === id)));
      } catch {
        setRows([]);
        setTotalItems(0);
        setTotalPages(1);
      } finally {
        endLoad();
      }
    },
    [buildQuery, beginLoad, endLoad]
  );

  useEffect(() => {
    void loadRows(appliedFilters, page, pageSize);
  }, [appliedFilters, page, pageSize, loadRows]);

  useEffect(() => {
    if (!exportOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!exportMenuRef.current?.contains(event.target as Node)) {
        setExportOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [exportOpen]);

  const handleSearch = () => {
    const nextFilters = { ...draftFilters, leadScope: "" as const };
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setPage(1);
  };

  const handleClearAll = () => {
    const defaults = buildDefaultFilters();
    const firstProductId = products[0]?.id ?? "";
    const nextFilters = { ...defaults, productId: firstProductId };
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setPage(1);
  };

  const buildExportMatrix = (
    exportRows: PublisherLeadDetailsRow[],
    exportFieldColumns: PublisherLeadFieldColumn[]
  ) => {
    const headers = [
      "ID",
      "Date",
      "Status",
      "Publisher",
      "Redirect",
      "Pub",
      "ADM",
      "TTL",
      "Product",
      ...exportFieldColumns.map((field) => field.label),
    ];

    const matrix = exportRows.map((row) => [
      row.displayCode,
      formatPublisherLeadTime(row.postedAt),
      row.statusLabel,
      row.publisherLabel,
      row.redirectLabel,
      row.publisherPayout,
      row.adm,
      row.ttl,
      row.productLabel,
      ...exportFieldColumns.map((field) => formatPayloadFieldValue(row.rawPayload[field.fieldName])),
    ]);

    return { headers, matrix };
  };

  const fetchAllRows = async () => {
    if (totalItems === 0) {
      return { items: [] as PublisherLeadDetailsRow[], fieldColumns };
    }

    const maxPageSize = 1000;
    const pages = Math.ceil(totalItems / maxPageSize);
    const allRows: PublisherLeadDetailsRow[] = [];
    let mergedFieldColumns = fieldColumns;

    for (let nextPage = 1; nextPage <= pages; nextPage += 1) {
      const response = await fetch(`/api/reports/publisher/lead-details?${buildQuery(appliedFilters, nextPage, maxPageSize)}`);
      if (!response.ok) {
        throw new Error("Failed to export all lead details.");
      }

      const data = (await response.json()) as PublisherLeadDetailsResponse;
      allRows.push(...data.items);
      mergedFieldColumns = data.fieldColumns ?? mergedFieldColumns;
    }

    return { items: allRows, fieldColumns: mergedFieldColumns };
  };

  const handleExport = async (mode: "current-page" | "all-pages") => {
    setIsExporting(true);
    setExportOpen(false);

    try {
      if (mode === "all-pages") {
        const result = await fetchAllRows();
        const { headers, matrix } = buildExportMatrix(result.items, result.fieldColumns);
        downloadCsv("publisher-lead-details-all.csv", headers, matrix);
        return;
      }

      const { headers, matrix } = buildExportMatrix(rows, fieldColumns);
      downloadCsv("publisher-lead-details-current-page.csv", headers, matrix);
    } catch {
      // Ignore export errors for now.
    } finally {
      setIsExporting(false);
    }
  };

  const toggleRowSelection = (rowId: string) => {
    setSelectedIds((current) =>
      current.includes(rowId) ? current.filter((id) => id !== rowId) : [...current, rowId]
    );
  };

  const toggleAllRows = (checked: boolean) => {
    setSelectedIds(checked ? rows.map((row) => row.id) : []);
  };

  const columns: Column<PublisherLeadDetailsRow>[] = useMemo(() => {
    const systemColumns: Column<PublisherLeadDetailsRow>[] = [
      {
        key: "displayCode",
        label: "ID",
        sortValue: (row) => row.displayCode,
        render: (row) => (
          <button
            type="button"
            onClick={() => setViewLead(row)}
            className="group inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-400 dark:hover:bg-blue-900/40 dark:hover:text-blue-300"
          >
            <Eye size={13} className="shrink-0 text-slate-400 group-hover:text-blue-500 dark:text-slate-500 dark:group-hover:text-blue-400" />
            <span>{row.displayCode}</span>
          </button>
        ),
      },
      {
        key: "postedAt",
        label: "Date",
        sortValue: (row) => new Date(row.postedAt).getTime(),
        render: (row) => (
          <span className="whitespace-nowrap tabular-nums text-slate-700 dark:text-slate-200">
            {formatPublisherLeadTableTime(row.postedAt)}
          </span>
        ),
      },
      {
        key: "statusLabel",
        label: "Status",
        render: (row) => <StatusBadge status={row.statusLabel} />,
      },
      {
        key: "publisherLabel",
        label: "Publisher",
        sortValue: (row) => row.publisherLabel,
        render: (row) => <span className="whitespace-nowrap">{row.publisherLabel}</span>,
      },
      {
        key: "redirectLabel",
        label: "Redirect",
        sortValue: (row) => row.redirectLabel,
        render: (row) => (
          <RedirectCell
            label={row.redirectLabel}
            redirectConfirmed={row.redirectConfirmed}
            isRedirectCampaign={row.isRedirectCampaign}
          />
        ),
      },
      {
        key: "publisherPayout",
        label: "Pub",
        sortValue: (row) => row.publisherPayout,
        render: (row) => (
          <span className="whitespace-nowrap tabular-nums text-slate-700 dark:text-slate-200">
            {row.publisherPayout}
          </span>
        ),
      },
      {
        key: "adm",
        label: "ADM",
        sortValue: (row) => row.adm,
        render: (row) => (
          <span className="whitespace-nowrap tabular-nums text-slate-700 dark:text-slate-200">{row.adm}</span>
        ),
      },
      {
        key: "ttl",
        label: "TTL",
        sortValue: (row) => row.ttl,
        render: (row) => (
          <span className="whitespace-nowrap tabular-nums text-slate-700 dark:text-slate-200">{row.ttl}</span>
        ),
      },
      {
        key: "productLabel",
        label: "Product",
        sortValue: (row) => row.productLabel,
        render: (row) => <span className="whitespace-nowrap">{row.productLabel}</span>,
      },
    ];

    const dynamicFieldColumns: Column<PublisherLeadDetailsRow>[] = fieldColumns.map((field) => ({
      key: `field:${field.fieldName}`,
      label: field.label,
      sortValue: (row) => formatPayloadFieldValue(row.rawPayload[field.fieldName]),
      render: (row) => (
        <span className="whitespace-nowrap">{formatPayloadFieldValue(row.rawPayload[field.fieldName])}</span>
      ),
    }));

    return [...systemColumns, ...dynamicFieldColumns];
  }, [fieldColumns]);

  const showingFrom = rows.length > 0 ? (page - 1) * pageSize + 1 : 0;
  const showingTo = rows.length > 0 ? Math.min(page * pageSize, totalItems) : 0;

  return (
    <PageSection title="Publisher Lead Details">
      <div className="space-y-5">
        <SearchFilterPanel>
              <SearchFilterGrid>
                <SearchFilterField>
                  <FieldLabel htmlFor="lead-id" label="Lead ID" />
                  <Input
                    id="lead-id"
                    className={SEARCH_FILTER_CONTROL_CLASS}
                    value={draftFilters.leadId}
                    onChange={(event) => updateDraft({ leadId: event.target.value })}
                    placeholder="Lead ID"
                  />
                </SearchFilterField>

                <SearchFilterField>
                  <FieldLabel htmlFor="lead-date-range" label="Date" />
                  <DateRangePicker
                    id="lead-date-range"
                    className={SEARCH_FILTER_DATE_RANGE_CLASS}
                    value={{ from: draftFilters.dateFrom, to: draftFilters.dateTo }}
                    onChange={(range) => updateDraft({ dateFrom: range.from, dateTo: range.to })}
                  />
                </SearchFilterField>

                <SearchFilterSelect
                  id="product"
                  label="Product"
                  value={draftFilters.productId}
                  onChange={(value) => updateDraft({ productId: value })}
                  options={products.map((product) => ({ value: product.id, label: product.label }))}
                />

                <SearchFilterSelect
                  id="method"
                  label="Method"
                  value={draftFilters.method}
                  onChange={(value) => updateDraft({ method: value })}
                  options={METHOD_OPTIONS.map((option) => ({ value: option, label: option }))}
                />

                <SearchFilterSelect
                  id="status"
                  label="Status"
                  value={draftFilters.status}
                  onChange={(value) => updateDraft({ status: value })}
                  options={STATUS_OPTIONS.map((option) => ({ value: option, label: option }))}
                />

                <SearchFilterSelect
                  id="publisher"
                  label="Publisher"
                  value={draftFilters.publisherId}
                  onChange={(value) => updateDraft({ publisherId: value })}
                  options={[
                    { value: "", label: "All" },
                    ...publishers.map((publisher) => ({ value: publisher.id, label: publisher.label })),
                  ]}
                />

                <SearchFilterSelect
                  id="redirect-status"
                  label="Redirect Status"
                  value={draftFilters.redirectStatus}
                  onChange={(value) => updateDraft({ redirectStatus: value })}
                  options={REDIRECT_STATUS_OPTIONS.map((option) => ({ value: option, label: option }))}
                />
              </SearchFilterGrid>

              <p className="mt-4 max-w-3xl text-xs text-slate-500 dark:text-slate-400">
                To add lead parameters to the report, go to System Management → Products, select the product, and
                configure its fields under Report Customization.
              </p>

              <SearchFilterActions onSearch={handleSearch} onClear={handleClearAll} />
            </SearchFilterPanel>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <ListTableToolbar
                pageSize={pageSize}
                pageSizeOptions={[...REPORT_PAGE_SIZE_OPTIONS]}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
                showingFrom={showingFrom}
                showingTo={showingTo}
                totalItems={totalItems}
                tableFilter={draftFilters.tableSearch}
                onTableFilterChange={(value) => updateDraft({ tableSearch: value })}
                onTableFilterSubmit={handleSearch}
                filterPlaceholder="Search table..."
                selectedCount={selectedIds.length}
                actions={
                  <div className="relative w-full sm:w-auto" ref={exportMenuRef}>
                    <button
                      type="button"
                      onClick={() => setExportOpen((current) => !current)}
                      disabled={isExporting}
                      className={cn(toolbarPrimaryButtonClassName, "w-full sm:w-auto")}
                    >
                      <Download size={15} />
                      {isExporting ? "Exporting..." : "Export"}
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <ToolbarDropdownMenu open={exportOpen}>
                      <button
                        type="button"
                        className={toolbarDropdownItemClassName}
                        onClick={() => void handleExport("current-page")}
                      >
                        Current Page to CSV
                      </button>
                      <button
                        type="button"
                        className={toolbarDropdownItemClassName}
                        onClick={() => void handleExport("all-pages")}
                      >
                        All Page to CSV
                      </button>
                    </ToolbarDropdownMenu>
                  </div>
                }
              />

              <ListTableContainer
                isInitialLoad={isInitialLoad}
                isRefreshing={isRefreshing}
                loadingMessage="Loading lead details..."
              >
                <DataTable
                  columns={columns}
                  rows={rows}
                  emptyMessage="No leads found for the selected filters."
                  selectedRowIds={selectedIds}
                  onToggleRow={toggleRowSelection}
                  onToggleAllRows={toggleAllRows}
                />

                <div className="mt-4">
                  <PaginationControls
                    page={page}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    pageSize={pageSize}
                    pageSizeOptions={[...REPORT_PAGE_SIZE_OPTIONS]}
                    onPageChange={setPage}
                  />
                </div>
              </ListTableContainer>
            </div>
      </div>

      <Modal
        open={Boolean(viewLead)}
        title={viewLead ? `Lead ${viewLead.displayCode}` : "Lead Details"}
        onClose={() => setViewLead(null)}
        panelClassName="max-w-3xl"
      >
        {viewLead ? (
          <div className="space-y-4 text-sm text-slate-700 dark:text-slate-100">
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Lead ID</dt>
                <dd className="mt-1 font-mono text-xs">{viewLead.id}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Display Code</dt>
                <dd className="mt-1">{viewLead.displayCode}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Posted At</dt>
                <dd className="mt-1">{formatPublisherLeadTime(viewLead.postedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Created At</dt>
                <dd className="mt-1">{formatPublisherLeadTime(viewLead.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</dt>
                <dd className="mt-1">
                  <StatusBadge status={viewLead.statusLabel} />
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Publisher</dt>
                <dd className="mt-1">{viewLead.publisherLabel}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Redirect</dt>
                <dd className="mt-1">
                  <RedirectCell
                    label={viewLead.redirectLabel}
                    redirectConfirmed={viewLead.redirectConfirmed}
                    isRedirectCampaign={viewLead.isRedirectCampaign}
                  />
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Pub</dt>
                <dd className="mt-1 tabular-nums">{viewLead.publisherPayout}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">ADM</dt>
                <dd className="mt-1 tabular-nums">{viewLead.adm}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">TTL</dt>
                <dd className="mt-1 tabular-nums">{viewLead.ttl}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Product</dt>
                <dd className="mt-1">{viewLead.productLabel}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Ping Tree</dt>
                <dd className="mt-1">
                  {viewLead.pingTreeAllocations.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      {viewLead.pingTreeAllocations.map((allocation) => (
                        <span key={allocation.configId} className="inline-flex items-center gap-2">
                          {allocation.displayId != null ? <IdBadge id={allocation.displayId} /> : null}
                          <span>{allocation.configName || "—"}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Channel</dt>
                <dd className="mt-1">{viewLead.channelLabel}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">User Agent</dt>
                <dd className="mt-1 break-all">{viewLead.userAgent}</dd>
              </div>
              {viewLead.validationErrors.length ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Validation Errors</dt>
                  <dd className="mt-1">
                    <ul className="list-disc space-y-1 pl-5 text-red-600 dark:text-red-400">
                      {viewLead.validationErrors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ) : null}
            </dl>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Lead Payload</p>
              <pre className="max-h-[40vh] overflow-auto rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-700 dark:bg-slate-800 dark:text-slate-100">
                {JSON.stringify(viewLead.rawPayload, null, 2)}
              </pre>
            </div>
          </div>
        ) : null}
      </Modal>
    </PageSection>
  );
}
