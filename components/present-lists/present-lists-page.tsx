"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PresentListCreateModal } from "@/components/present-lists/present-list-create-modal";
import { DataTable, type Column } from "@/components/ui/data-table";
import { FieldLabel, Input } from "@/components/ui/form-controls";
import { IdBadge } from "@/components/ui/id-badge";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageSection } from "@/components/ui/state";
import { formatPresentListDateTime, PRESENT_LIST_TYPE_OPTIONS, type PresentListRecord } from "@/lib/present-list";
import { cn } from "@/lib/utils";

type VerticalOption = { id: string; label: string };

type PresentListResponse = {
  items: PresentListRecord[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export function PresentListsPage() {
  const [rows, setRows] = useState<PresentListRecord[]>([]);
  const [verticalOptions, setVerticalOptions] = useState<VerticalOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [draftFilters, setDraftFilters] = useState({ productId: "", listType: "All", name: "" });
  const [appliedFilters, setAppliedFilters] = useState(draftFilters);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/industries");
      if (!response.ok) return;
      const verticals = (await response.json()) as Array<{ id: string; name: string }>;
      setVerticalOptions(verticals.map((vertical, index) => ({ id: vertical.id, label: `[${index + 1}] ${vertical.name}` })));
    })();
  }, []);

  const fetchLists = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (appliedFilters.productId) params.set("productId", appliedFilters.productId);
      if (appliedFilters.listType !== "All") params.set("listType", appliedFilters.listType);
      if (appliedFilters.name) params.set("name", appliedFilters.name);

      const response = await fetch(`/api/present-lists?${params.toString()}`);
      if (!response.ok) return;
      const data = (await response.json()) as PresentListResponse;
      setRows(data.items);
      setTotalItems(data.totalItems);
      setTotalPages(data.totalPages);
    } finally {
      setIsLoading(false);
    }
  }, [appliedFilters, page, pageSize]);

  useEffect(() => {
    void fetchLists();
  }, [fetchLists, reloadKey]);

  const columns: Column<PresentListRecord>[] = [
    {
      key: "id",
      label: "ID",
      render: (row) => (
        <Link href={`/present-lists/${row.id}`}>
          <IdBadge id={row.displayId} />
        </Link>
      ),
    },
    { key: "product", label: "Product", render: (row) => row.productLabel },
    {
      key: "listType",
      label: "List Type",
      render: (row) => (
        <span className={cn("rounded-full px-2 py-1 text-xs font-medium", row.listType === "PL" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>
          {row.listType}
        </span>
      ),
    },
    { key: "name", label: "List Name", render: (row) => row.name },
    { key: "field", label: "Field Name", render: (row) => row.applyToField },
    { key: "size", label: "List Size", render: (row) => row.listSize },
    { key: "autoUpdate", label: "Auto-Update Frequency", render: (row) => row.autoUpdateFrequency },
    {
      key: "apiAccess",
      label: "Allow API Access",
      render: (row) => (
        <span className={cn("rounded-full px-2 py-1 text-xs font-medium", row.allowApiAccess ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>
          {row.allowApiAccess ? "Yes" : "No"}
        </span>
      ),
    },
    { key: "created", label: "Creation Time", render: (row) => formatPresentListDateTime(row.createdAt) },
    { key: "updated", label: "Last Update Time", render: (row) => formatPresentListDateTime(row.updatedAt) },
  ];

  return (
    <div className="space-y-6">
      <PageSection title="Present & Do Not Present Lists">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <FieldLabel htmlFor="pl-product-filter" label="Product" />
              <select id="pl-product-filter" value={draftFilters.productId} onChange={(e) => setDraftFilters((c) => ({ ...c, productId: e.target.value }))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800">
                <option value="">All</option>
                {verticalOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="pl-type-filter" label="Type" />
              <select id="pl-type-filter" value={draftFilters.listType} onChange={(e) => setDraftFilters((c) => ({ ...c, listType: e.target.value }))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800">
                <option value="All">Please select</option>
                {PRESENT_LIST_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="pl-name-filter" label="Name" />
              <Input id="pl-name-filter" value={draftFilters.name} onChange={(e) => setDraftFilters((c) => ({ ...c, name: e.target.value }))} />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap justify-between gap-3">
            <button type="button" onClick={() => { setAppliedFilters(draftFilters); setPage(1); }} className="rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              Search
            </button>
            <button type="button" onClick={() => { const cleared = { productId: "", listType: "All", name: "" }; setDraftFilters(cleared); setAppliedFilters(cleared); setPage(1); }} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100">
              Clear all
            </button>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button type="button" onClick={() => setIsCreateOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600">
            <Plus size={16} />
            Add new list
          </button>
        </div>

        <div className="mt-4">
          <DataTable columns={columns} rows={rows} emptyMessage={isLoading ? "Loading lists..." : "No lists found."} />
        </div>

        <PaginationControls page={page} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} onPageSizeChange={(value) => { setPageSize(value); setPage(1); }} onPageChange={setPage} />
      </PageSection>

      <PresentListCreateModal
        open={isCreateOpen}
        verticalOptions={verticalOptions}
        onClose={() => setIsCreateOpen(false)}
        onCreated={() => { setIsCreateOpen(false); setReloadKey((key) => key + 1); }}
      />
    </div>
  );
}
