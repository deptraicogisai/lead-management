"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, Download, Eye } from "lucide-react";
import { BuyerHttpLogSidebar } from "@/components/logs/buyer-http-log-sidebar";
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
import { ToolbarDropdownMenu, toolbarDropdownItemClassName } from "@/components/ui/toolbar-dropdown-menu";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageSection } from "@/components/ui/state";
import { StatusBadge } from "@/components/ui/status-badge";
import { PublisherTagBadges } from "@/components/ui/publisher-tag-badges";
import { REPORT_PAGE_SIZE_OPTIONS } from "@/lib/pagination";
import { downloadCsv } from "@/lib/csv-export";
import { resolveBuyerHttpExchangeFromLog } from "@/lib/buyer-http-log";
import { useListLoadState } from "@/lib/use-list-load-state";
import { toolbarPrimaryButtonClassName } from "@/lib/button-styles";
import { getStatusBadgePresentation } from "@/lib/status-badge";
import { publisherCellLinkClassName } from "@/lib/typography";
import { cn } from "@/lib/utils";
import {
  defaultBuyerLeadDetailsFilters,
  formatBuyerLeadTableTime,
  formatBuyerLeadTime,
  parseBuyerLeadDetailsFiltersFromSearchParams,
  type BuyerLeadDetailsFilters,
  type BuyerLeadDetailsRow,
} from "@/lib/buyer-lead-details";

type FilterOption = {
  id: string;
  label: string;
};

