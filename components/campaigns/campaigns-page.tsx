"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { CampaignCreateModal } from "@/components/campaigns/campaign-create-modal";
import { DataTable, type Column } from "@/components/ui/data-table";
import { FieldLabel, Input } from "@/components/ui/form-controls";
import { IdBadge } from "@/components/ui/id-badge";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageSection } from "@/components/ui/state";
import {
  CAMPAIGN_STATUS_OPTIONS,
  CAMPAIGN_TYPE_OPTIONS,
  formatCampaignDateTime,
  type CampaignListRecord,
} from "@/lib/campaign";
import { cn } from "@/lib/utils";

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

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-1 text-xs font-medium",
        status === "Active"
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
          : status === "Paused"
            ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      )}
    >
      {status}
    </span>
  );
}

export function CampaignsPage() {
  const [rows, setRows] = useState<CampaignListRecord[]>([]);
  const [verticalOptions, setVerticalOptions] = useState<VerticalOption[]>([]);
  const [buyerOptions, setBuyerOptions] = useState<BuyerOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [tableSearch, setTableSearch] = useState("");
  const [draftFilters, setDraftFilters] = useState({
    id: "",
    name: "",
    status: "All",
    productId: "",
    buyerId: "",
    type: "All",
    dateFrom: "",
    dateTo: "",
  });
  const [appliedFilters, setAppliedFilters] = useState(draftFilters);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

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
    setIsLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });

      if (appliedFilters.id) params.set("id", appliedFilters.id);
      if (appliedFilters.name) params.set("name", appliedFilters.name);
      if (appliedFilters.status !== "All") params.set("status", appliedFilters.status);
      if (appliedFilters.productId) params.set("productId", appliedFilters.productId);
      if (appliedFilters.buyerId) params.set("buyerId", appliedFilters.buyerId);
      if (appliedFilters.type !== "All") params.set("type", appliedFilters.type);
      if (appliedFilters.dateFrom) params.set("dateFrom", new Date(appliedFilters.dateFrom).toISOString());
      if (appliedFilters.dateTo) params.set("dateTo", new Date(appliedFilters.dateTo).toISOString());

      const response = await fetch(`/api/campaigns?${params.toString()}`);
      if (!response.ok) return;

      const data = (await response.json()) as CampaignListResponse;
      setRows(data.items);
      setTotalItems(data.totalItems);
      setTotalPages(data.totalPages);
    } finally {
      setIsLoading(false);
    }
  }, [appliedFilters, page, pageSize]);

  useEffect(() => {
    void fetchCampaigns();
  }, [fetchCampaigns, reloadKey]);

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

  const columns: Column<CampaignListRecord>[] = [
    {
      key: "id",
      label: "ID",
      render: (row) => (
        <Link href={`/campaigns/${row.id}`} className="inline-flex">
          <IdBadge id={row.displayId} />
        </Link>
      ),
    },
    { key: "name", label: "Name", render: (row) => <span className="font-medium">{row.name}</span> },
    { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
    { key: "product", label: "Product", render: (row) => row.productLabel },
    {
      key: "price",
      label: "Price",
      render: (row) => <span>${row.minPrice.toFixed(2)}</span>,
    },
    { key: "integration", label: "Integration", render: (row) => row.integrationLabel },
    { key: "timezone", label: "Timezone", render: (row) => row.timezone },
    { key: "buyer", label: "Buyer", render: (row) => row.buyerLabel },
    { key: "type", label: "Campaign Type", render: (row) => row.campaignType },
    { key: "created", label: "Created", render: (row) => formatCampaignDateTime(row.createdAt) },
  ];

  return (
    <div className="space-y-6">
      <PageSection title="Campaigns">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                <option value="All">All</option>
                {CAMPAIGN_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{status}</option>
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
              <FieldLabel htmlFor="campaign-date-from" label="Created From" />
              <Input id="campaign-date-from" type="datetime-local" value={draftFilters.dateFrom} onChange={(e) => setDraftFilters((c) => ({ ...c, dateFrom: e.target.value }))} />
            </div>
            <div>
              <FieldLabel htmlFor="campaign-date-to" label="Created To" />
              <Input id="campaign-date-to" type="datetime-local" value={draftFilters.dateTo} onChange={(e) => setDraftFilters((c) => ({ ...c, dateTo: e.target.value }))} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setAppliedFilters(draftFilters);
                setPage(1);
              }}
              className="rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => {
                const cleared = { id: "", name: "", status: "All", productId: "", buyerId: "", type: "All", dateFrom: "", dateTo: "" };
                setDraftFilters(cleared);
                setAppliedFilters(cleared);
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100"
            >
              Clear all
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            Filter:
            <Input value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} className="max-w-xs" />
          </div>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
          >
            <Plus size={16} />
            Create New Campaign
          </button>
        </div>

        <div className="mt-4">
          <DataTable columns={columns} rows={filteredRows} emptyMessage={isLoading ? "Loading campaigns..." : "No campaigns found."} />
        </div>

        <PaginationControls
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageSizeChange={(value) => {
            setPageSize(value);
            setPage(1);
          }}
          onPageChange={setPage}
        />
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
    </div>
  );
}
