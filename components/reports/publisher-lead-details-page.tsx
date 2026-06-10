"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Eye } from "lucide-react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { FieldLabel, Input } from "@/components/ui/form-controls";
import { Modal } from "@/components/ui/modal";
import { ListTableContainer } from "@/components/ui/list-table-container";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageSection } from "@/components/ui/state";
import { REPORT_PAGE_SIZE_OPTIONS } from "@/lib/pagination";
import { useListLoadState } from "@/lib/use-list-load-state";
import {
  defaultPublisherLeadDetailsFilters,
  formatPayloadFieldValue,
  formatPublisherLeadTime,
  type PublisherLeadDetailsFilters,
  type PublisherLeadDetailsRow,
  type PublisherLeadFieldColumn,
} from "@/lib/publisher-lead-details";
import { StatusBadge } from "@/components/ui/status-badge";
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

const STATUS_OPTIONS = ["All", "Sold", "Reject"];
const REDIRECT_STATUS_OPTIONS = ["All", "Redirected", "Not Redirected"];

function buildDefaultFilters(): PublisherLeadDetailsFilters {
  return { ...defaultPublisherLeadDetailsFilters };
}

function SortableHeader({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <span className="text-[10px] leading-none text-slate-400">▲▼</span>
    </span>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <FieldLabel htmlFor={id} label={label} />
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition duration-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25"
      >
        {options.map((option) => (
          <option key={option.value || "empty"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function PublisherLeadDetailsPage() {
  const [draftFilters, setDraftFilters] = useState<PublisherLeadDetailsFilters>(() => buildDefaultFilters());
  const [appliedFilters, setAppliedFilters] = useState<PublisherLeadDetailsFilters>(() => buildDefaultFilters());
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

  const handleSearch = () => {
    setAppliedFilters({ ...draftFilters });
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
        label: <SortableHeader label="ID" />,
        render: (row) => (
          <div className="flex items-center gap-2 whitespace-nowrap">
            <button
              type="button"
              onClick={() => setViewLead(row)}
              className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800 dark:hover:text-blue-300"
              aria-label={`View lead ${row.displayCode}`}
            >
              <Eye className="h-4 w-4" />
            </button>
            <span className="font-medium text-slate-800 dark:text-slate-100">{row.displayCode}</span>
          </div>
        ),
      },
      {
        key: "postedAt",
        label: <SortableHeader label="Date" />,
        render: (row) => (
          <span className="whitespace-nowrap text-slate-700 dark:text-slate-200">
            {formatPublisherLeadTime(row.postedAt)}
          </span>
        ),
      },
      {
        key: "statusLabel",
        label: <SortableHeader label="Status" />,
        render: (row) => <StatusBadge status={row.statusLabel} />,
      },
      {
        key: "tier",
        label: <SortableHeader label="Tier" />,
        render: (row) => row.tier,
      },
      {
        key: "redirectLabel",
        label: <SortableHeader label="Redirect" />,
        render: (row) => <span className="whitespace-nowrap text-xs">{row.redirectLabel}</span>,
      },
      {
        key: "productLabel",
        label: <SortableHeader label="Product" />,
        render: (row) => <span className="whitespace-nowrap">{row.productLabel}</span>,
      },
    ];

    const dynamicFieldColumns: Column<PublisherLeadDetailsRow>[] = fieldColumns.map((field) => ({
      key: `field:${field.fieldName}`,
      label: <SortableHeader label={field.label} />,
      render: (row) => (
        <span className="whitespace-nowrap">{formatPayloadFieldValue(row.rawPayload[field.fieldName])}</span>
      ),
    }));

    return [...systemColumns, ...dynamicFieldColumns];
  }, [fieldColumns]);

  return (
    <PageSection title="Publisher Reports — Lead Details">
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <FieldLabel htmlFor="lead-id" label="Lead ID" />
                  <Input
                    id="lead-id"
                    value={draftFilters.leadId}
                    onChange={(event) => updateDraft({ leadId: event.target.value })}
                    placeholder="Lead ID"
                  />
                </div>

                <div>
                  <FieldLabel htmlFor="date-from" label="Date" />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      id="date-from"
                      type="datetime-local"
                      value={draftFilters.dateFrom}
                      onChange={(event) => updateDraft({ dateFrom: event.target.value })}
                    />
                    <Input
                      id="date-to"
                      type="datetime-local"
                      value={draftFilters.dateTo}
                      onChange={(event) => updateDraft({ dateTo: event.target.value })}
                    />
                  </div>
                </div>

                <FilterSelect
                  id="product"
                  label="Product"
                  value={draftFilters.productId}
                  onChange={(value) => updateDraft({ productId: value })}
                  options={products.map((product) => ({ value: product.id, label: product.label }))}
                />

                <FilterSelect
                  id="status"
                  label="Status"
                  value={draftFilters.status}
                  onChange={(value) => updateDraft({ status: value })}
                  options={STATUS_OPTIONS.map((option) => ({ value: option, label: option }))}
                />

                <FilterSelect
                  id="publisher"
                  label="Publisher"
                  value={draftFilters.publisherId}
                  onChange={(value) => updateDraft({ publisherId: value })}
                  options={[
                    { value: "", label: "All" },
                    ...publishers.map((publisher) => ({ value: publisher.id, label: publisher.label })),
                  ]}
                />

                <FilterSelect
                  id="redirect-status"
                  label="Redirect Status"
                  value={draftFilters.redirectStatus}
                  onChange={(value) => updateDraft({ redirectStatus: value })}
                  options={REDIRECT_STATUS_OPTIONS.map((option) => ({ value: option, label: option }))}
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                <p className="max-w-xl text-xs text-slate-500 dark:text-slate-400">
                  Add lead parameters via System Management to extend filters and export columns.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-sm font-medium text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-slate-100"
                  >
                    Clear all
                  </button>
                  <button
                    type="button"
                    onClick={handleSearch}
                    className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                  >
                    Search
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap items-center gap-1">
                  {REPORT_PAGE_SIZE_OPTIONS.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => {
                        setPageSize(size);
                        setPage(1);
                      }}
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-sm font-medium transition",
                        pageSize === size
                          ? "bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900"
                          : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>

                <span className="text-sm text-slate-600 dark:text-slate-300">
                  Showing {rows.length} entries
                </span>

                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <Input
                    value={draftFilters.tableSearch}
                    onChange={(event) => updateDraft({ tableSearch: event.target.value })}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        handleSearch();
                      }
                    }}
                    placeholder="Search table..."
                    className="w-48"
                  />

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setExportOpen((current) => !current)}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                    >
                      Export
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    {exportOpen ? (
                      <div className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                        <button
                          type="button"
                          className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                          onClick={() => setExportOpen(false)}
                        >
                          Export CSV
                        </button>
                        <button
                          type="button"
                          className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                          onClick={() => setExportOpen(false)}
                        >
                          Export Excel
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Export to Cloud PBX
                  </button>

                  {selectedIds.length > 0 ? (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {selectedIds.length} selected
                    </span>
                  ) : null}
                </div>
              </div>

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
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Product</dt>
                <dd className="mt-1">{viewLead.productLabel}</dd>
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