type BuyerLeadDetailsResponse = {
  items: BuyerLeadDetailsRow[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  filters: {
    products: FilterOption[];
    publishers: FilterOption[];
    buyers: FilterOption[];
    campaigns: FilterOption[];
    pingTrees: FilterOption[];
    publisherTags: string[];
  };
};

const REDIRECT_OPTIONS = ["All", "Redirected", "Not Redirected"];

function RedirectCell({
  label,
  isRedirectCampaign,
}: {
  label: string;
  isRedirectCampaign: boolean;
}) {
  if (!isRedirectCampaign || label === "—") {
    return <span className="whitespace-nowrap text-slate-400 dark:text-slate-500">—</span>;
  }

  const presentation = getStatusBadgePresentation(label, "outline");

  return (
    <span
      className="inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold"
      style={presentation.style}
    >
      {label}
    </span>
  );
}

function buildDefaultFilters(searchParams?: Pick<URLSearchParams, "get">): BuyerLeadDetailsFilters {
  return {
    ...defaultBuyerLeadDetailsFilters,
    ...(searchParams ? parseBuyerLeadDetailsFiltersFromSearchParams(searchParams) : {}),
  };
}

export function BuyerLeadDetailsPage() {
  const searchParams = useSearchParams();
  const [draftFilters, setDraftFilters] = useState<BuyerLeadDetailsFilters>(() =>
    buildDefaultFilters(searchParams)
  );
  const [appliedFilters, setAppliedFilters] = useState<BuyerLeadDetailsFilters>(() =>
    buildDefaultFilters(searchParams)
  );
  const [rows, setRows] = useState<BuyerLeadDetailsRow[]>([]);
  const [products, setProducts] = useState<FilterOption[]>([]);
  const [publishers, setPublishers] = useState<FilterOption[]>([]);
  const [buyers, setBuyers] = useState<FilterOption[]>([]);
  const [campaigns, setCampaigns] = useState<FilterOption[]>([]);
  const [pingTrees, setPingTrees] = useState<FilterOption[]>([]);
  const [publisherTags, setPublisherTags] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(100);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const { isInitialLoad, isRefreshing, beginLoad, endLoad } = useListLoadState();
  const [viewRow, setViewRow] = useState<BuyerLeadDetailsRow | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

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
      if (filters.dateFrom) params.set("dateFrom", new Date(filters.dateFrom).toISOString());
      if (filters.dateTo) params.set("dateTo", new Date(filters.dateTo).toISOString());
      if (filters.productId) params.set("productId", filters.productId);
      if (filters.publisherId) params.set("publisherId", filters.publisherId);
      if (filters.buyerId) params.set("buyerId", filters.buyerId);
      if (filters.campaignId) params.set("campaignId", filters.campaignId);
      if (filters.pingTreeId) params.set("pingTreeId", filters.pingTreeId);
      if (filters.redirectStatus !== "All") params.set("redirectStatus", filters.redirectStatus);
      if (filters.publisherTag) params.set("publisherTag", filters.publisherTag);
      if (filters.status !== "All") params.set("status", filters.status);
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
        const loadedProducts = data.filters.products;

        if (loadedProducts.length > 0 && !filters.productId) {
          const firstProductId = loadedProducts[0].id;
          const nextFilters = { ...filters, productId: firstProductId };
          setProducts(loadedProducts);
          setPublishers(data.filters.publishers);
          setBuyers(data.filters.buyers);
          setCampaigns(data.filters.campaigns);
          setPingTrees(data.filters.pingTrees);
          setPublisherTags(data.filters.publisherTags);
          setDraftFilters(nextFilters);
          setAppliedFilters(nextFilters);
          endLoad();
          return;
        }

        setRows(data.items);
        setTotalItems(data.totalItems);
        setTotalPages(data.totalPages);
        setProducts(loadedProducts);
        setPublishers(data.filters.publishers);
        setBuyers(data.filters.buyers);
        setCampaigns(data.filters.campaigns);
        setPingTrees(data.filters.pingTrees);
        setPublisherTags(data.filters.publisherTags);
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
    const nextFilters = { ...draftFilters, status: "All" };
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

  const buildExportMatrix = (exportRows: BuyerLeadDetailsRow[]) => {
    const headers = [
      "Date",
      "Post",
      "Lead ID",
      "Product",
      "Buyer",
      "Campaign",
      "Ping Tree",
      "Redirect",
      "Post Price",
      "Pub",
      "ADM",
      "TTL",
      "Publisher",
      "Publisher Tags",
      "Source",
      "Time",
    ];

    const matrix = exportRows.map((row) => [
      formatBuyerLeadTableTime(row.postedAt),
      row.postStatus,
      row.displayLeadCode,
      row.productLabel,
      row.buyerLabel,
      row.campaignLabel,
      row.pingTreeLabel,
      row.redirectLabel,
      row.postPrice,
      row.pub,
      row.adm,
      row.ttl,
      row.publisherLabel,
      row.publisherTag || "—",
      row.sourceLabel || "—",
      row.responseTimeLabel,
    ]);

    return { headers, matrix };
  };

  const fetchAllRows = async () => {
    if (totalItems === 0) {
      return [] as BuyerLeadDetailsRow[];
    }

    const maxPageSize = 1000;
    const pages = Math.ceil(totalItems / maxPageSize);
    const allRows: BuyerLeadDetailsRow[] = [];

    for (let nextPage = 1; nextPage <= pages; nextPage += 1) {
      const response = await fetch(`/api/reports/buyer/lead-details?${buildQuery(appliedFilters, nextPage, maxPageSize)}`);
      if (!response.ok) {
        throw new Error("Failed to export buyer lead details.");
      }

      const data = (await response.json()) as BuyerLeadDetailsResponse;
      allRows.push(...data.items);
    }

    return allRows;
  };

  const handleExport = async (mode: "current-page" | "all-pages") => {
    setIsExporting(true);
    setExportOpen(false);

    try {
      if (mode === "all-pages") {
        const exportRows = await fetchAllRows();
        const { headers, matrix } = buildExportMatrix(exportRows);
        downloadCsv("buyer-lead-details-all.csv", headers, matrix);
        return;
      }

      const { headers, matrix } = buildExportMatrix(rows);
      downloadCsv("buyer-lead-details-current-page.csv", headers, matrix);
    } catch {
      // Ignore export errors for now.
    } finally {
      setIsExporting(false);
    }
  };

  const columns: Column<BuyerLeadDetailsRow>[] = useMemo(
    () => [
      {
        key: "postedAt",
        label: "Date",
        sortValue: (row) => new Date(row.postedAt).getTime(),
        render: (row) => (
          <span className="whitespace-nowrap tabular-nums text-slate-700 dark:text-slate-200">
            {formatBuyerLeadTableTime(row.postedAt)}
          </span>
        ),
      },
      {
        key: "postStatus",
        label: "Post",
        sortValue: (row) => row.postStatus,
        render: (row) => <StatusBadge status={row.postStatus} />,
      },
      {
        key: "displayLeadCode",
        label: "Lead ID",
        sortValue: (row) => row.displayLeadCode,
        render: (row) => (
          <button
            type="button"
            onClick={() => setViewRow(row)}
            className="group inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-400 dark:hover:bg-blue-900/40 dark:hover:text-blue-300"
          >
            <Eye size={13} className="shrink-0 text-slate-400 group-hover:text-blue-500 dark:text-slate-500 dark:group-hover:text-blue-400" />
            <span>{row.displayLeadCode}</span>
          </button>
        ),
      },
      {
        key: "productLabel",
        label: "Product",
        sortValue: (row) => row.productLabel,
        render: (row) => <span className="whitespace-nowrap">{row.productLabel}</span>,
      },
      {
        key: "buyerLabel",
        label: "Buyer",
        sortValue: (row) => row.buyerLabel,
        render: (row) => <span className="whitespace-nowrap">{row.buyerLabel || "—"}</span>,
      },
      {
        key: "campaignLabel",
        label: "Campaign",
        sortValue: (row) => row.campaignLabel,
        render: (row) => <span className="whitespace-nowrap">{row.campaignLabel}</span>,
      },
      {
        key: "pingTreeLabel",
        label: "Ping Tree",
        sortValue: (row) => row.pingTreeLabel,
        render: (row) => <span className="whitespace-nowrap">{row.pingTreeLabel}</span>,
      },
      {
        key: "redirectLabel",
        label: "Redirect",
        sortValue: (row) => row.redirectLabel,
        render: (row) => (
          <RedirectCell label={row.redirectLabel} isRedirectCampaign={row.isRedirectCampaign} />
        ),
      },
      {
        key: "postPrice",
        label: "Post Price",
        sortValue: (row) => row.postPrice,
        render: (row) => (
          <span className="whitespace-nowrap tabular-nums text-slate-700 dark:text-slate-200">{row.postPrice}</span>
        ),
      },
      {
        key: "pub",
        label: "Pub",
        sortValue: (row) => row.pub,
        render: (row) => (
          <span className="whitespace-nowrap tabular-nums text-slate-700 dark:text-slate-200">{row.pub}</span>
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
        key: "publisherLabel",
        label: "Publisher",
        sortValue: (row) => row.publisherLabel,
        render: (row) => <span className="whitespace-nowrap">{row.publisherLabel}</span>,
      },
      {
        key: "publisherTag",
        label: "Publisher Tags",
        sortValue: (row) => row.publisherTag,
        render: (row) => <PublisherTagBadges tag={row.publisherTag} />,
      },
      {
        key: "sourceLabel",
        label: "Source",
        sortValue: (row) => row.sourceLabel,
        render: (row) =>
          row.sourceLabel ? (
            <span className={cn("whitespace-nowrap", publisherCellLinkClassName)}>{row.sourceLabel}</span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500">—</span>
          ),
      },
      {
        key: "responseTimeLabel",
        label: "Time",
        sortValue: (row) => row.responseTimeLabel,
        render: (row) => (
          <span className="whitespace-nowrap tabular-nums text-slate-700 dark:text-slate-200">
            {row.responseTimeLabel}
          </span>
        ),
      },
    ],
    []
  );

  const showingFrom = rows.length > 0 ? (page - 1) * pageSize + 1 : 0;
  const showingTo = rows.length > 0 ? Math.min(page * pageSize, totalItems) : 0;

  const productOptions = useMemo(
    () => products.map((product) => ({ value: product.id, label: product.label })),
    [products]
  );
  const publisherOptions = useMemo(
    () => [{ value: "", label: "All" }, ...publishers.map((publisher) => ({ value: publisher.id, label: publisher.label }))],
    [publishers]
  );
  const buyerOptions = useMemo(
    () => [{ value: "", label: "All" }, ...buyers.map((buyer) => ({ value: buyer.id, label: buyer.label }))],
    [buyers]
  );
  const campaignOptions = useMemo(
    () => [{ value: "", label: "All" }, ...campaigns.map((campaign) => ({ value: campaign.id, label: campaign.label }))],
    [campaigns]
  );
  const pingTreeOptions = useMemo(
    () => [{ value: "", label: "All" }, ...pingTrees.map((pingTree) => ({ value: pingTree.id, label: pingTree.label }))],
    [pingTrees]
  );
  const publisherTagOptions = useMemo(
    () => [{ value: "", label: "All" }, ...publisherTags.map((tag) => ({ value: tag, label: tag }))],
    [publisherTags]
  );

  return (
    <PageSection title="Buyer Lead Details">
      <div className="space-y-5">
        <SearchFilterPanel>
          <SearchFilterGrid>
            <SearchFilterField>
              <FieldLabel htmlFor="buyer-lead-id" label="Lead ID" />
              <Input
                id="buyer-lead-id"
                className={SEARCH_FILTER_CONTROL_CLASS}
                value={draftFilters.leadId}
                onChange={(event) => updateDraft({ leadId: event.target.value })}
                placeholder="Lead ID"
              />
            </SearchFilterField>

            <SearchFilterField>
              <FieldLabel htmlFor="buyer-lead-date-range" label="Date" />
              <DateRangePicker
                id="buyer-lead-date-range"
                className={SEARCH_FILTER_DATE_RANGE_CLASS}
                value={{ from: draftFilters.dateFrom, to: draftFilters.dateTo }}
                onChange={(range) => updateDraft({ dateFrom: range.from, dateTo: range.to })}
              />
            </SearchFilterField>

            <SearchFilterSelect
              id="buyer-lead-product"
              label="Product"
              value={draftFilters.productId}
              onChange={(value) => updateDraft({ productId: value, campaignId: "", pingTreeId: "" })}
              options={productOptions}
            />

            <SearchFilterSelect
              id="buyer-lead-publisher"
              label="Publisher"
              value={draftFilters.publisherId}
              onChange={(value) => updateDraft({ publisherId: value })}
              options={publisherOptions}
            />

            <SearchFilterSelect
              id="buyer-lead-buyer"
              label="Buyer"
              value={draftFilters.buyerId}
              onChange={(value) => updateDraft({ buyerId: value })}
              options={buyerOptions}
            />

            <SearchFilterSelect
              id="buyer-lead-campaign"
              label="Buyer Campaign"
              value={draftFilters.campaignId}
              onChange={(value) => updateDraft({ campaignId: value })}
              options={campaignOptions}
            />

            <SearchFilterSelect
              id="buyer-lead-ping-tree"
              label="Ping Tree"
              value={draftFilters.pingTreeId}
              onChange={(value) => updateDraft({ pingTreeId: value })}
              options={pingTreeOptions}
            />

            <SearchFilterSelect
              id="buyer-lead-redirects"
              label="Redirects"
              value={draftFilters.redirectStatus}
              onChange={(value) => updateDraft({ redirectStatus: value })}
              options={REDIRECT_OPTIONS.map((option) => ({ value: option, label: option }))}
            />

            <SearchFilterSelect
              id="buyer-lead-publisher-tags"
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
            loadingMessage="Loading buyer lead details..."
          >
            <DataTable columns={columns} rows={rows} emptyMessage="No buyer deliveries found." />

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

      <BuyerHttpLogSidebar
        open={Boolean(viewRow)}
        onClose={() => setViewRow(null)}
        title={viewRow ? `Buyer Post Log — ${viewRow.displayLeadCode}` : "Buyer Post Log"}
        subtitle={
          viewRow
            ? `${viewRow.campaignLabel || "Campaign"} | ${viewRow.pingTreeName || viewRow.pingTreeType} | ${viewRow.buyerLabel || "Buyer"}`
            : undefined
        }
        postedAt={viewRow ? formatBuyerLeadTime(viewRow.postedAt) : undefined}
        buyerStatus={viewRow?.postStatus}
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
