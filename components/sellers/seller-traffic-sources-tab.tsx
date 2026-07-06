"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Download, RefreshCw } from "lucide-react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { FieldLabel, Input } from "@/components/ui/form-controls";
import {
  SEARCH_FILTER_CONTROL_CLASS,
  SearchFilterActions,
  SearchFilterField,
  SearchFilterGrid,
  SearchFilterPanel,
  SearchFilterSelect,
} from "@/components/ui/search-filter-layout";
import { IdBadge } from "@/components/ui/id-badge";
import { ListTableContainer } from "@/components/ui/list-table-container";
import { ListTableToolbar } from "@/components/ui/list-table-toolbar";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatusMultiSelect } from "@/components/ui/status-multi-select";
import { ToolbarDropdownMenu, toolbarDropdownItemClassName } from "@/components/ui/toolbar-dropdown-menu";
import { toolbarPrimaryButtonClassName } from "@/lib/button-styles";
import { downloadCsv } from "@/lib/csv-export";
import { PAGE_SIZE_OPTIONS } from "@/lib/pagination";
import { toast } from "@/lib/toast";
import { useListLoadState } from "@/lib/use-list-load-state";
import { cn } from "@/lib/utils";

type TrafficSourceStatus = "Active" | "Disabled" | "Deleted";

type TrafficSource = {
  id: string;
  displayId: number | null;
  sourceName: string;
  channelName: string;
  verticalName: string;
  status: TrafficSourceStatus;
};

type TrafficSourceResponse = {
  id: string;
  displayId: number | null;
  sourceName: string;
  channelName: string;
  verticalName: string;
  status: TrafficSourceStatus;
};

const STATUS_MULTI_OPTIONS = [
  { value: "Active", label: "Active" },
  { value: "Disabled", label: "Disabled" },
  { value: "Deleted", label: "Deleted" },
];

const BULK_STATUS_OPTIONS: TrafficSourceStatus[] = ["Active", "Disabled"];

const ALL_STATUS_VALUES = STATUS_MULTI_OPTIONS.map((option) => option.value).join(",");

const EXPORT_HEADERS = ["ID", "Source Name", "Channel", "Product", "Status"];

function buildExportMatrix(rows: TrafficSource[]) {
  return rows.map((row) => [
    String(row.displayId ?? ""),
    row.sourceName,
    row.channelName,
    row.verticalName,
    row.status,
  ]);
}

type AppliedFilters = {
  id: string;
  name: string;
  product: string;
  status: string[];
};

const emptyFilters: AppliedFilters = {
  id: "",
  name: "",
  product: "All",
  status: [],
};

type SellerTrafficSourcesTabProps = {
  sellerId: string;
};

