"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
import { ListTableContainer } from "@/components/ui/list-table-container";
import { ListTableToolbar } from "@/components/ui/list-table-toolbar";
import {
  ColumnVisibilitySelect,
  normalizeVisibleColumnKeys,
  usePersistedVisibleColumnKeys,
} from "@/components/ui/column-visibility-select";
import { InfoPopover } from "@/components/ui/info-popover";
import { METRIC_COLUMN_HINTS, metricColumnVisibilityLabel } from "@/lib/metric-column-hints";
import { ToolbarDropdownMenu, toolbarDropdownItemClassName } from "@/components/ui/toolbar-dropdown-menu";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageSection } from "@/components/ui/state";
import { REPORT_PAGE_SIZE_OPTIONS } from "@/lib/pagination";
import { downloadCsv } from "@/lib/csv-export";
import { filterRowsByQuery } from "@/lib/table-filter";
import { useListLoadState } from "@/lib/use-list-load-state";
import {
  createDefaultPublisherLeadDetailsFilters,
  formatPayloadFieldValue,
  formatPublisherLeadTableTime,
  formatPublisherLeadTime,
  parsePublisherLeadDetailsFiltersFromSearchParams,
  PUBLISHER_LEAD_DETAILS_STATUS_OPTIONS,
  type PublisherLeadDetailsFilters,
  type PublisherLeadDetailsRow,
  type PublisherLeadFieldColumn,
} from "@/lib/publisher-lead-details";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatusMultiSelect } from "@/components/ui/status-multi-select";
import { useSystemSettings } from "@/components/settings/system-settings-context";
import { parseDateTimeInTimeZone } from "@/lib/date-range";
import { getStatusBadgePresentation } from "@/lib/status-badge";
import { toolbarPrimaryButtonClassName } from "@/lib/button-styles";
import {
  fetchPublisherChannelSourceOptions,
  serializeCommaSeparatedFilter,
  type PublisherFilterOption,
} from "@/lib/publisher-channel-source-filters";
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

const STATUS_OPTIONS = [...PUBLISHER_LEAD_DETAILS_STATUS_OPTIONS];
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

function buildDefaultFilters(
  timeZone: string,
  searchParams?: Pick<URLSearchParams, "get">
): PublisherLeadDetailsFilters {
  return {
    ...createDefaultPublisherLeadDetailsFilters(timeZone),
    ...(searchParams ? parsePublisherLeadDetailsFiltersFromSearchParams(searchParams) : {}),
  };
}

