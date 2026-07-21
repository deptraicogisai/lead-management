"use client";

import Link from "next/link";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronDown, Download } from "lucide-react";
import { SearchButton } from "@/components/ui/action-buttons";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useSystemSettings } from "@/components/settings/system-settings-context";
import { FieldLabel } from "@/components/ui/form-controls";
import {
  SEARCH_FILTER_DATE_RANGE_CLASS,
  SearchFilterActions,
  SearchFilterField,
  SearchFilterGrid,
  SearchFilterPanel,
  SearchFilterSelect,
} from "@/components/ui/search-filter-layout";
import { ListTableContainer } from "@/components/ui/list-table-container";
import { ListTableToolbar } from "@/components/ui/list-table-toolbar";
import { ToolbarDropdownMenu, toolbarDropdownItemClassName } from "@/components/ui/toolbar-dropdown-menu";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { ScrollableTableShell } from "@/components/ui/scrollable-table-shell";
import { PageSection } from "@/components/ui/state";
import { PublisherTagBadges } from "@/components/ui/publisher-tag-badges";
import { InfoPopover } from "@/components/ui/info-popover";
import { SortableColumnHeader } from "@/components/ui/sortable-column-header";
import { REPORT_PAGE_SIZE_OPTIONS } from "@/lib/pagination";
import { downloadCsv } from "@/lib/csv-export";
import { METRIC_COLUMN_HINTS } from "@/lib/metric-column-hints";
import { filterRecordsByQuery } from "@/lib/table-filter";
import { sortTableRows, type SortDirection, type TableSortState } from "@/lib/table-sort";
import { useListLoadState } from "@/lib/use-list-load-state";
import { toolbarPrimaryButtonClassName } from "@/lib/button-styles";
import { parseDateTimeInTimeZone } from "@/lib/date-range";
import { cn } from "@/lib/utils";
import {
  createDefaultPublisherPerformanceFilters,
  emptyPublisherPerformanceMetrics,
  formatPerformanceCount,
  formatPerformanceMoney,
  formatPerformancePercent,
  type PublisherPerformanceFilters,
  type PublisherPerformanceMetrics,
  type PublisherPerformanceRow,
} from "@/lib/publisher-performance-summary";
import {
  buildPublisherLeadDetailsHref,
  type PublisherLeadScope,
} from "@/lib/publisher-lead-details";
import {
  metricLinkClassName,
  publisherCellLinkClassName,
  redirectMetricColorClassName,
  tableBodyCellClassName,
  tableHeaderCellClassName,
  tableNumericCellClassName,
} from "@/lib/typography";

type FilterOption = {
  id: string;
  label: string;
};

type PublisherPerformanceResponse = {
  items: PublisherPerformanceRow[];
  totals: PublisherPerformanceMetrics;
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  filters: {
    products: FilterOption[];
    publishers: FilterOption[];
    publisherTags: string[];
  };
};

function buildDefaultFilters(timeZone: string): PublisherPerformanceFilters {
  return createDefaultPublisherPerformanceFilters(timeZone);
}

type SummaryColumn = {
  key: string;
  label: string;
  hint?: (typeof METRIC_COLUMN_HINTS)[keyof typeof METRIC_COLUMN_HINTS];
  align: "left" | "right";
  sortable?: boolean;
  sortValue?: (row: PublisherPerformanceRow) => string | number | null | undefined;
  valueColorClass: string;
  linkMetric?: PublisherLeadScope;
  linkRedirect?: boolean;
  render: (row: PublisherPerformanceRow) => ReactNode;
  renderTotal: (totals: PublisherPerformanceMetrics) => ReactNode;
  csv: (metrics: PublisherPerformanceMetrics) => string;
};

const PERFORMANCE_METRIC_COLORS = {
  post: "text-slate-800 dark:text-slate-100",
  sold: "text-slate-400 dark:text-slate-500",
  reject: "text-amber-600 dark:text-amber-400",
  redirect: redirectMetricColorClassName,
} as const;

