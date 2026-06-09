"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Eye } from "lucide-react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { FieldLabel, Input } from "@/components/ui/form-controls";
import { Modal } from "@/components/ui/modal";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageSection, Spinner } from "@/components/ui/state";
import {
  defaultPublisherLeadDetailsFilters,
  formatPayloadFieldValue,
  formatPublisherLeadTime,
  type PublisherLeadDetailsFilters,
  type PublisherLeadDetailsRow,
  type PublisherLeadFieldColumn,
} from "@/lib/publisher-lead-details";
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

type ReportTab = "lead-details" | "post-details" | "lead-body";

const PAGE_SIZE_OPTIONS = [15, 50, 100, 500, 1000] as const;

const METHOD_OPTIONS = ["All", "GET", "POST"];
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

function QualityDots({ dots }: { dots: boolean[] }) {
  return (
    <div className="flex items-center gap-1">
      {dots.map((active, index) => (
        <span
          key={index}
          className={cn("h-2.5 w-2.5 rounded-full", active ? "bg-emerald-500" : "bg-orange-400")}
        />
      ))}
    </div>
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
  const [activeTab, setActiveTab] = useState<ReportTab>("lead-details");
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
  const [isLoading, setIsLoading] = useState(true);
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
      if (filters.publisherChannel.trim()) params.set("publisherChannel", filters.publisherChannel.trim());
      if (filters.publisherSource.trim()) params.set("publisherSource", filters.publisherSource.trim());
      if (filters.publisherTags.trim()) params.set("publisherTags", filters.publisherTags.trim());
      if (filters.tableSearch.trim()) params.set("tableSearch", filters.tableSearch.trim());

      return params.toString();
    },
    []
  );

  const loadRows = useCallback(
    async (filters: PublisherLeadDetailsFilters, nextPage: number, nextPageSize: number) => {
      setIsLoading(true);

      try {
        const response = await fetch(`/api/reports/publisher/lead-details?${buildQuery(filters, nextPage, nextPageSize)}`);
        if (!response.ok) {
          throw new Error("Failed to load publisher lead details.");
        }

        const data = (await response.json()) as PublisherLeadDetailsResponse;
        setRows(data.items);
        setFieldColumns(data.fieldColumns ?? []);
        setPage(data.page);
        setPageSize(data.pageSize);
        setTotalItems(data.totalItems);
        setTotalPages(data.totalPages);
        setProducts(data.filters.products);
        setPublishers(data.filters.publishers);
        setSelectedIds((current) => current.filter((id) => data.items.some((row) => row.id === id)));
      } catch {
        setRows([]);
        setTotalItems(0);
        setTotalPages(1);
      } finally {
        setIsLoading(false);
      }
    },
    [buildQuery]
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
        key: "qualityDots",
        label: <SortableHeader label="Quality" />,
        render: (row) => <QualityDots dots={row.qualityDots} />,
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
        render: (row) => (
          <span
            className={cn(
              "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
              row.statusLabel === "Sold"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
                : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200"
            )}
          >
            {row.statusLabel}
          </span>
        ),
      },
      {
        key: "tier",
        label: <SortableHeader label="Tier" />,
        render: (row) => row.tier,
      },
      {
        key: "publisherLabel",
        label: <SortableHeader label="Publisher" />,
        render: (row) => <span className="whitespace-nowrap">{row.publisherLabel}</span>,
      },
      {
        key: "redirectLabel",
        label: <SortableHeader label="Redirect" />,
        render: (row) => <span className="whitespace-nowrap text-xs">{row.redirectLabel}</span>,
      },
      {
        key: "publisherPayout",
        label: <SortableHeader label="Publisher" />,
        render: (row) => <span className="whitespace-nowrap">{row.publisherPayout}</span>,
      },
      {
        key: "adm",
        label: <SortableHeader label="ADM" />,
        render: (row) => row.adm,
      },
      {
        key: "ttl",
        label: <SortableHeader label="TTL" />,
        render: (row) => row.ttl,
      },
      {
        key: "ref",
        label: <SortableHeader label="REF" />,
        render: (row) => row.ref,
      },
      {
        key: "agn",
        label: <SortableHeader label="AGN" />,
        render: (row) => row.agn,
      },
      {
        key: "productLabel",
        label: <SortableHeader label="Product" />,
        render: (row) => <span className="whitespace-nowrap">{row.productLabel}</span>,
      },
      {
        key: "channelLabel",
        label: <SortableHeader label="Channel" />,
        render: (row) => <span className="whitespace-nowrap">{row.channelLabel}</span>,
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

  const tabItems: { id: ReportTab; label: string }[] = [
    { id: "lead-details", label: "Lead Details" },
    { id: "post-details", label: "Post Details" },
    { id: "lead-body", label: "Lead Body" },
  ];

  return (
    <PageSection title="Publisher Reports — Lead Details">
      <div className="space-y-4">
        <div className="border-b border-slate-200 dark:border-slate-700">
          <div className="flex flex-wrap gap-1">
            {tabItems.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "border-b-2 px-4 py-2.5 text-sm font-medium transition",
                  activeTab === tab.id
                    ? "border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-300"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "lead-details" ? (
          <>
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
                  options={[
                    { value: "", label: "All" },
                    ...products.map((product) => ({ value: product.id, label: product.label })),
                  ]}
                />

                <FilterSelect
                  id="method"
                  label="Method"
                  value={draftFilters.method}
                  onChange={(value) => updateDraft({ method: value })}
                  options={METHOD_OPTIONS.map((option) => ({ value: option, label: option }))}
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

                <div>
                  <FieldLabel htmlFor="publisher-channel" label="Publisher Channel" />
                  <Input
                    id="publisher-channel"
                    value={draftFilters.publisherChannel}
                    onChange={(event) => updateDraft({ publisherChannel: event.target.value })}
                    placeholder="All"
                  />
                </div>

                <div>
                  <FieldLabel htmlFor="publisher-source" label="Publisher Source" />
                  <Input
                    id="publisher-source"
                    value={draftFilters.publisherSource}
                    onChange={(event) => updateDraft({ publisherSource: event.target.value })}
                    placeholder="All"
                  />
                </div>

                <div>
                  <FieldLabel htmlFor="publisher-tags" label="Publisher Tags" />
                  <Input
                    id="publisher-tags"
                    value={draftFilters.publisherTags}
                    onChange={(event) => updateDraft({ publisherTags: event.target.value })}
                    placeholder="All"
                  />
                </div>

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
                  {PAGE_SIZE_OPTIONS.map((size) => (
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

              {isLoading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-slate-500 dark:text-slate-300">
                  <Spinner />
                  Loading lead details...
                </div>
              ) : (
                <>
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
                      onPageChange={setPage}
                    />
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
            {activeTab === "post-details"
              ? "Select a lead from Lead Details to view post details."
              : "Select a lead from Lead Details to view lead body."}
          </div>
        )}
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
                <dd className="mt-1">{viewLead.statusLabel}</dd>
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