export function PublisherLeadDetailsPage() {
  const searchParams = useSearchParams();
  const { timeZone } = useSystemSettings();
  const [draftFilters, setDraftFilters] = useState<PublisherLeadDetailsFilters>(() =>
    buildDefaultFilters(timeZone, searchParams)
  );
  const [appliedFilters, setAppliedFilters] = useState<PublisherLeadDetailsFilters>(() =>
    buildDefaultFilters(timeZone, searchParams)
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
  const [exportOpen, setExportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [searchNonce, setSearchNonce] = useState(0);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const [channelOptions, setChannelOptions] = useState<PublisherFilterOption[]>([]);
  const [sourceOptions, setSourceOptions] = useState<PublisherFilterOption[]>([]);
  const [isLoadingChannelSourceOptions, setIsLoadingChannelSourceOptions] = useState(false);
  const [pageFilter, setPageFilter] = useState("");

  const updateDraft = (patch: Partial<PublisherLeadDetailsFilters>) => {
    setDraftFilters((current) => ({ ...current, ...patch }));
  };

  useEffect(() => {
    const publisherId = draftFilters.publisherId.trim();
    if (!publisherId) {
      setChannelOptions([]);
      setSourceOptions([]);
      setIsLoadingChannelSourceOptions(false);
      return;
    }

    let cancelled = false;
    setIsLoadingChannelSourceOptions(true);

    void fetchPublisherChannelSourceOptions(publisherId)
      .then((options) => {
        if (cancelled) return;
        setChannelOptions(options.channels);
        setSourceOptions(options.sources);
      })
      .catch(() => {
        if (cancelled) return;
        setChannelOptions([]);
        setSourceOptions([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingChannelSourceOptions(false);
      });

    return () => {
      cancelled = true;
    };
  }, [draftFilters.publisherId]);

  const buildQuery = useCallback(
    (filters: PublisherLeadDetailsFilters, nextPage: number, nextPageSize: number) => {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(nextPageSize),
      });

      if (filters.leadId.trim()) params.set("leadId", filters.leadId.trim());
      const dateFrom = parseDateTimeInTimeZone(filters.dateFrom, timeZone);
      const dateTo = parseDateTimeInTimeZone(filters.dateTo, timeZone);
      if (dateFrom) params.set("dateFrom", dateFrom.toISOString());
      if (dateTo) params.set("dateTo", dateTo.toISOString());
      if (filters.productId) params.set("productId", filters.productId);
      if (filters.status.length > 0) params.set("status", filters.status.join(","));
      if (filters.publisherId) params.set("publisherId", filters.publisherId);
      const channelFilter = serializeCommaSeparatedFilter(filters.publisherChannel);
      if (channelFilter) params.set("publisherChannel", channelFilter);
      const sourceFilter = serializeCommaSeparatedFilter(filters.publisherSource);
      if (sourceFilter) params.set("publisherSource", sourceFilter);
      // Prefer explicit status multi-select over leadScope from performance summary drill-down.
      if (filters.leadScope && filters.status.length === 0) params.set("leadScope", filters.leadScope);
      if (filters.redirectStatus !== "All") params.set("redirectStatus", filters.redirectStatus);
      if (filters.tableSearch.trim()) params.set("tableSearch", filters.tableSearch.trim());

      return params.toString();
    },
    [timeZone]
  );

  const loadRows = useCallback(
    async (filters: PublisherLeadDetailsFilters, nextPage: number, nextPageSize: number) => {
      beginLoad();

      try {
        const response = await fetch(
          `/api/reports/publisher/lead-details?${buildQuery(filters, nextPage, nextPageSize)}`,
          { cache: "no-store" }
        );
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
  }, [appliedFilters, page, pageSize, loadRows, searchNonce]);

  useEffect(() => {
    setPageFilter("");
  }, [page, pageSize, appliedFilters, searchNonce]);

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
    setPageFilter("");
    setSearchNonce((current) => current + 1);
  };

  const handleClearAll = () => {
    const defaults = buildDefaultFilters(timeZone);
    const firstProductId = products[0]?.id ?? "";
    const nextFilters = { ...defaults, productId: firstProductId };
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setPage(1);
    setPageFilter("");
  };

  const buildExportMatrix = (
    exportRows: PublisherLeadDetailsRow[],
    exportFieldColumns: PublisherLeadFieldColumn[],
    selectedKeys: string[]
  ) => {
    const exportColumns: Array<{
      key: string;
      label: string;
      value: (row: PublisherLeadDetailsRow) => string;
    }> = [
      { key: "displayCode", label: "ID", value: (row) => row.displayCode },
      {
        key: "postedAt",
        label: "Date",
        value: (row) => formatPublisherLeadTime(row.postedAt, timeZone),
      },
      { key: "statusLabel", label: "Status", value: (row) => row.statusLabel },
      { key: "publisherLabel", label: "Publisher", value: (row) => row.publisherLabel },
      { key: "channelLabel", label: "Publisher Channel", value: (row) => row.channelLabel },
      { key: "publisherSource", label: "Publisher Source", value: (row) => row.publisherSource },
      { key: "redirectLabel", label: "Redirect", value: (row) => row.redirectLabel },
      { key: "publisherPayout", label: "Pub", value: (row) => row.publisherPayout },
      { key: "adm", label: "ADM", value: (row) => row.adm },
      { key: "ttl", label: "TTL", value: (row) => row.ttl },
      { key: "productLabel", label: "Product", value: (row) => row.productLabel },
      ...exportFieldColumns.map((field) => ({
        key: `field:${field.fieldName}`,
        label: field.label,
        value: (row: PublisherLeadDetailsRow) => formatPayloadFieldValue(row.rawPayload[field.fieldName]),
      })),
    ];

    const selectedSet = new Set(selectedKeys);
    const visibleExportColumns = exportColumns.filter((column) => selectedSet.has(column.key));

    return {
      headers: visibleExportColumns.map((column) => column.label),
      matrix: exportRows.map((row) => visibleExportColumns.map((column) => column.value(row))),
    };
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

    const selectedKeys = normalizeVisibleColumnKeys(visibleColumnKeys, [
      "displayCode",
      "postedAt",
      "statusLabel",
      "publisherLabel",
      "channelLabel",
      "publisherSource",
      "redirectLabel",
      "publisherPayout",
      "adm",
      "ttl",
      "productLabel",
      ...fieldColumns.map((field) => `field:${field.fieldName}`),
    ]);

    try {
      if (mode === "all-pages") {
        const result = await fetchAllRows();
        const { headers, matrix } = buildExportMatrix(result.items, result.fieldColumns, selectedKeys);
        downloadCsv("publisher-lead-details-all.csv", headers, matrix);
        return;
      }

      const pageRows = filterRowsByQuery(rows, columns, pageFilter);
      const { headers, matrix } = buildExportMatrix(pageRows, fieldColumns, selectedKeys);
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

  const allColumns: Column<PublisherLeadDetailsRow>[] = useMemo(() => {
    const systemColumns: Column<PublisherLeadDetailsRow>[] = [
      {
        key: "displayCode",
        label: "ID",
        sortValue: (row) => row.displayCode,
        render: (row) => (
          <Link
            href={`/leads/${encodeURIComponent(row.id)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-400 dark:hover:bg-blue-900/40 dark:hover:text-blue-300"
          >
            <Eye size={13} className="shrink-0 text-slate-400 group-hover:text-blue-500 dark:text-slate-500 dark:group-hover:text-blue-400" />
            <span>{row.displayCode}</span>
          </Link>
        ),
      },
      {
        key: "postedAt",
        label: "Date",
        sortValue: (row) => new Date(row.postedAt).getTime(),
        render: (row) => (
          <span className="whitespace-nowrap tabular-nums text-slate-700 dark:text-slate-200">
            {formatPublisherLeadTableTime(row.postedAt, timeZone)}
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
        key: "channelLabel",
        label: "Publisher Channel",
        sortValue: (row) => row.channelLabel,
        render: (row) => <span className="whitespace-nowrap">{row.channelLabel}</span>,
      },
      {
        key: "publisherSource",
        label: "Publisher Source",
        sortValue: (row) => row.publisherSource,
        render: (row) => (
          <span className="whitespace-nowrap">
            {row.publisherSource && row.publisherSource !== "—" ? row.publisherSource : "—"}
          </span>
        ),
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
        label: (
          <InfoPopover
            title={METRIC_COLUMN_HINTS.pub.title}
            description={METRIC_COLUMN_HINTS.pub.description}
          >
            Pub
          </InfoPopover>
        ),
        sortValue: (row) => row.publisherPayout,
        render: (row) => (
          <span className="whitespace-nowrap tabular-nums text-slate-700 dark:text-slate-200">
            {row.publisherPayout}
          </span>
        ),
      },
      {
        key: "adm",
        label: (
          <InfoPopover
            title={METRIC_COLUMN_HINTS.adm.title}
            description={METRIC_COLUMN_HINTS.adm.description}
          >
            ADM
          </InfoPopover>
        ),
        sortValue: (row) => row.adm,
        render: (row) => (
          <span className="whitespace-nowrap tabular-nums text-slate-700 dark:text-slate-200">{row.adm}</span>
        ),
      },
      {
        key: "ttl",
        label: (
          <InfoPopover
            title={METRIC_COLUMN_HINTS.ttl.title}
            description={METRIC_COLUMN_HINTS.ttl.description}
          >
            TTL
          </InfoPopover>
        ),
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
  }, [fieldColumns, timeZone]);

  const columnOptions = useMemo(
    () =>
      allColumns.map((column) => ({
        key: String(column.key),
        label:
          typeof column.label === "string"
            ? column.label
            : metricColumnVisibilityLabel(String(column.key), String(column.key)),
      })),
    [allColumns]
  );

  const allColumnKeys = useMemo(() => columnOptions.map((option) => option.key), [columnOptions]);

  const { visibleColumnKeys, setVisibleColumnKeys, effectiveVisibleKeys } =
    usePersistedVisibleColumnKeys("publisher-lead-details-v2", allColumnKeys, {
      ready: !isInitialLoad && !isRefreshing,
    });

  const columns = useMemo(
    () => allColumns.filter((column) => effectiveVisibleKeys.includes(String(column.key))),
    [allColumns, effectiveVisibleKeys]
  );

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

                <SearchFilterField>
                  <FieldLabel htmlFor="status" label="Status" />
                  <StatusMultiSelect
                    id="status"
                    options={STATUS_OPTIONS.map((option) => ({ value: option, label: option }))}
                    selected={draftFilters.status}
                    onChange={(selected) => updateDraft({ status: selected, leadScope: "" })}
                    placeholder="All"
                    summaryThreshold={3}
                  />
                </SearchFilterField>

                <SearchFilterSelect
                  id="publisher"
                  label="Publisher"
                  value={draftFilters.publisherId}
                  onChange={(value) =>
                    updateDraft({
                      publisherId: value,
                      publisherChannel: [],
                      publisherSource: [],
                    })
                  }
                  options={[
                    { value: "", label: "All" },
                    ...publishers.map((publisher) => ({ value: publisher.id, label: publisher.label })),
                  ]}
                />

                <SearchFilterField>
                  <FieldLabel htmlFor="publisher-channel" label="Publisher Channel" />
                  <StatusMultiSelect
                    id="publisher-channel"
                    options={channelOptions}
                    selected={draftFilters.publisherChannel}
                    onChange={(selected) => updateDraft({ publisherChannel: selected })}
                    placeholder={
                      !draftFilters.publisherId
                        ? "Select publisher first"
                        : isLoadingChannelSourceOptions
                          ? "Loading..."
                          : "All"
                    }
                    disabled={!draftFilters.publisherId || isLoadingChannelSourceOptions}
                  />
                </SearchFilterField>

                <SearchFilterField>
                  <FieldLabel htmlFor="publisher-source" label="Publisher Source" />
                  <StatusMultiSelect
                    id="publisher-source"
                    options={sourceOptions}
                    selected={draftFilters.publisherSource}
                    onChange={(selected) => updateDraft({ publisherSource: selected })}
                    placeholder={
                      !draftFilters.publisherId
                        ? "Select publisher first"
                        : isLoadingChannelSourceOptions
                          ? "Loading..."
                          : "All"
                    }
                    disabled={!draftFilters.publisherId || isLoadingChannelSourceOptions}
                  />
                </SearchFilterField>

                <SearchFilterSelect
                  id="redirect-status"
                  label="Redirect Status"
                  value={draftFilters.redirectStatus}
                  onChange={(value) => updateDraft({ redirectStatus: value })}
                  options={REDIRECT_STATUS_OPTIONS.map((option) => ({ value: option, label: option }))}
                />
              </SearchFilterGrid>

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
                tableFilter={pageFilter}
                onTableFilterChange={setPageFilter}
                filterPlaceholder="Filter current page..."
                selectedCount={selectedIds.length}
                actions={
                  <>
                    <ColumnVisibilitySelect
                      id="publisher-lead-columns"
                      options={columnOptions}
                      selectedKeys={effectiveVisibleKeys}
                      onChange={setVisibleColumnKeys}
                    />
                    <div className="relative w-full sm:w-auto" ref={exportMenuRef}>
                      <button
                        type="button"
                        onClick={() => setExportOpen((current) => !current)}
                        disabled={isExporting || effectiveVisibleKeys.length === 0}
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
                  </>
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
                  filterQuery={pageFilter}
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
                    onPageSizeChange={(size) => {
                      setPageSize(size);
                      setPage(1);
                    }}
                    onPageChange={setPage}
                  />
                </div>
              </ListTableContainer>
            </div>
      </div>
    </PageSection>
  );
}
