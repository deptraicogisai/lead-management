"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Download } from "lucide-react";
import { CampaignCreateModal } from "@/components/campaigns/campaign-create-modal";
import {
  AddNewButton,
  CancelButton,
  ClearButton,
  DangerButton,
  DeleteSelectedButton,
  DetailNameLink,
  SearchButton,
  TableActionButton,
  TableActionLink,
} from "@/components/ui/action-buttons";
import { DataTable, type Column } from "@/components/ui/data-table";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { FieldLabel, FormError, Input, PrimaryButton } from "@/components/ui/form-controls";
import { buildEmptySearchDateRange } from "@/lib/date-range";
import { IdBadge } from "@/components/ui/id-badge";
import { ListTableContainer } from "@/components/ui/list-table-container";
import { ListTableToolbar } from "@/components/ui/list-table-toolbar";
import { Modal } from "@/components/ui/modal";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageSection } from "@/components/ui/state";
import { useListLoadState } from "@/lib/use-list-load-state";
import {
  CAMPAIGN_STATUS_FILTER_OPTIONS,
  CAMPAIGN_TYPE_OPTIONS,
  formatCampaignDateTime,
  type CampaignListRecord,
  type CampaignRecord,
} from "@/lib/campaign";
import { buildClonedCampaignName } from "@/lib/campaign-clone-name";
import {
  buildCampaignExportFileName,
  buildCampaignExportPayload,
  downloadJsonFile,
  resolveCampaignExportProductId,
} from "@/lib/campaign-export";
import { toast } from "@/lib/toast";
import { downloadCsv } from "@/lib/csv-export";
import { toolbarPrimaryButtonClassName } from "@/lib/button-styles";
import { ToolbarDropdownMenu, toolbarDropdownItemClassName } from "@/components/ui/toolbar-dropdown-menu";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";

type VerticalOption = { id: string; name: string; label: string };
type BuyerOption = { id: string; label: string };

