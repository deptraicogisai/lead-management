"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronDown, Download, Eye, ScrollText } from "lucide-react";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { StatusMultiSelect } from "@/components/ui/status-multi-select";
import { useSystemSettings } from "@/components/settings/system-settings-context";
import { PublisherTagBadges } from "@/components/ui/publisher-tag-badges";
import { REPORT_PAGE_SIZE_OPTIONS } from "@/lib/pagination";
import { downloadCsv } from "@/lib/csv-export";
import { resolveBuyerHttpExchangeFromLog } from "@/lib/buyer-http-log";
import { filterRowsByQuery } from "@/lib/table-filter";
import { useListLoadState } from "@/lib/use-list-load-state";
import { toolbarPrimaryButtonClassName } from "@/lib/button-styles";
import { getStatusBadgePresentation } from "@/lib/status-badge";
import { publisherCellLinkClassName } from "@/lib/typography";
import { parseDateTimeInTimeZone } from "@/lib/date-range";
import {
  fetchPublisherChannelSourceOptions,
  serializeCommaSeparatedFilter,
  type PublisherFilterOption,
} from "@/lib/publisher-channel-source-filters";
import { cn } from "@/lib/utils";
import {
  createDefaultBuyerLeadDetailsFilters,
  formatBuyerLeadTableTime,
  formatBuyerLeadTime,
  parseBuyerLeadDetailsFiltersFromSearchParams,
  BUYER_LEAD_DETAILS_STATUS_OPTIONS,
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

function buildDefaultFilters(
  timeZone: string,
  searchParams?: Pick<URLSearchParams, "get">
): BuyerLeadDetailsFilters {
  return {
    ...createDefaultBuyerLeadDetailsFilters(timeZone),
    ...(searchParams ? parseBuyerLeadDetailsFiltersFromSearchParams(searchParams) : {}),
  };
}

export function BuyerLeadDetailsPage() {
  const searchParams = useSearchParams();
  const { timeZone } = useSystemSettings();
  const [draftFilters, setDraftFilters] = useState<BuyerLeadDetailsFilters>(() =>
    buildDefaultFilters(timeZone, searchParams)
  );
  const [appliedFilters, setAppliedFilters] = useState<BuyerLeadDetailsFilters>(() =>
    buildDefaultFilters(timeZone, searchParams)
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
  const [searchNonce, setSearchNonce] = useState(0);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const [channelOptions, setChannelOptions] = useState<PublisherFilterOption[]>([]);
  const [sourceOptions, setSourceOptions] = useState<PublisherFilterOption[]>([]);
  const [isLoadingChannelSourceOptions, setIsLoadingChannelSourceOptions] = useState(false);
  const [pageFilter, setPageFilter] = useState("");

  const updateDraft = (patch: Partial<BuyerLeadDetailsFilters>) => {
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
    (filters: BuyerLeadDetailsFilters, nextPage: number, nextPageSize: number) => {
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
      if (filters.publisherId) params.set("publisherId", filters.publisherId);
      const channelFilter = serializeCommaSeparatedFilter(filters.publisherChannel);
      if (channelFilter) params.set("publisherChannel", channelFilter);
      const sourceFilter = serializeCommaSeparatedFilter(filters.publisherSource);
      if (sourceFilter) params.set("publisherSource", sourceFilter);
      if (filters.buyerId) params.set("buyerId", filters.buyerId);
      if (filters.campaignId) params.set("campaignId", filters.campaignId);
      if (filters.pingTreeId) params.set("pingTreeId", filters.pingTreeId);
      if (filters.redirectStatus !== "All") params.set("redirectStatus", filters.redirectStatus);
      if (filters.publisherTag) params.set("publisherTag", filters.publisherTag);
      if (filters.status !== "All") params.set("status", filters.status);
      if (filters.tableSearch.trim()) params.set("tableSearch", filters.tableSearch.trim());

      return params.toString();
    },
    [timeZone]
  );

  const loadRows = useCallback(
    async (filters: BuyerLeadDetailsFilters, nextPage: number, nextPageSize: number) => {
      beginLoad();

      try {
        const response = await fetch(
          `/api/reports/buyer/lead-details?${buildQuery(filters, nextPage, nextPageSize)}`,
          { cache: "no-store" }
        );
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
    const firstProductId = products[0]?.id ?? "";
    const nextFilters = { ...defaults, productId: firstProductId };
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setPage(1);
    setPageFilter("");
  };

  const buildExportMatrix = (exportRows: BuyerLeadDetailsRow[], selectedKeys: string[]) => {
    const exportColumns: Array<{
      key: string;
      label: string;
      value: (row: BuyerLeadDetailsRow) => string;
    }> = [
      {
        key: "postedAt",
        label: "Date",
        value: (row) => formatBuyerLeadTableTime(row.postedAt, timeZone),
      },
      { key: "postStatus", label: "Status", value: (row) => row.postStatus },
      { key: "displayLeadCode", label: "Lead ID", value: (row) => row.displayLeadCode },
      { key: "productLabel", label: "Product", value: (row) => row.productLabel },
      { key: "buyerLabel", label: "Buyer", value: (row) => row.buyerLabel },
      { key: "campaignLabel", label: "Campaign", value: (row) => row.campaignLabel },
      { key: "pingTreeLabel", label: "Ping Tree", value: (row) => row.pingTreeLabel },
      { key: "redirectLabel", label: "Redirect", value: (row) => row.redirectLabel },
      { key: "postPrice", label: "Post Price", value: (row) => row.postPrice },
      { key: "pub", label: "Pub", value: (row) => row.pub },
      { key: "adm", label: "ADM", value: (row) => row.adm },
      { key: "ttl", label: "TTL", value: (row) => row.ttl },
      { key: "publisherLabel", label: "Publisher", value: (row) => row.publisherLabel },
      { key: "publisherChannel", label: "Publisher Channel", value: (row) => row.publisherChannel },
      { key: "publisherSource", label: "Publisher Source", value: (row) => row.publisherSource },
      { key: "publisherTag", label: "Publisher Tags", value: (row) => row.publisherTag || "—" },
      { key: "responseTimeLabel", label: "Time", value: (row) => row.responseTimeLabel },
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

    const selectedKeys = normalizeVisibleColumnKeys(visibleColumnKeys, [
      "postedAt",
      "postStatus",
      "displayLeadCode",
      "productLabel",
      "buyerLabel",
      "campaignLabel",
      "pingTreeLabel",
      "redirectLabel",
      "postPrice",
      "pub",
      "adm",
      "ttl",
      "publisherLabel",
      "publisherChannel",
      "publisherSource",
      "publisherTag",
      "responseTimeLabel",
    ]);

    try {
      if (mode === "all-pages") {
        const exportRows = await fetchAllRows();
        const { headers, matrix } = buildExportMatrix(exportRows, selectedKeys);
        downloadCsv("buyer-lead-details-all.csv", headers, matrix);
        return;
      }

      const pageRows = filterRowsByQuery(rows, columns, pageFilter);
      const { headers, matrix } = buildExportMatrix(pageRows, selectedKeys);
      downloadCsv("buyer-lead-details-current-page.csv", headers, matrix);
    } catch {
      // Ignore export errors for now.
    } finally {
      setIsExporting(false);
    }
  };

  const allColumns: Column<BuyerLeadDetailsRow>[] = useMemo(
    () => [
      {
        key: "postedAt",
        label: "Date",
        sortValue: (row) => new Date(row.postedAt).getTime(),
        render: (row) => (
          <span className="whitespace-nowrap tabular-nums text-slate-700 dark:text-slate-200">
            {formatBuyerLeadTableTime(row.postedAt, timeZone)}
          </span>
        ),
      },
      {
        key: "postStatus",
        label: "Status",
        sortValue: (row) => row.postStatus,
        render: (row) => <StatusBadge status={row.postStatus} />,
      },
      {
        key: "displayLeadCode",
        label: "Lead ID",
        sortValue: (row) => row.displayLeadCode,
        render: (row) => (
          <div className="inline-flex items-center gap-1.5">
            <Link
              href={`/leads/${encodeURIComponent(row.leadId)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-400 dark:hover:bg-blue-900/40 dark:hover:text-blue-300"
            >
              <Eye size={13} className="shrink-0 text-slate-400 group-hover:text-blue-500 dark:text-slate-500 dark:group-hover:text-blue-400" />
              <span>{row.displayLeadCode}</span>
            </Link>
            <button
              type="button"
              onClick={() => setViewRow(row)}
              title="Buyer HTTP log"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-400 dark:hover:bg-blue-900/40 dark:hover:text-blue-300"
            >
              <ScrollText size={13} />
            </button>
          </div>
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
        label: (
          <InfoPopover
            title={METRIC_COLUMN_HINTS.pub.title}
            description={METRIC_COLUMN_HINTS.pub.description}
          >
            Pub
          </InfoPopover>
        ),
        sortValue: (row) => row.pub,
        render: (row) => (
          <span className="whitespace-nowrap tabular-nums text-slate-700 dark:text-slate-200">{row.pub}</span>
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
        key: "publisherLabel",
        label: "Publisher",
        sortValue: (row) => row.publisherLabel,
        render: (row) => <span className="whitespace-nowrap">{row.publisherLabel}</span>,
      },
      {
        key: "publisherChannel",
        label: "Publisher Channel",
        sortValue: (row) => row.publisherChannel,
        render: (row) => <span className="whitespace-nowrap">{row.publisherChannel}</span>,
      },
      {
        key: "publisherSource",
        label: "Publisher Source",
        sortValue: (row) => row.publisherSource,
        render: (row) =>
          row.publisherSource && row.publisherSource !== "—" ? (
            <span className={cn("whitespace-nowrap", publisherCellLinkClassName)}>{row.publisherSource}</span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500">—</span>
          ),
      },
      {
        key: "publisherTag",
        label: "Publisher Tags",
        sortValue: (row) => row.publisherTag,
        render: (row) => <PublisherTagBadges tag={row.publisherTag} />,
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
    [timeZone]
  );

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
    usePersistedVisibleColumnKeys("buyer-lead-details-v2", allColumnKeys, {
      ready: !isInitialLoad && !isRefreshing,
    });

  const columns = useMemo(
    () => allColumns.filter((column) => effectiveVisibleKeys.includes(String(column.key))),
    [allColumns, effectiveVisibleKeys]
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
              onChange={(value) =>
                updateDraft({
                  publisherId: value,
                  publisherChannel: [],
                  publisherSource: [],
                })
              }
              options={publisherOptions}
            />

            <SearchFilterField>
              <FieldLabel htmlFor="buyer-lead-publisher-channel" label="Publisher Channel" />
              <StatusMultiSelect
                id="buyer-lead-publisher-channel"
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
              <FieldLabel htmlFor="buyer-lead-publisher-source" label="Publisher Source" />
              <StatusMultiSelect
                id="buyer-lead-publisher-source"
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

            <SearchFilterSelect
              id="buyer-lead-status"
              label="Status"
              value={draftFilters.status}
              onChange={(value) => updateDraft({ status: value })}
              options={BUYER_LEAD_DETAILS_STATUS_OPTIONS.map((option) => ({ value: option, label: option }))}
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
              <>
                <ColumnVisibilitySelect
                  id="buyer-lead-columns"
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
            loadingMessage="Loading buyer lead details..."
          >
            <DataTable
              columns={columns}
              rows={rows}
              filterQuery={pageFilter}
              emptyMessage="No buyer deliveries found."
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

      <BuyerHttpLogSidebar
        open={Boolean(viewRow)}
        onClose={() => setViewRow(null)}
        title={viewRow ? `Buyer Post Log — ${viewRow.displayLeadCode}` : "Buyer Post Log"}
        subtitle={
          viewRow
            ? `${viewRow.campaignLabel || "Campaign"} | ${viewRow.pingTreeName || viewRow.pingTreeType} | ${viewRow.buyerLabel || "Buyer"}`
            : undefined
        }
        postedAt={viewRow ? formatBuyerLeadTime(viewRow.postedAt, timeZone) : undefined}
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
