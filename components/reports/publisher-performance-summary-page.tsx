"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Download } from "lucide-react";
import { SearchButton } from "@/components/ui/action-buttons";
import { DateRangePicker } from "@/components/ui/date-range-picker";
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
import { PageSection } from "@/components/ui/state";
import { PublisherTagBadges } from "@/components/ui/publisher-tag-badges";
import { REPORT_PAGE_SIZE_OPTIONS } from "@/lib/pagination";
import { downloadCsv } from "@/lib/csv-export";
import { useListLoadState } from "@/lib/use-list-load-state";
import { toolbarPrimaryButtonClassName } from "@/lib/button-styles";
import { cn } from "@/lib/utils";
import {
  defaultPublisherPerformanceFilters,
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

function buildDefaultFilters(): PublisherPerformanceFilters {
  return { ...defaultPublisherPerformanceFilters };
}

type SummaryColumn = {
  key: string;
  label: string;
  align: "left" | "right";
  valueColorClass: string;
  linkMetric?: PublisherLeadScope;
  linkRedirect?: boolean;
  render: (row: PublisherPerformanceRow) => ReactNode;
  renderTotal: (totals: PublisherPerformanceMetrics) => ReactNode;
  csv: (metrics: PublisherPerformanceMetrics) => string;
};

const PERFORMANCE_METRIC_COLORS = {
  post: "text-slate-800 dark:text-slate-100",
  lead: "text-emerald-600 dark:text-emerald-400",
  sold: "text-slate-400 dark:text-slate-500",
  reject: "text-amber-600 dark:text-amber-400",
  redirect: redirectMetricColorClassName,
} as const;

const SUMMARY_COLUMNS: SummaryColumn[] = [
  {
    key: "post",
    label: "Post",
    align: "right",
    valueColorClass: PERFORMANCE_METRIC_COLORS.post,
    linkMetric: "post",
    render: (row) => formatPerformanceCount(row.post),
    renderTotal: (totals) => formatPerformanceCount(totals.post),
    csv: (metrics) => String(metrics.post),
  },
  {
    key: "lead",
    label: "Lead",
    align: "right",
    valueColorClass: PERFORMANCE_METRIC_COLORS.lead,
    linkMetric: "lead",
    render: (row) => formatPerformanceCount(row.lead),
    renderTotal: (totals) => formatPerformanceCount(totals.lead),
    csv: (metrics) => String(metrics.lead),
  },
  {
    key: "sold",
    label: "Sold",
    align: "right",
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
    align: "right",
    valueColorClass: "text-slate-700 dark:text-slate-200",
    render: (row) => formatPerformanceMoney(row.epl),
    renderTotal: (totals) => formatPerformanceMoney(totals.epl),
    csv: (metrics) => formatPerformanceMoney(metrics.epl),
  },
  {
    key: "alp",
    label: "ALP",
    align: "right",
    valueColorClass: "text-slate-700 dark:text-slate-200",
    render: (row) => formatPerformanceMoney(row.alp),
    renderTotal: (totals) => formatPerformanceMoney(totals.alp),
    csv: (metrics) => formatPerformanceMoney(metrics.alp),
  },
  {
    key: "pub",
    label: "Pub",
    align: "right",
    valueColorClass: "text-slate-700 dark:text-slate-200",
    render: (row) => formatPerformanceMoney(row.pub),
    renderTotal: (totals) => formatPerformanceMoney(totals.pub),
    csv: (metrics) => formatPerformanceMoney(metrics.pub),
  },
  {
    key: "adm",
    label: "ADM",
    align: "right",
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
    align: "right",
    valueColorClass: "text-slate-700 dark:text-slate-200",
    render: (row) => formatPerformanceMoney(row.ttl),
    renderTotal: (totals) => formatPerformanceMoney(totals.ttl),
    csv: (metrics) => formatPerformanceMoney(metrics.ttl),
  },
  {
    key: "revShare",
    label: "Rev-Share",
    align: "right",
    valueColorClass: "text-slate-700 dark:text-slate-200",
    render: (row) => formatPerformancePercent(row.revShare),
    renderTotal: (totals) => formatPerformancePercent(totals.revShare),
    csv: (metrics) => formatPerformancePercent(metrics.revShare),
  },
];

export function PublisherPerformanceSummaryPage() {
  const [draftFilters, setDraftFilters] = useState<PublisherPerformanceFilters>(() => buildDefaultFilters());
  const [appliedFilters, setAppliedFilters] = useState<PublisherPerformanceFilters>(() => buildDefaultFilters());
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

  const updateDraft = (patch: Partial<PublisherPerformanceFilters>) => {
    setDraftFilters((current) => ({ ...current, ...patch }));
  };

  const buildQuery = useCallback(
    (filters: PublisherPerformanceFilters, nextPage: number, nextPageSize: number) => {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(nextPageSize),
      });

      if (filters.dateFrom) params.set("dateFrom", new Date(filters.dateFrom).toISOString());
      if (filters.dateTo) params.set("dateTo", new Date(filters.dateTo).toISOString());
      if (filters.productId) params.set("productId", filters.productId);
      if (filters.publisherId) params.set("publisherId", filters.publisherId);
      if (filters.publisherTag) params.set("publisherTag", filters.publisherTag);
      if (filters.tableSearch.trim()) params.set("tableSearch", filters.tableSearch.trim());

      return params.toString();
    },
    []
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
    setSearchNonce((current) => current + 1);
  };

  const handleClearAll = () => {
    const defaults = buildDefaultFilters();
    setDraftFilters(defaults);
    setAppliedFilters(defaults);
    setPage(1);
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

      const { headers, matrix } = buildExportMatrix(rows, totals);
      downloadCsv("publisher-performance-summary-current-page.csv", headers, matrix);
    } catch {
      // Ignore export errors for now.
    } finally {
      setIsExporting(false);
    }
  };

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
            tableFilter={draftFilters.tableSearch}
            onTableFilterChange={(value) => updateDraft({ tableSearch: value })}
            onTableFilterSubmit={handleSearch}
            filterPlaceholder="Search publisher..."
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
            <PerformanceSummaryTable rows={rows} totals={totals} appliedFilters={appliedFilters} />

            <div className="mt-4">
              <PaginationControls
                page={page}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
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
  totals,
  appliedFilters,
}: {
  rows: PublisherPerformanceRow[];
  totals: PublisherPerformanceMetrics;
  appliedFilters: PublisherPerformanceFilters;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
        No publishers found for the selected filters.
      </div>
    );
  }

  const headerCellClassName = tableHeaderCellClassName;
  const bodyCellClassName = tableBodyCellClassName;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <p className="border-b border-slate-200 px-3 py-2 text-xs text-slate-500 sm:hidden dark:border-slate-700 dark:text-slate-400">
        Swipe horizontally to see more columns
      </p>
      <div className="relative max-h-[min(480px,62vh)] overflow-auto overscroll-x-contain">
        <table className="min-w-max w-full border-separate border-spacing-0 text-sm tabular-nums">
          <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className={cn(headerCellClassName, "text-left", metricLinkClassName)}>Publisher</th>
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
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
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
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 z-10 bg-slate-100 dark:bg-slate-800">
            <tr className="font-semibold text-slate-800 dark:text-slate-100">
              <td className="border-t border-slate-300 px-3 py-2.5 text-left sm:px-4 dark:border-slate-600">Totals</td>
              <td className="border-t border-slate-300 px-3 py-2.5 sm:px-4 dark:border-slate-600" />
              {SUMMARY_COLUMNS.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    "border-t border-slate-300 px-3 py-2.5 text-right tabular-nums sm:px-4 dark:border-slate-600",
                    column.valueColorClass
                  )}
                >
                  {column.renderTotal(totals)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