type CampaignListResponse = {
  items: CampaignListRecord[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

const PAGE_SIZE_OPTIONS = [15, 50, 100, 500] as const;

function createDefaultCampaignFilters() {
  const emptyDateRange = buildEmptySearchDateRange();
  return {
    id: "",
    name: "",
    status: "All",
    productId: "",
    buyerId: "",
    type: "All",
    dateFrom: emptyDateRange.from,
    dateTo: emptyDateRange.to,
  };
}

type CampaignFilters = ReturnType<typeof createDefaultCampaignFilters>;

function buildCampaignQuery(filters: CampaignFilters, page: number, pageSize: number) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  if (filters.id) params.set("id", filters.id);
  if (filters.name) params.set("name", filters.name);
  if (filters.status !== "All") params.set("status", filters.status);
  if (filters.productId) params.set("productId", filters.productId);
  if (filters.buyerId) params.set("buyerId", filters.buyerId);
  if (filters.type !== "All") params.set("type", filters.type);
  if (filters.dateFrom) params.set("dateFrom", new Date(filters.dateFrom).toISOString());
  if (filters.dateTo) params.set("dateTo", new Date(filters.dateTo).toISOString());

  return params.toString();
}

const CAMPAIGN_EXPORT_HEADERS = [
  "ID",
  "Name",
  "Status",
  "Product",
  "Price",
  "Integration",
  "Timezone",
  "Buyer",
  "Campaign Type",
  "Created",
] as const;

function buildCampaignExportMatrix(items: CampaignListRecord[]) {
  return items.map((row) => [
    String(row.displayId),
    row.name,
    row.status,
    row.productLabel,
    row.minPrice.toFixed(2),
    row.integrationLabel,
    row.timezone,
    row.buyerLabel,
    row.campaignType,
    formatCampaignDateTime(row.createdAt),
  ]);
}

export function CampaignsPage() {
  const [rows, setRows] = useState<CampaignListRecord[]>([]);
  const [verticalOptions, setVerticalOptions] = useState<VerticalOption[]>([]);
  const [buyerOptions, setBuyerOptions] = useState<BuyerOption[]>([]);
  const { isInitialLoad, isRefreshing, beginLoad, endLoad } = useListLoadState();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [tableSearch, setTableSearch] = useState("");
  const [draftFilters, setDraftFilters] = useState(createDefaultCampaignFilters);
  const [appliedFilters, setAppliedFilters] = useState(createDefaultCampaignFilters);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteMode, setDeleteMode] = useState<"single" | "bulk" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CampaignListRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [cloneTarget, setCloneTarget] = useState<CampaignListRecord | null>(null);
  const [cloneName, setCloneName] = useState("");
  const [cloneMinPrice, setCloneMinPrice] = useState("0");
  const [cloneError, setCloneError] = useState("");
  const [isCloning, setIsCloning] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchOptions = async () => {
      const [verticalsRes, buyersRes] = await Promise.all([
        fetch("/api/industries"),
        fetch("/api/buyers?page=1&pageSize=1000"),
      ]);

      if (verticalsRes.ok) {
        const verticals = (await verticalsRes.json()) as Array<{ id: string; name: string }>;
        setVerticalOptions(
          verticals.map((vertical, index) => ({
            id: vertical.id,
            name: vertical.name,
            label: `[${index + 1}] ${vertical.name}`,
          }))
        );
      }

      if (buyersRes.ok) {
        const payload = (await buyersRes.json()) as { items: Array<{ id: string; displayId: number; name: string }> };
        setBuyerOptions(
          payload.items.map((buyer) => ({
            id: buyer.id,
            label: `[${buyer.displayId}] ${buyer.name}`,
          }))
        );
      }
    };

    void fetchOptions();
  }, []);

  const fetchCampaigns = useCallback(async () => {
    beginLoad();

    try {
      const response = await fetch(`/api/campaigns?${buildCampaignQuery(appliedFilters, page, pageSize)}`);
      if (!response.ok) return;

      const data = (await response.json()) as CampaignListResponse;
      setRows(data.items);
      setTotalItems(data.totalItems);
      setTotalPages(data.totalPages);
    } finally {
      endLoad();
    }
  }, [appliedFilters, beginLoad, endLoad, page, pageSize]);

  useEffect(() => {
    void fetchCampaigns();
  }, [fetchCampaigns, reloadKey]);

  useEffect(() => {
    if (!exportOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!exportMenuRef.current?.contains(event.target as Node)) {
        setExportOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [exportOpen]);

  const fetchAllCampaigns = useCallback(async () => {
    if (totalItems === 0) {
      return [] as CampaignListRecord[];
    }

    const maxPageSize = 1000;
    const pages = Math.ceil(totalItems / maxPageSize);
    const allRows: CampaignListRecord[] = [];

    for (let nextPage = 1; nextPage <= pages; nextPage += 1) {
      const response = await fetch(`/api/campaigns?${buildCampaignQuery(appliedFilters, nextPage, maxPageSize)}`);
      if (!response.ok) {
        throw new Error("Failed to export all campaigns.");
      }

      const data = (await response.json()) as CampaignListResponse;
      allRows.push(...data.items);
    }

    return allRows;
  }, [appliedFilters, totalItems]);

  const handleExportRecord = async (row: CampaignListRecord) => {
    setExportingId(row.id);

    try {
      const response = await fetch(`/api/campaigns/${encodeURIComponent(row.id)}`);
      if (!response.ok) {
        throw new Error("Failed to load campaign.");
      }

      const fullRecord = (await response.json()) as CampaignRecord;
      const verticalIdsOldestFirst = verticalOptions.map((option) => option.id);
      const productId = resolveCampaignExportProductId(fullRecord, verticalIdsOldestFirst);
      const payload = buildCampaignExportPayload(fullRecord, productId);

      downloadJsonFile(buildCampaignExportFileName(fullRecord.name), payload);
      toast.success("Campaign exported successfully.", "Export");
    } catch {
      toast.error("Failed to export campaign.", "Export");
    } finally {
      setExportingId(null);
    }
  };

  const handleCloseCloneModal = () => {
    if (isCloning) return;
    setCloneTarget(null);
    setCloneName("");
    setCloneMinPrice("0");
    setCloneError("");
  };

  const handleCloneRecord = async () => {
    if (!cloneTarget) return;

    if (!cloneName.trim()) {
      setCloneError("Name is required.");
      return;
    }

    const minPrice = Number(cloneMinPrice);
    if (!Number.isFinite(minPrice) || minPrice < 0) {
      setCloneError("A valid min price is required.");
      return;
    }

    setIsCloning(true);
    setCloneError("");

    try {
      const response = await fetch(`/api/campaigns/${encodeURIComponent(cloneTarget.id)}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cloneName.trim(), minPrice }),
      });

      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        setCloneError(payload?.message ?? "Failed to clone campaign.");
        return;
      }

      toast.success("Campaign cloned successfully.", "Clone");
      handleCloseCloneModal();
      setReloadKey((current) => current + 1);
    } catch {
      setCloneError("Failed to clone campaign.");
    } finally {
      setIsCloning(false);
    }
  };

  const clonePreviewName =
    cloneTarget && cloneName.trim()
      ? buildClonedCampaignName(cloneName, Number(cloneMinPrice) || 0)
      : "";

  const handleExport = async (mode: "current-page" | "all-pages") => {
    setIsExporting(true);
    setExportOpen(false);

    try {
      if (mode === "all-pages") {
        const allRows = await fetchAllCampaigns();
        downloadCsv(
          "campaigns-all.csv",
          [...CAMPAIGN_EXPORT_HEADERS],
          buildCampaignExportMatrix(allRows)
        );
        return;
      }

      downloadCsv(
        "campaigns-current-page.csv",
        [...CAMPAIGN_EXPORT_HEADERS],
        buildCampaignExportMatrix(filteredRows)
      );
    } catch {
      toast.error("Failed to export campaigns.", "Export");
    } finally {
      setIsExporting(false);
    }
  };

  const filteredRows = useMemo(() => {
    const query = tableSearch.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((row) =>
      [String(row.displayId), row.name, row.productLabel, row.buyerLabel, row.campaignType]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [rows, tableSearch]);

  const toggleRow = (rowId: string) => {
    setSelectedIds((current) => (current.includes(rowId) ? current.filter((id) => id !== rowId) : [...current, rowId]));
  };

  const toggleAllRows = (checked: boolean) => {
    setSelectedIds(checked ? filteredRows.map((row) => row.id) : []);
  };

  const closeDeleteModal = () => {
    if (isDeleting) return;
    setDeleteMode(null);
    setDeleteTarget(null);
  };

  const openSingleDelete = (row: CampaignListRecord) => {
    setDeleteTarget(row);
    setDeleteMode("single");
  };

  const openBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setDeleteTarget(null);
    setDeleteMode("bulk");
  };

  const handleDelete = async () => {
    const idsToDelete =
      deleteMode === "bulk" ? selectedIds : deleteTarget ? [deleteTarget.id] : [];

    if (idsToDelete.length === 0) return;

    setIsDeleting(true);

    try {
      const results = await Promise.all(
        idsToDelete.map(async (id) => {
          const response = await fetch(`/api/campaigns/${encodeURIComponent(id)}`, { method: "DELETE" });
          const result = (await response.json().catch(() => null)) as { message?: string } | null;
          return { id, ok: response.ok, message: result?.message };
        })
      );

      const succeeded = results.filter((result) => result.ok);
      const failed = results.filter((result) => !result.ok);

      if (succeeded.length === 0) {
        toast.error(failed[0]?.message ?? "Failed to delete campaign.");
        return;
      }

      const deletedIds = new Set(succeeded.map((result) => result.id));
      setSelectedIds((current) => current.filter((id) => !deletedIds.has(id)));
      setDeleteMode(null);
      setDeleteTarget(null);

      if (failed.length > 0) {
        toast.error(`Deleted ${succeeded.length} campaign(s). ${failed.length} failed.`);
      } else if (deleteMode === "bulk") {
        toast.success(`Deleted ${succeeded.length} campaign(s).`);
      } else {
        toast.success("Campaign deleted.");
      }

      if (rows.length <= succeeded.length && page > 1) {
        setPage((current) => current - 1);
      } else {
        setReloadKey((current) => current + 1);
      }
    } catch {
      toast.error("Failed to delete campaign.");
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<CampaignListRecord>[] = [
    {
      key: "id",
      label: "ID",
      sortValue: (row) => row.displayId,
      render: (row) => (
        <Link href={`/campaigns/${row.id}`} className="group inline-flex">
          <IdBadge id={row.displayId} interactive />
        </Link>
      ),
    },
    {
      key: "name",
      label: "Name",
      render: (row) => <DetailNameLink href={`/campaigns/${row.id}`}>{row.name}</DetailNameLink>,
    },
    { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
    { key: "product", label: "Product", sortValue: (row) => row.productLabel, render: (row) => row.productLabel },
    {
      key: "price",
      label: "Price",
      sortValue: (row) => row.minPrice,
      render: (row) => <span>${row.minPrice.toFixed(2)}</span>,
    },
    { key: "integration", label: "Integration", sortValue: (row) => row.integrationLabel, render: (row) => row.integrationLabel },
    { key: "timezone", label: "Timezone", render: (row) => row.timezone },
    { key: "buyer", label: "Buyer", sortValue: (row) => row.buyerLabel, render: (row) => row.buyerLabel },
    { key: "type", label: "Campaign Type", sortValue: (row) => row.campaignType, render: (row) => row.campaignType },
    {
      key: "created",
      label: "Created",
      sortValue: (row) => new Date(row.createdAt).getTime(),
      render: (row) => formatCampaignDateTime(row.createdAt),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <TableActionLink href={`/campaigns/${row.id}`}>View</TableActionLink>
          <TableActionButton
            type="button"
            onClick={() => {
              setCloneTarget(row);
              setCloneName(row.name);
              setCloneMinPrice(String(row.minPrice));
              setCloneError("");
            }}
          >
            Clone
          </TableActionButton>
          <TableActionButton
            type="button"
            onClick={() => void handleExportRecord(row)}
            disabled={exportingId === row.id}
          >
            {exportingId === row.id ? "Exporting..." : "Export"}
          </TableActionButton>
          <TableActionButton variant="danger" onClick={() => openSingleDelete(row)}>
            Delete
          </TableActionButton>
        </div>
      ),
    },
  ];

  const showingFrom = filteredRows.length > 0 ? (page - 1) * pageSize + 1 : 0;
  const showingTo = filteredRows.length > 0 ? Math.min((page - 1) * pageSize + filteredRows.length, totalItems) : 0;

  return (
    <div className="space-y-6">
      <PageSection>
        <div className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900/70">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <FieldLabel htmlFor="campaign-id-filter" label="ID" />
              <Input id="campaign-id-filter" value={draftFilters.id} onChange={(e) => setDraftFilters((c) => ({ ...c, id: e.target.value }))} />
            </div>
            <div>
              <FieldLabel htmlFor="campaign-name-filter" label="Name" />
              <Input id="campaign-name-filter" value={draftFilters.name} onChange={(e) => setDraftFilters((c) => ({ ...c, name: e.target.value }))} />
            </div>
            <div>
              <FieldLabel htmlFor="campaign-status-filter" label="Status" />
              <select
                id="campaign-status-filter"
                value={draftFilters.status}
                onChange={(e) => setDraftFilters((c) => ({ ...c, status: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800"
              >
                {CAMPAIGN_STATUS_FILTER_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="campaign-product-filter" label="Product" />
              <select
                id="campaign-product-filter"
                value={draftFilters.productId}
                onChange={(e) => setDraftFilters((c) => ({ ...c, productId: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800"
              >
                <option value="">All</option>
                {verticalOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="campaign-buyer-filter" label="Buyer" />
              <select
                id="campaign-buyer-filter"
                value={draftFilters.buyerId}
                onChange={(e) => setDraftFilters((c) => ({ ...c, buyerId: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800"
              >
                <option value="">All</option>
                {buyerOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="campaign-type-filter" label="Type" />
              <select
                id="campaign-type-filter"
                value={draftFilters.type}
                onChange={(e) => setDraftFilters((c) => ({ ...c, type: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800"
              >
                <option value="All">All</option>
                {CAMPAIGN_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="campaign-date-range" label="Date" />
              <DateRangePicker
                id="campaign-date-range"
                value={{ from: draftFilters.dateFrom, to: draftFilters.dateTo }}
                onChange={(range) =>
                  setDraftFilters((current) => ({ ...current, dateFrom: range.from, dateTo: range.to }))
                }
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
            <SearchButton
              onClick={() => {
                setAppliedFilters(draftFilters);
                setPage(1);
              }}
            />
            <ClearButton
              onClick={() => {
                const cleared = createDefaultCampaignFilters();
                setDraftFilters(cleared);
                setAppliedFilters(cleared);
                setSelectedIds([]);
                setPage(1);
              }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <ListTableToolbar
            pageSize={pageSize}
            pageSizeOptions={[15, 50]}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            showingFrom={showingFrom}
            showingTo={showingTo}
            totalItems={totalItems}
            tableFilter={tableSearch}
            onTableFilterChange={setTableSearch}
            selectedCount={selectedIds.length}
            actions={
              <>
                <DeleteSelectedButton
                  count={selectedIds.length}
                  onClick={openBulkDelete}
                  disabled={selectedIds.length === 0 || isDeleting || isInitialLoad || isRefreshing}
                />
                <div className="relative w-full sm:w-auto" ref={exportMenuRef}>
                  <button
                    type="button"
                    onClick={() => setExportOpen((current) => !current)}
                    disabled={isExporting || isInitialLoad || isRefreshing}
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
                <AddNewButton type="button" onClick={() => setIsCreateOpen(true)}>
                  Create New Campaign
                </AddNewButton>
              </>
            }
          />

          <ListTableContainer
            isInitialLoad={isInitialLoad}
            isRefreshing={isRefreshing}
            loadingMessage="Loading campaigns..."
          >
            <DataTable
              columns={columns}
              rows={filteredRows}
              emptyMessage="No campaigns found."
              selectedRowIds={selectedIds}
              onToggleRow={toggleRow}
              onToggleAllRows={toggleAllRows}
            />
          </ListTableContainer>
        </div>

        <PaginationControls
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
          onPageSizeChange={(value) => {
            setPageSize(value);
            setPage(1);
          }}
          onPageChange={setPage}
        />
        </div>
      </PageSection>

      <CampaignCreateModal
        open={isCreateOpen}
        verticalOptions={verticalOptions}
        buyerOptions={buyerOptions}
        onClose={() => setIsCreateOpen(false)}
        onCreated={() => {
          setIsCreateOpen(false);
          setReloadKey((key) => key + 1);
        }}
      />

      <Modal
        open={cloneTarget !== null}
        title="Clone Campaign"
        description={
          cloneTarget
            ? `Create a copy of "${cloneTarget.name}" with all filters, schedule, and integration settings.`
            : undefined
        }
        onClose={handleCloseCloneModal}
        panelClassName="max-w-lg"
        actions={
          <>
            <CancelButton type="button" onClick={handleCloseCloneModal} disabled={isCloning} />
            <PrimaryButton type="button" onClick={() => void handleCloneRecord()} disabled={isCloning}>
              {isCloning ? "Cloning..." : "Clone"}
            </PrimaryButton>
          </>
        }
      >
        <div className="grid gap-4">
          <div>
            <FieldLabel htmlFor="campaign-clone-name" label="Name" />
            <Input
              id="campaign-clone-name"
              value={cloneName}
              onChange={(event) => {
                setCloneName(event.target.value);
                if (cloneError) setCloneError("");
              }}
              placeholder="Enter campaign name"
            />
          </div>
          <div>
            <FieldLabel htmlFor="campaign-clone-min-price" label="Min Price" />
            <Input
              id="campaign-clone-min-price"
              type="number"
              min={0}
              step="0.01"
              value={cloneMinPrice}
              onChange={(event) => {
                setCloneMinPrice(event.target.value);
                if (cloneError) setCloneError("");
              }}
            />
          </div>
          {clonePreviewName ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Campaign will be created as: <span className="font-medium">{clonePreviewName}</span>
            </p>
          ) : null}
          <FormError error={cloneError} />
        </div>
      </Modal>

      <Modal
        open={deleteMode !== null}
        title={deleteMode === "bulk" ? "Delete Selected Campaigns" : "Delete Campaign"}
        description={
          deleteMode === "bulk"
            ? `Delete ${selectedIds.length} selected campaign(s)? This action cannot be undone.`
            : deleteTarget
              ? `Delete campaign "${deleteTarget.name}"? This action cannot be undone.`
              : undefined
        }
        onClose={closeDeleteModal}
        actions={
          <>
            <CancelButton type="button" disabled={isDeleting} onClick={closeDeleteModal} />
            <DangerButton type="button" disabled={isDeleting} onClick={() => void handleDelete()}>
              {isDeleting ? "Deleting..." : "Delete"}
            </DangerButton>
          </>
        }
      />
    </div>
  );
}
