"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Download } from "lucide-react";
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
import {
  ScrollableTableShell,
  TABLE_STICKY_HEADER_CLASS,
} from "@/components/ui/scrollable-table-shell";
import { ToolbarDropdownMenu, toolbarDropdownItemClassName } from "@/components/ui/toolbar-dropdown-menu";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageSection } from "@/components/ui/state";
import { REPORT_PAGE_SIZE_OPTIONS } from "@/lib/pagination";
import { downloadCsv } from "@/lib/csv-export";
import { useListLoadState } from "@/lib/use-list-load-state";
import { toolbarPrimaryButtonClassName } from "@/lib/button-styles";
import { cn } from "@/lib/utils";
import {
  defaultBuyerPerformanceFilters,
  emptyBuyerPerformanceMetrics,
  formatPerformanceCount,
  formatPerformanceMoney,
  formatPerformancePercent,
  type BuyerPerformanceFilters,
  type BuyerPerformanceMetrics,
  type BuyerPerformanceRow,
} from "@/lib/buyer-performance-summary";
import { buildBuyerLeadDetailsHref, type BuyerLeadScope } from "@/lib/buyer-lead-details";
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

type BuyerPerformanceResponse = {
  items: BuyerPerformanceRow[];
  totals: BuyerPerformanceMetrics;
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  filters: {
    products: FilterOption[];
    buyers: FilterOption[];
    publishers: FilterOption[];
  };
};

const ALL_OPTION = [{ value: "", label: "All" }];

function buildDefaultFilters(): BuyerPerformanceFilters {
  return { ...defaultBuyerPerformanceFilters };
}

type SummaryColumn = {
  key: string;
  label: string;
  valueColorClass: string;
  linkScope?: BuyerLeadScope | "post";
  linkRedirect?: boolean;
  render: (row: BuyerPerformanceRow) => ReactNode;
  renderTotal: (totals: BuyerPerformanceMetrics) => ReactNode;
  csv: (metrics: BuyerPerformanceMetrics) => string;
};

const PERFORMANCE_METRIC_COLORS = {
  post: "text-emerald-600 dark:text-emerald-400",
  rejected: "text-amber-600 dark:text-amber-400",
  accept: "text-emerald-600 dark:text-emerald-400",
  redirect: redirectMetricColorClassName,
  sendError: "text-amber-600 dark:text-amber-400",
  timeout: "text-amber-600 dark:text-amber-400",
} as const;