const SUMMARY_COLUMNS: SummaryColumn[] = [
  {
    key: "post",
    label: "Post",
    align: "right",
    sortable: true,
    sortValue: (row) => row.post,
    valueColorClass: PERFORMANCE_METRIC_COLORS.post,
    linkMetric: "post",
    render: (row) => formatPerformanceCount(row.post),
    renderTotal: (totals) => formatPerformanceCount(totals.post),
    csv: (metrics) => String(metrics.post),
  },
  {
    key: "sold",
    label: "Sold",
    align: "right",
    sortable: true,
    sortValue: (row) => row.sold,
    valueColorClass: PERFORMANCE_METRIC_COLORS.sold,
    linkMetric: "sold",
    render: (row) => formatPerformanceCount(row.sold),
    renderTotal: (totals) => formatPerformanceCount(totals.sold),
    csv: (metrics) => String(metrics.sold),
  },
  {
    key: "reject",
    label: "Reject",
    align: "right",
    sortable: true,
    sortValue: (row) => row.reject,
    valueColorClass: PERFORMANCE_METRIC_COLORS.reject,
    linkMetric: "reject",
    render: (row) => formatPerformanceCount(row.reject),
    renderTotal: (totals) => formatPerformanceCount(totals.reject),
    csv: (metrics) => String(metrics.reject),
  },
  {
    key: "redirect",
    label: "Redirect",
    align: "right",
    sortable: false,
    valueColorClass: PERFORMANCE_METRIC_COLORS.redirect,
    linkRedirect: true,
    render: (row) => (
      <span className={cn("whitespace-nowrap", PERFORMANCE_METRIC_COLORS.redirect)}>
        {formatPerformanceCount(row.redirect)}{" "}
        <span>({formatPerformancePercent(row.redirectRate)})</span>
      </span>
    ),
    renderTotal: (totals) => (
      <span className={cn("whitespace-nowrap", PERFORMANCE_METRIC_COLORS.redirect)}>
        {formatPerformanceCount(totals.redirect)}{" "}
        <span>({formatPerformancePercent(totals.redirectRate)})</span>
      </span>
    ),
    csv: (metrics) => `${metrics.redirect} (${formatPerformancePercent(metrics.redirectRate)})`,
  },
  {
    key: "epl",
    label: "EPL",
    hint: METRIC_COLUMN_HINTS.epl,
    align: "right",
    sortable: true,
    sortValue: (row) => row.epl,
    valueColorClass: "text-slate-700 dark:text-slate-200",
    render: (row) => formatPerformanceMoney(row.epl),
    renderTotal: (totals) => formatPerformanceMoney(totals.epl),
    csv: (metrics) => formatPerformanceMoney(metrics.epl),
  },
  {
    key: "alp",
    label: "ALP",
    hint: METRIC_COLUMN_HINTS.alp,
    align: "right",
    sortable: true,
    sortValue: (row) => row.alp,
    valueColorClass: "text-slate-700 dark:text-slate-200",
    render: (row) => formatPerformanceMoney(row.alp),
    renderTotal: (totals) => formatPerformanceMoney(totals.alp),
    csv: (metrics) => formatPerformanceMoney(metrics.alp),
  },
  {
    key: "pub",
    label: "Pub",
    hint: METRIC_COLUMN_HINTS.pub,
    align: "right",
    sortable: true,
    sortValue: (row) => row.pub,
    valueColorClass: "text-slate-700 dark:text-slate-200",
    render: (row) => formatPerformanceMoney(row.pub),
    renderTotal: (totals) => formatPerformanceMoney(totals.pub),
    csv: (metrics) => formatPerformanceMoney(metrics.pub),
  },
  {
    key: "adm",
    label: "ADM",
    hint: METRIC_COLUMN_HINTS.adm,
    align: "right",
    sortable: true,
    sortValue: (row) => row.adm,
    valueColorClass: "text-slate-700 dark:text-slate-200",
    render: (row) => (
      <span className={row.adm < 0 ? PERFORMANCE_METRIC_COLORS.reject : undefined}>
        {formatPerformanceMoney(row.adm)}
      </span>
    ),
    renderTotal: (totals) => (
      <span className={totals.adm < 0 ? PERFORMANCE_METRIC_COLORS.reject : undefined}>
        {formatPerformanceMoney(totals.adm)}
      </span>
    ),
    csv: (metrics) => formatPerformanceMoney(metrics.adm),
  },
  {
    key: "ttl",
    label: "TTL",
    hint: METRIC_COLUMN_HINTS.ttl,
    align: "right",
    sortable: true,
    sortValue: (row) => row.ttl,
    valueColorClass: "text-slate-700 dark:text-slate-200",
    render: (row) => formatPerformanceMoney(row.ttl),
    renderTotal: (totals) => formatPerformanceMoney(totals.ttl),
    csv: (metrics) => formatPerformanceMoney(metrics.ttl),
  },
  {
    key: "revShare",
    label: "Rev-Share",
    align: "right",
    sortable: true,
    sortValue: (row) => row.revShare,
    valueColorClass: "text-slate-700 dark:text-slate-200",
    render: (row) => formatPerformancePercent(row.revShare),
    renderTotal: (totals) => formatPerformancePercent(totals.revShare),
    csv: (metrics) => formatPerformancePercent(metrics.revShare),
  },
];