export function SellerTrafficSourcesTab({ sellerId }: SellerTrafficSourcesTabProps) {
  const [rows, setRows] = useState<TrafficSource[]>([]);
  const { isInitialLoad, isRefreshing, beginLoad, endLoad } = useListLoadState();

  const [idFilter, setIdFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [productFilter, setProductFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>(emptyFilters);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [exportOpen, setExportOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const bulkMenuRef = useRef<HTMLDivElement | null>(null);

  const loadTrafficSources = useCallback(async () => {
    beginLoad();
    try {
      const params = new URLSearchParams({ status: ALL_STATUS_VALUES });
      const response = await fetch(
        `/api/sellers/${encodeURIComponent(sellerId)}/traffic-sources?${params.toString()}`
      );
      if (!response.ok) return;

      const data = (await response.json()) as TrafficSourceResponse[];
      setRows(
        data.map((item) => ({
          id: item.id,
          displayId: item.displayId,
          sourceName: item.sourceName,
          channelName: item.channelName,
          verticalName: item.verticalName,
          status: item.status,
        }))
      );
    } finally {
      endLoad();
    }
  }, [beginLoad, endLoad, sellerId]);

  useEffect(() => {
    void loadTrafficSources();
  }, [loadTrafficSources]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (exportMenuRef.current && !exportMenuRef.current.contains(target)) {
        setExportOpen(false);
      }
      if (bulkMenuRef.current && !bulkMenuRef.current.contains(target)) {
        setBulkOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const productOptions = useMemo(() => {
    const unique = Array.from(new Set(rows.map((row) => row.verticalName).filter(Boolean)));
    unique.sort((a, b) => a.localeCompare(b));
    return unique;
  }, [rows]);

  const filteredRows = useMemo(() => {
    const idQuery = appliedFilters.id.trim().toLowerCase();
    const nameQuery = appliedFilters.name.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesId = idQuery ? String(row.displayId ?? "").toLowerCase().includes(idQuery) : true;
      const matchesName = nameQuery ? row.sourceName.toLowerCase().includes(nameQuery) : true;
      const matchesProduct =
        appliedFilters.product === "All" ? true : row.verticalName === appliedFilters.product;
      const matchesStatus =
        appliedFilters.status.length === 0 ? true : appliedFilters.status.includes(row.status);

      return matchesId && matchesName && matchesProduct && matchesStatus;
    });
  }, [rows, appliedFilters]);

  const totalItems = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);

  const pagedRows = useMemo(
    () => filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredRows, currentPage, pageSize]
  );

  const showingFrom = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const showingTo = totalItems > 0 ? Math.min(currentPage * pageSize, totalItems) : 0;

  const handleSearch = () => {
    setAppliedFilters({
      id: idFilter.trim(),
      name: nameFilter.trim(),
      product: productFilter,
      status: statusFilter,
    });
    setPage(1);
    setSelectedIds([]);
  };

  const clearFilters = () => {
    setIdFilter("");
    setNameFilter("");
    setProductFilter("All");
    setStatusFilter([]);
    setAppliedFilters(emptyFilters);
    setPage(1);
    setSelectedIds([]);
  };

  const toggleRow = (rowId: string) => {
    setSelectedIds((current) =>
      current.includes(rowId) ? current.filter((id) => id !== rowId) : [...current, rowId]
    );
  };

  const toggleAllRows = (checked: boolean) => {
    setSelectedIds(checked ? pagedRows.map((row) => row.id) : []);
  };

  const handleExport = (mode: "current-page" | "all-pages") => {
    setExportOpen(false);
    const target = mode === "all-pages" ? filteredRows : pagedRows;
    if (target.length === 0) {
      toast.error("No traffic sources to export.", "Export");
      return;
    }
    downloadCsv(
      mode === "all-pages" ? "traffic-sources-all.csv" : "traffic-sources-current-page.csv",
      EXPORT_HEADERS,
      buildExportMatrix(target)
    );
  };

  const handleBulkStatusChange = async (status: TrafficSourceStatus) => {
    setBulkOpen(false);
    if (selectedIds.length === 0) return;

    const targets = filteredRows.filter((row) => selectedIds.includes(row.id));
    setIsBulkUpdating(true);
    try {
      const results = await Promise.all(
        targets.map((row) =>
          fetch(
            `/api/sellers/${encodeURIComponent(sellerId)}/traffic-sources/${encodeURIComponent(row.id)}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status }),
            }
          )
        )
      );

      const failed = results.filter((response) => !response.ok).length;
      if (failed > 0) {
        toast.error(`Failed to update ${failed} of ${targets.length} traffic sources.`, "Bulk Change");
      } else {
        toast.success(
          `Updated ${targets.length} traffic source${targets.length === 1 ? "" : "s"} to ${status}.`,
          "Bulk Change"
        );
      }

      setSelectedIds([]);
      await loadTrafficSources();
    } catch {
      toast.error("Failed to update traffic sources.", "Bulk Change");
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const columns: Column<TrafficSource>[] = [
    {
      key: "displayId",
      label: "ID",
      sortValue: (row) => row.displayId ?? 0,
      render: (row) => <IdBadge id={row.displayId ?? "-"} />,
    },
    {
      key: "sourceName",
      label: "Source Name",
      render: (row) => (
        <span className="font-medium text-slate-800 dark:text-slate-100">{row.sourceName}</span>
      ),
    },
    {
      key: "channelName",
      label: "Channel",
      render: (row) =>
        row.channelName ? (
          <span className="text-xs text-slate-700 dark:text-slate-200">{row.channelName}</span>
        ) : (
          <span className="text-xs text-slate-400 dark:text-slate-500">-</span>
        ),
    },
    {
      key: "verticalName",
      label: "Product",
      render: (row) => <span className="text-xs text-slate-700 dark:text-slate-200">{row.verticalName}</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <div className="space-y-5">
      <SearchFilterPanel>
        <SearchFilterGrid>
          <SearchFilterField>
            <FieldLabel htmlFor="traffic-source-id" label="ID" />
            <Input
              id="traffic-source-id"
              className={SEARCH_FILTER_CONTROL_CLASS}
              value={idFilter}
              onChange={(event) => setIdFilter(event.target.value)}
              placeholder="Search by ID"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSearch();
                }
              }}
            />
          </SearchFilterField>

          <SearchFilterField>
            <FieldLabel htmlFor="traffic-source-name" label="Name" />
            <Input
              id="traffic-source-name"
              className={SEARCH_FILTER_CONTROL_CLASS}
              value={nameFilter}
              onChange={(event) => setNameFilter(event.target.value)}
              placeholder="Search by source name"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSearch();
                }
              }}
            />
          </SearchFilterField>

          <SearchFilterSelect
            id="traffic-source-product"
            label="Product"
            value={productFilter}
            onChange={setProductFilter}
            options={[
              { value: "All", label: "All" },
              ...productOptions.map((product) => ({ value: product, label: product })),
            ]}
          />

          <SearchFilterField>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Status</label>
            <StatusMultiSelect
              options={STATUS_MULTI_OPTIONS}
              selected={statusFilter}
              onChange={setStatusFilter}
            />
          </SearchFilterField>
        </SearchFilterGrid>

        <SearchFilterActions onSearch={handleSearch} onClear={clearFilters} />
      </SearchFilterPanel>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <ListTableToolbar
          pageSize={pageSize}
          pageSizeOptions={[15, 50, 100]}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          showingFrom={showingFrom}
          showingTo={showingTo}
          totalItems={totalItems}
          selectedCount={selectedIds.length}
          actions={
            <>
              <div className="relative w-full sm:w-auto" ref={bulkMenuRef}>
                <button
                  type="button"
                  onClick={() => setBulkOpen((current) => !current)}
                  disabled={selectedIds.length === 0 || isBulkUpdating || isInitialLoad || isRefreshing}
                  className={cn(toolbarPrimaryButtonClassName, "w-full sm:w-auto")}
                >
                  {isBulkUpdating ? <RefreshCw size={15} className="animate-spin" /> : null}
                  {isBulkUpdating ? "Updating..." : "Bulk Change"}
                  <ChevronDown className="h-4 w-4" />
                </button>
                <ToolbarDropdownMenu open={bulkOpen}>
                  <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 sm:px-4">
                    Set status to
                  </p>
                  {BULK_STATUS_OPTIONS.map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={toolbarDropdownItemClassName}
                      onClick={() => void handleBulkStatusChange(status)}
                    >
                      {status}
                    </button>
                  ))}
                </ToolbarDropdownMenu>
              </div>

              <div className="relative w-full sm:w-auto" ref={exportMenuRef}>
                <button
                  type="button"
                  onClick={() => setExportOpen((current) => !current)}
                  disabled={isInitialLoad || isRefreshing}
                  className={cn(toolbarPrimaryButtonClassName, "w-full sm:w-auto")}
                >
                  <Download size={15} />
                  Export
                  <ChevronDown className="h-4 w-4" />
                </button>
                <ToolbarDropdownMenu open={exportOpen}>
                  <button
                    type="button"
                    className={toolbarDropdownItemClassName}
                    onClick={() => handleExport("current-page")}
                  >
                    Current Page to CSV
                  </button>
                  <button
                    type="button"
                    className={toolbarDropdownItemClassName}
                    onClick={() => handleExport("all-pages")}
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
          loadingMessage="Loading traffic sources..."
        >
          <DataTable<TrafficSource>
            columns={columns}
            rows={pagedRows}
            selectedRowIds={selectedIds}
            onToggleRow={toggleRow}
            onToggleAllRows={toggleAllRows}
            emptyMessage="No traffic sources yet. They appear automatically when a lead is posted with a subId."
          />
        </ListTableContainer>
      </div>

      <PaginationControls
        page={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={pageSize}
        pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
        onPageChange={setPage}
      />
    </div>
  );
}