const SUMMARY_COLUMNS: SummaryColumn[] = [
  {
    key: "post",
    label: "Post",
    valueColorClass: PERFORMANCE_METRIC_COLORS.post,
    linkScope: "post",
    render: (row) => formatPerformanceCount(row.post),
    renderTotal: (totals) => formatPerformanceCount(totals.post),
    csv: (metrics) => String(metrics.post),
  },
  {
    key: "rejected",
    label: "Rejected",
    valueColorClass: PERFORMANCE_METRIC_COLORS.rejected,
    linkScope: "reject",
    render: (row) => formatPerformanceCount(row.rejected),
    renderTotal: (totals) => formatPerformanceCount(totals.rejected),
    csv: (metrics) => String(metrics.rejected),
  },
  {
    key: "accept",
    label: "Accept",
    valueColorClass: PERFORMANCE_METRIC_COLORS.accept,
    linkScope: "accept",
    render: (row) => formatPerformanceCount(row.accept),
    renderTotal: (totals) => formatPerformanceCount(totals.accept),
    csv: (metrics) => String(metrics.accept),
  },
  {
    key: "acceptRate",
    label: "Accept Rate %",
    valueColorClass: "text-slate-700 dark:text-slate-200",
    render: (row) => formatPerformancePercent(row.acceptRate),
    renderTotal: (totals) => formatPerformancePercent(totals.acceptRate),
    csv: (metrics) => formatPerformancePercent(metrics.acceptRate),
  },
  {
    key: "redirect",
    label: "Redirects %",
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
    key: "cpl",
    label: "CPL",
    valueColorClass: "text-slate-700 dark:text-slate-200",
    render: (row) => formatPerformanceMoney(row.cpl),
    renderTotal: (totals) => formatPerformanceMoney(totals.cpl),
    csv: (metrics) => formatPerformanceMoney(metrics.cpl),
  },
  {
    key: "pub",
    label: "Pub",
    valueColorClass: "text-slate-700 dark:text-slate-200",
    render: (row) => formatPerformanceMoney(row.pub),
    renderTotal: (totals) => formatPerformanceMoney(totals.pub),
    csv: (metrics) => formatPerformanceMoney(metrics.pub),
  },
  {
    key: "adm",
    label: "ADM",
    valueColorClass: "text-slate-700 dark:text-slate-200",
    render: (row) => (
      <span className={row.adm < 0 ? PERFORMANCE_METRIC_COLORS.rejected : undefined}>
        {formatPerformanceMoney(row.adm)}
      </span>
    ),
    renderTotal: (totals) => (
      <span className={totals.adm < 0 ? PERFORMANCE_METRIC_COLORS.rejected : undefined}>
        {formatPerformanceMoney(totals.adm)}
      </span>
    ),
    csv: (metrics) => formatPerformanceMoney(metrics.adm),
  },
  {
    key: "ttl",
    label: "TTL",
    valueColorClass: "text-slate-700 dark:text-slate-200",
    render: (row) => formatPerformanceMoney(row.ttl),
    renderTotal: (totals) => formatPerformanceMoney(totals.ttl),
    csv: (metrics) => formatPerformanceMoney(metrics.ttl),
  },
  {
    key: "sendError",
    label: "Send Error",
    valueColorClass: PERFORMANCE_METRIC_COLORS.sendError,
    linkScope: "error",
    render: (row) => formatPerformanceCount(row.sendError),
    renderTotal: (totals) => formatPerformanceCount(totals.sendError),
    csv: (metrics) => String(metrics.sendError),
  },
  {
    key: "timeout",
    label: "Timeout",
    valueColorClass: PERFORMANCE_METRIC_COLORS.timeout,
    linkScope: "timeout",
    render: (row) => (
      <span className="whitespace-nowrap">
        {formatPerformanceCount(row.timeout)}{" "}
        <span>({formatPerformancePercent(row.timeoutRate)})</span>
      </span>
    ),
    renderTotal: (totals) => (
      <span className="whitespace-nowrap">
        {formatPerformanceCount(totals.timeout)}{" "}
        <span>({formatPerformancePercent(totals.timeoutRate)})</span>
      </span>
    ),
    csv: (metrics) => `${metrics.timeout} (${formatPerformancePercent(metrics.timeoutRate)})`,
  },
];