export function PublisherPerformanceSummaryPage() {
  const { timeZone } = useSystemSettings();
  const [draftFilters, setDraftFilters] = useState<PublisherPerformanceFilters>(() =>
    buildDefaultFilters(timeZone)
  );
  const [appliedFilters, setAppliedFilters] = useState<PublisherPerformanceFilters>(() =>
    buildDefaultFilters(timeZone)
  );
  const [rows, setRows] = useState<PublisherPerformanceRow[]>([]);
  const [totals, setTotals] = useState<PublisherPerformanceMetrics>(() => emptyPublisherPerformanceMetrics());
  const [products, setProducts] = useState<FilterOption[]>([]);
  const [publishers, setPublishers] = useState<FilterOption[]>([]);
  const [publisherTags, setPublisherTags] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(100);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const { isInitialLoad, isRefreshing, beginLoad, endLoad } = useListLoadState();
  const [exportOpen, setExportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [searchNonce, setSearchNonce] = useState(0);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const [pageFilter, setPageFilter] = useState("");

  const updateDraft = (patch: Partial<PublisherPerformanceFilters>) => {
    setDraftFilters((current) => ({ ...current, ...patch }));
  };

  const buildQuery = useCallback(
    (filters: PublisherPerformanceFilters, nextPage: number, nextPageSize: number) => {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(nextPageSize),
      });

      const dateFrom = parseDateTimeInTimeZone(filters.dateFrom, timeZone);
      const dateTo = parseDateTimeInTimeZone(filters.dateTo, timeZone);
      if (dateFrom) params.set("dateFrom", dateFrom.toISOString());
      if (dateTo) params.set("dateTo", dateTo.toISOString());
      if (filters.productId) params.set("productId", filters.productId);
      if (filters.publisherId) params.set("publisherId", filters.publisherId);
      if (filters.publisherTag) params.set("publisherTag", filters.publisherTag);
      if (filters.tableSearch.trim()) params.set("tableSearch", filters.tableSearch.trim());

      return params.toString();
    },
    [timeZone]
  );

  const loadRows = useCallback(
    async (filters: PublisherPerformanceFilters, nextPage: number, nextPageSize: number) => {
      beginLoad();

      try {
        const response = await fetch(
          `/api/reports/publisher/performance-summary?${buildQuery(filters, nextPage, nextPageSize)}`,
          { cache: "no-store" }
        );
        if (!response.ok) {
          throw new Error("Failed to load publisher performance summary.");
        }

        const data = (await response.json()) as PublisherPerformanceResponse;
        setRows(data.items);
        setTotals(data.totals);
        setTotalItems(data.totalItems);
        setTotalPages(data.totalPages);
        setProducts(data.filters.products);
        setPublishers(data.filters.publishers);
        setPublisherTags(data.filters.publisherTags);
      } catch {
        setRows([]);
        setTotals(emptyPublisherPerformanceMetrics());
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
    setAppliedFilters({ ...draftFilters });
    setPage(1);
    setPageFilter("");
    setSearchNonce((current) => current + 1);
  };

  const handleClearAll = () => {
    const defaults = buildDefaultFilters(timeZone);
    setDraftFilters(defaults);
    setAppliedFilters(defaults);
    setPage(1);
    setPageFilter("");
  };

  const fetchAllRows = useCallback(async () => {
    const params = new URLSearchParams(buildQuery(appliedFilters, 1, Math.max(totalItems, 1)));
    const response = await fetch(`/api/reports/publisher/performance-summary?${params.toString()}`);
    if (!response.ok) {
      throw new Error("Failed to export publisher performance summary.");
    }

    const data = (await response.json()) as PublisherPerformanceResponse;
    return { items: data.items, totals: data.totals };
  }, [appliedFilters, buildQuery, totalItems]);

  const buildExportMatrix = (exportRows: PublisherPerformanceRow[], exportTotals: PublisherPerformanceMetrics) => {
    const headers = ["Publisher", "Publisher Tags", ...SUMMARY_COLUMNS.map((column) => column.label)];

    const matrix = exportRows.map((row) => [
      row.publisherLabel,
      row.publisherTag || "—",
      ...SUMMARY_COLUMNS.map((column) => column.csv(row)),
    ]);

    matrix.push(["Totals", "", ...SUMMARY_COLUMNS.map((column) => column.csv(exportTotals))]);

    return { headers, matrix };
  };

  const handleExport = async (mode: "current-page" | "all-pages") => {
    setIsExporting(true);
    setExportOpen(false);

    try {
      if (mode === "all-pages") {
        const result = await fetchAllRows();
        const { headers, matrix } = buildExportMatrix(result.items, result.totals);
        downloadCsv("publisher-performance-summary-all.csv", headers, matrix);
        return;
      }

      const { headers, matrix } = buildExportMatrix(filteredRows, totals);
      downloadCsv("publisher-performance-summary-current-page.csv", headers, matrix);
    } catch {
      // Ignore export errors for now.
    } finally {
      setIsExporting(false);
    }
  };

  const deferredPageFilter = useDeferredValue(pageFilter);
  const isFilterPending = deferredPageFilter !== pageFilter;
  const filteredRows = useMemo(
    () =>
      filterRecordsByQuery(rows, deferredPageFilter, [
        "publisherLabel",
        "publisherTag",
        (row) => row.id,
      ]),
    [deferredPageFilter, rows]
  );

  const showingFrom = rows.length > 0 ? (page - 1) * pageSize + 1 : 0;
  const showingTo = rows.length > 0 ? Math.min(page * pageSize, totalItems) : 0;

  const productOptions = useMemo(
    () => [{ value: "", label: "All" }, ...products.map((product) => ({ value: product.id, label: product.label }))],
    [products]
  );
  const publisherOptions = useMemo(
    () => [{ value: "", label: "All" }, ...publishers.map((publisher) => ({ value: publisher.id, label: publisher.label }))],
    [publishers]
  );
  const publisherTagOptions = useMemo(
    () => [{ value: "", label: "All" }, ...publisherTags.map((tag) => ({ value: tag, label: tag }))],
    [publisherTags]
  );

  return (
    <PageSection title="Publisher Performance Summary">
      <div className="space-y-5">
        <SearchFilterPanel>
          <SearchFilterGrid>
            <SearchFilterField>
              <FieldLabel htmlFor="performance-date-range" label="Date" />
              <DateRangePicker
                id="performance-date-range"
                className={SEARCH_FILTER_DATE_RANGE_CLASS}
                value={{ from: draftFilters.dateFrom, to: draftFilters.dateTo }}
                onChange={(range) => updateDraft({ dateFrom: range.from, dateTo: range.to })}
              />
            </SearchFilterField>

            <SearchFilterSelect
              id="performance-product"
              label="Product"
              value={draftFilters.productId}
              onChange={(value) => updateDraft({ productId: value })}
              options={productOptions}
            />

            <SearchFilterSelect
              id="performance-publisher"
              label="Publisher"
              value={draftFilters.publisherId}
              onChange={(value) => updateDraft({ publisherId: value })}
              options={publisherOptions}
            />

            <SearchFilterSelect
              id="performance-publisher-tags"
              label="Publisher Tags"
              value={draftFilters.publisherTag}
              onChange={(value) => updateDraft({ publisherTag: value })}
              options={publisherTagOptions}
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
            loadingMessage="Loading performance summary..."
          >
            <PerformanceSummaryTable
              rows={filteredRows}
              sourceRowCount={rows.length}
              columnLayoutKey={rows.map((row) => row.id).join("|")}
              totals={totals}
              appliedFilters={appliedFilters}
              isFilterPending={isFilterPending}
              emptyMessage={
                pageFilter.trim()
                  ? "No matching rows on this page."
                  : "No publishers found for the selected filters."
              }
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

function PerformanceMetricLink({
  count,
  href,
  suffix,
  colorClass,
}: {
  count: number;
  href: string;
  suffix?: ReactNode;
  colorClass: string;
}) {
  const label = formatPerformanceCount(count);
  const linkClass = cn(metricLinkClassName, colorClass);

  if (count <= 0) {
    return (
      <span className={cn("whitespace-nowrap", colorClass)}>
        {label}
        {suffix}
      </span>
    );
  }

  return (
    <span className="whitespace-nowrap">
      <Link href={href} className={linkClass}>
        {label}
      </Link>
      {suffix}
    </span>
  );
}

function buildRowLeadDetailsHref(
  row: PublisherPerformanceRow,
  appliedFilters: PublisherPerformanceFilters,
  options?: { leadScope?: PublisherLeadScope; redirectStatus?: "Redirected" | "Not Redirected" }
) {
  return buildPublisherLeadDetailsHref({
    publisherId: row.id,
    dateFrom: appliedFilters.dateFrom,
    dateTo: appliedFilters.dateTo,
    productId: appliedFilters.productId,
    leadScope: options?.leadScope,
    redirectStatus: options?.redirectStatus,
  });
}

function PerformanceSummaryTable({
  rows,
  sourceRowCount,
  columnLayoutKey = "",
  totals,
  appliedFilters,
  isFilterPending = false,
  emptyMessage = "No publishers found for the selected filters.",
}: {
  rows: PublisherPerformanceRow[];
  sourceRowCount: number;
  columnLayoutKey?: string;
  totals: PublisherPerformanceMetrics;
  appliedFilters: PublisherPerformanceFilters;
  isFilterPending?: boolean;
  emptyMessage?: string;
}) {
  const [sortState, setSortState] = useState<TableSortState | null>(null);

  const sortedRows = useMemo(() => {
    if (!sortState) return rows;

    if (sortState.key === "publisher") {
      return sortTableRows(rows, (row) => row.publisherLabel, sortState.direction);
    }

    const column = SUMMARY_COLUMNS.find((item) => item.key === sortState.key);
    if (!column?.sortable || !column.sortValue) return rows;

    return sortTableRows(rows, column.sortValue, sortState.direction);
  }, [rows, sortState]);

  const handleSort = (columnKey: string) => {
    setSortState((current) => {
      if (current?.key === columnKey) {
        const nextDirection: SortDirection = current.direction === "asc" ? "desc" : "asc";
        return { key: columnKey, direction: nextDirection };
      }
      return { key: columnKey, direction: "asc" };
    });
  };

  if (sourceRowCount === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
        {emptyMessage}
      </div>
    );
  }

  const headerCellClassName = tableHeaderCellClassName;
  const bodyCellClassName = tableBodyCellClassName;
  const columnCount = SUMMARY_COLUMNS.length + 2;

  const renderHeaderLabel = (column: SummaryColumn) =>
    column.hint ? (
      <InfoPopover title={column.hint.title} description={column.hint.description}>
        {column.label}
      </InfoPopover>
    ) : (
      column.label
    );

  return (
    <div className={cn("transition-opacity duration-150 ease-out", isFilterPending && "opacity-70")}>
      <ScrollableTableShell
        rowCount={sourceRowCount}
        freezeColumnWidths
        columnLayoutKey={columnLayoutKey}
        bodyClassName="max-h-[min(420px,55vh)] overflow-y-auto"
        thead={
          <tr>
            <th className={cn(headerCellClassName, "text-left", metricLinkClassName)}>
              <SortableColumnHeader
                label="Publisher"
                active={sortState?.key === "publisher"}
                direction={sortState?.key === "publisher" ? sortState.direction : undefined}
                onClick={() => handleSort("publisher")}
              />
            </th>
            <th className={cn(headerCellClassName, "text-left")}>Publisher Tags</th>
            {SUMMARY_COLUMNS.map((column) => (
              <th
                key={column.key}
                className={cn(
                  headerCellClassName,
                  "text-right",
                  column.key === "redirect"
                    ? cn(redirectMetricColorClassName, metricLinkClassName)
                    : column.key === "reject"
                      ? cn(PERFORMANCE_METRIC_COLORS.reject, metricLinkClassName)
                      : (column.linkMetric || column.linkRedirect) && metricLinkClassName
                )}
              >
                {column.sortable ? (
                  <SortableColumnHeader
                    label={renderHeaderLabel(column)}
                    align="right"
                    active={sortState?.key === column.key}
                    direction={sortState?.key === column.key ? sortState.direction : undefined}
                    onClick={() => handleSort(column.key)}
                  />
                ) : (
                  renderHeaderLabel(column)
                )}
              </th>
            ))}
          </tr>
        }
        tfoot={
          <tfoot>
            <tr className="font-semibold text-slate-800 dark:text-slate-100">
              <td className="border-t border-slate-300 bg-slate-100 px-3 py-2.5 text-left sm:px-4 dark:border-slate-600 dark:bg-slate-800">
                Totals
              </td>
              <td className="border-t border-slate-300 bg-slate-100 px-3 py-2.5 sm:px-4 dark:border-slate-600 dark:bg-slate-800" />
              {SUMMARY_COLUMNS.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    "border-t border-slate-300 bg-slate-100 px-3 py-2.5 text-right tabular-nums sm:px-4 dark:border-slate-600 dark:bg-slate-800",
                    column.valueColorClass
                  )}
                >
                  {column.renderTotal(totals)}
                </td>
              ))}
            </tr>
          </tfoot>
        }
      >
        <tbody>
          {sortedRows.length === 0 ? (
            <tr>
              <td
                colSpan={columnCount}
                className="border-b border-slate-100 px-3 py-8 text-center text-sm text-slate-500 dark:border-slate-700/80 dark:text-slate-400"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sortedRows.map((row) => (
              <tr
                key={row.id}
                className="bg-white transition-colors hover:bg-blue-50/50 dark:bg-slate-900 dark:hover:bg-blue-400/10"
              >
                <td className={cn(bodyCellClassName, "whitespace-nowrap")}>
                  <Link
                    href={buildRowLeadDetailsHref(row, appliedFilters)}
                    className={publisherCellLinkClassName}
                  >
                    {row.publisherLabel}
                  </Link>
                </td>
                <td className={cn(bodyCellClassName, "text-slate-600 dark:text-slate-200")}>
                  <PublisherTagBadges tag={row.publisherTag} />
                </td>
                {SUMMARY_COLUMNS.map((column) => (
                  <td
                    key={column.key}
                    className={cn(bodyCellClassName, tableNumericCellClassName, column.valueColorClass)}
                  >
                    {column.linkMetric ? (
                      <PerformanceMetricLink
                        count={row[column.linkMetric]}
                        colorClass={column.valueColorClass}
                        href={buildRowLeadDetailsHref(row, appliedFilters, {
                          leadScope: column.linkMetric,
                        })}
                      />
                    ) : column.linkRedirect ? (
                      <PerformanceMetricLink
                        count={row.redirect}
                        colorClass={column.valueColorClass}
                        href={buildRowLeadDetailsHref(row, appliedFilters, {
                          redirectStatus: "Redirected",
                        })}
                        suffix={
                          <span>
                            {" "}
                            ({formatPerformancePercent(row.redirectRate)})
                          </span>
                        }
                      />
                    ) : (
                      column.render(row)
                    )}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </ScrollableTableShell>
    </div>
  );
}