export function BuyerPerformanceSummaryPage() {
  const [draftFilters, setDraftFilters] = useState<BuyerPerformanceFilters>(() => buildDefaultFilters());
  const [appliedFilters, setAppliedFilters] = useState<BuyerPerformanceFilters>(() => buildDefaultFilters());
  const [rows, setRows] = useState<BuyerPerformanceRow[]>([]);
  const [totals, setTotals] = useState<BuyerPerformanceMetrics>(() => emptyBuyerPerformanceMetrics());
  const [products, setProducts] = useState<FilterOption[]>([]);
  const [buyers, setBuyers] = useState<FilterOption[]>([]);
  const [publishers, setPublishers] = useState<FilterOption[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(100);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const { isInitialLoad, isRefreshing, beginLoad, endLoad } = useListLoadState();
  const [exportOpen, setExportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [searchNonce, setSearchNonce] = useState(0);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  const updateDraft = (patch: Partial<BuyerPerformanceFilters>) => {
    setDraftFilters((current) => ({ ...current, ...patch }));
  };

  const buildQuery = useCallback(
    (filters: BuyerPerformanceFilters, nextPage: number, nextPageSize: number) => {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(nextPageSize),
      });

      if (filters.dateFrom) params.set("dateFrom", new Date(filters.dateFrom).toISOString());
      if (filters.dateTo) params.set("dateTo", new Date(filters.dateTo).toISOString());
      if (filters.productId) params.set("productId", filters.productId);
      if (filters.buyerId) params.set("buyerId", filters.buyerId);
      if (filters.publisherId) params.set("publisherId", filters.publisherId);
      if (filters.tableSearch.trim()) params.set("tableSearch", filters.tableSearch.trim());

      return params.toString();
    },
    []
  );

  const loadRows = useCallback(
    async (filters: BuyerPerformanceFilters, nextPage: number, nextPageSize: number) => {
      beginLoad();

      try {
        const response = await fetch(
          `/api/reports/buyer/performance-summary?${buildQuery(filters, nextPage, nextPageSize)}`,
          { cache: "no-store" }
        );
        if (!response.ok) {
          throw new Error("Failed to load buyer performance summary.");
        }

        const data = (await response.json()) as BuyerPerformanceResponse;
        setRows(data.items);
        setTotals(data.totals);
        setTotalItems(data.totalItems);
        setTotalPages(data.totalPages);
        setProducts(data.filters.products);
        setBuyers(data.filters.buyers);
        setPublishers(data.filters.publishers);
      } catch {
        setRows([]);
        setTotals(emptyBuyerPerformanceMetrics());
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
    const response = await fetch(`/api/reports/buyer/performance-summary?${params.toString()}`);
    if (!response.ok) {
      throw new Error("Failed to export buyer performance summary.");
    }

    const data = (await response.json()) as BuyerPerformanceResponse;
    return { items: data.items, totals: data.totals };
  }, [appliedFilters, buildQuery, totalItems]);

  const buildExportMatrix = (exportRows: BuyerPerformanceRow[], exportTotals: BuyerPerformanceMetrics) => {
    const headers = ["Buyer", ...SUMMARY_COLUMNS.map((column) => column.label)];

    const matrix = exportRows.map((row) => [
      row.buyerLabel,
      ...SUMMARY_COLUMNS.map((column) => column.csv(row)),
    ]);

    matrix.push(["Totals", ...SUMMARY_COLUMNS.map((column) => column.csv(exportTotals))]);

    return { headers, matrix };
  };

  const handleExport = async (mode: "current-page" | "all-pages") => {
    setIsExporting(true);
    setExportOpen(false);

    try {
      if (mode === "all-pages") {
        const result = await fetchAllRows();
        const { headers, matrix } = buildExportMatrix(result.items, result.totals);
        downloadCsv("buyer-performance-summary-all.csv", headers, matrix);
        return;
      }

      const { headers, matrix } = buildExportMatrix(rows, totals);
      downloadCsv("buyer-performance-summary-current-page.csv", headers, matrix);
    } catch {
      // Ignore export errors for now.
    } finally {
      setIsExporting(false);
    }
  };

  const showingFrom = rows.length > 0 ? (page - 1) * pageSize + 1 : 0;
  const showingTo = rows.length > 0 ? Math.min(page * pageSize, totalItems) : 0;

  const productOptions = useMemo(
    () => [...ALL_OPTION, ...products.map((product) => ({ value: product.id, label: product.label }))],
    [products]
  );
  const buyerOptions = useMemo(
    () => [...ALL_OPTION, ...buyers.map((buyer) => ({ value: buyer.id, label: buyer.label }))],
    [buyers]
  );
  const publisherOptions = useMemo(
    () => [...ALL_OPTION, ...publishers.map((publisher) => ({ value: publisher.id, label: publisher.label }))],
    [publishers]
  );

  return (
    <PageSection title="Buyer Performance Summary">
      <div className="space-y-5">
        <SearchFilterPanel>
          <SearchFilterGrid>
            <SearchFilterField>
              <FieldLabel htmlFor="buyer-performance-date-range" label="Date" />
              <DateRangePicker
                id="buyer-performance-date-range"
                className={SEARCH_FILTER_DATE_RANGE_CLASS}
                value={{ from: draftFilters.dateFrom, to: draftFilters.dateTo }}
                onChange={(range) => updateDraft({ dateFrom: range.from, dateTo: range.to })}
              />
            </SearchFilterField>

            <SearchFilterSelect
              id="buyer-performance-product"
              label="Product"
              value={draftFilters.productId}
              onChange={(value) => updateDraft({ productId: value })}
              options={productOptions}
            />

            <SearchFilterSelect
              id="buyer-performance-buyer"
              label="Buyer"
              value={draftFilters.buyerId}
              onChange={(value) => updateDraft({ buyerId: value })}
              options={buyerOptions}
            />

            <SearchFilterSelect
              id="buyer-performance-publisher"
              label="Publisher"
              value={draftFilters.publisherId}
              onChange={(value) => updateDraft({ publisherId: value })}
              options={publisherOptions}
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
            filterPlaceholder="Filter..."
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
  row: BuyerPerformanceRow,
  appliedFilters: BuyerPerformanceFilters,
  options?: { scope?: BuyerLeadScope | "post" }
) {
  return buildBuyerLeadDetailsHref({
    buyerId: row.id,
    dateFrom: appliedFilters.dateFrom,
    dateTo: appliedFilters.dateTo,
    productId: appliedFilters.productId,
    scope: options?.scope && options.scope !== "post" ? options.scope : undefined,
  });
}

function PerformanceSummaryTable({
  rows,
  totals,
  appliedFilters,
}: {
  rows: BuyerPerformanceRow[];
  totals: BuyerPerformanceMetrics;
  appliedFilters: BuyerPerformanceFilters;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
        No buyers found for the selected filters.
      </div>
    );
  }

  const headerCellClassName = tableHeaderCellClassName;
  const bodyCellClassName = tableBodyCellClassName;

  return (
    <ScrollableTableShell
      rowCount={rows.length}
      thead={
        <thead className={TABLE_STICKY_HEADER_CLASS}>
          <tr>
            <th className={cn(headerCellClassName, "bg-slate-50 text-left dark:bg-slate-800", metricLinkClassName)}>
              Buyer
            </th>
            {SUMMARY_COLUMNS.map((column) => (
              <th
                key={column.key}
                className={cn(
                  headerCellClassName,
                  "bg-slate-50 text-right dark:bg-slate-800",
                  column.key === "redirect"
                    ? cn(redirectMetricColorClassName, metricLinkClassName)
                    : column.key === "rejected" || column.key === "sendError" || column.key === "timeout"
                      ? cn(PERFORMANCE_METRIC_COLORS.rejected, metricLinkClassName)
                      : column.linkScope || column.linkRedirect
                        ? metricLinkClassName
                        : undefined
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
      }
      tfoot={
        <tfoot className="sticky bottom-0 z-10 bg-slate-100 dark:bg-slate-800">
          <tr className="font-semibold text-slate-800 dark:text-slate-100">
            <td className="border-t border-slate-300 bg-slate-100 px-3 py-2.5 text-left sm:px-4 dark:border-slate-600 dark:bg-slate-800">
              Totals
            </td>
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
                {row.buyerLabel}
              </Link>
            </td>
            {SUMMARY_COLUMNS.map((column) => (
              <td
                key={column.key}
                className={cn(bodyCellClassName, tableNumericCellClassName, column.valueColorClass)}
              >
                {column.linkScope ? (
                  <PerformanceMetricLink
                    count={
                      column.linkScope === "post"
                        ? row.post
                        : column.linkScope === "accept"
                          ? row.accept
                          : column.linkScope === "reject"
                            ? row.rejected
                            : column.linkScope === "timeout"
                              ? row.timeout
                              : row.sendError
                    }
                    colorClass={column.valueColorClass}
                    href={buildRowLeadDetailsHref(row, appliedFilters, { scope: column.linkScope })}
                    suffix={
                      column.key === "timeout" ? (
                        <span> ({formatPerformancePercent(row.timeoutRate)})</span>
                      ) : undefined
                    }
                  />
                ) : column.linkRedirect ? (
                  <PerformanceMetricLink
                    count={row.redirect}
                    colorClass={column.valueColorClass}
                    href={buildRowLeadDetailsHref(row, appliedFilters, { scope: "accept" })}
                    suffix={<span> ({formatPerformancePercent(row.redirectRate)})</span>}
                  />
                ) : (
                  column.render(row)
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </ScrollableTableShell>
  );
}
