"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { PresentListCreateModal } from "@/components/present-lists/present-list-create-modal";
import { AddNewButton, ClearButton, DetailNameLink, IconActionButton, SearchButton } from "@/components/ui/action-buttons";
import { DataTable, type Column } from "@/components/ui/data-table";
import { FieldLabel, Input } from "@/components/ui/form-controls";
import { IdBadge } from "@/components/ui/id-badge";
import { ListTableContainer } from "@/components/ui/list-table-container";
import { ListTableToolbar } from "@/components/ui/list-table-toolbar";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageSection } from "@/components/ui/state";
import { PAGE_SIZE_OPTIONS } from "@/lib/pagination";
import { useListLoadState } from "@/lib/use-list-load-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatPresentListDateTime, PRESENT_LIST_TYPE_OPTIONS, type PresentListRecord } from "@/lib/present-list";

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
  const { isInitialLoad, isRefreshing, beginLoad, endLoad } = useListLoadState();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [draftFilters, setDraftFilters] = useState({ productId: "", listType: "All", name: "" });
  const [appliedFilters, setAppliedFilters] = useState(draftFilters);
  const [tableFilter, setTableFilter] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingList, setEditingList] = useState<PresentListRecord | null>(null);
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
    beginLoad();
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
      endLoad();
    }
  }, [appliedFilters, beginLoad, endLoad, page, pageSize]);

  useEffect(() => {
    void fetchLists();
  }, [fetchLists, reloadKey]);

  const filteredRows = rows.filter((row) => {
    const search = tableFilter.trim().toLowerCase();
    if (!search) return true;

    return [String(row.displayId), row.name, row.productLabel, row.applyToField, row.listType]
      .join(" ")
      .toLowerCase()
      .includes(search);
  });

  const columns: Column<PresentListRecord>[] = [
    {
      key: "id",
      label: "ID",
      sortValue: (row) => row.displayId,
      render: (row) => (
        <Link href={`/present-lists/${row.id}`} className="group inline-flex">
          <IdBadge id={row.displayId} interactive />
        </Link>
      ) },
    { key: "product", label: "Product", sortValue: (row) => row.productLabel, render: (row) => row.productLabel },
    {
      key: "listType",
      label: "List Type",
      render: (row) => <StatusBadge status={row.listType} /> },
    {
      key: "name",
      label: "List Name",
      render: (row) => <DetailNameLink href={`/present-lists/${row.id}`}>{row.name}</DetailNameLink> },
    { key: "field", label: "Field Name", render: (row) => row.applyToField },
    { key: "size", label: "List Size", sortValue: (row) => row.listSize, render: (row) => row.listSize },
    { key: "autoUpdate", label: "Auto-Update Frequency", render: (row) => row.autoUpdateFrequency },
    {
      key: "apiAccess",
      label: "Allow API Access",
      render: (row) => <StatusBadge status={row.allowApiAccess ? "Yes" : "No"} /> },
    {
      key: "created",
      label: "Creation Time",
      sortValue: (row) => new Date(row.createdAt).getTime(),
      render: (row) => formatPresentListDateTime(row.createdAt) },
    {
      key: "updated",
      label: "Last Update Time",
      sortValue: (row) => new Date(row.updatedAt).getTime(),
      render: (row) => formatPresentListDateTime(row.updatedAt) },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <IconActionButton
          icon={Pencil}
          onClick={() => setEditingList(row)}
          className="rounded-lg px-2 py-1 text-xs"
          aria-label="Edit list"
        >
          Edit
        </IconActionButton>
      ) },
  ];

  const showingFrom = filteredRows.length > 0 ? (page - 1) * pageSize + 1 : 0;
  const showingTo = filteredRows.length > 0 ? Math.min((page - 1) * pageSize + filteredRows.length, totalItems) : 0;

  return (
    <div className="space-y-6">
      <PageSection>
        <div className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900/70">
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
          <div className="mt-4 flex flex-wrap justify-end gap-3">
            <SearchButton onClick={() => { setAppliedFilters(draftFilters); setPage(1); }} />
            <ClearButton
              onClick={() => {
                const cleared = { productId: "", listType: "All", name: "" };
                setDraftFilters(cleared);
                setAppliedFilters(cleared);
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
            tableFilter={tableFilter}
            onTableFilterChange={setTableFilter}
            actions={
              <AddNewButton type="button"
                onClick={() => setIsCreateOpen(true)}
                
              >Add new list</AddNewButton>
            }
          />

          <ListTableContainer
            isInitialLoad={isInitialLoad}
            isRefreshing={isRefreshing}
            loadingMessage="Loading lists..."
          >
            <DataTable columns={columns} rows={filteredRows} emptyMessage="No lists found." />
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

      <PresentListCreateModal
        open={isCreateOpen}
        verticalOptions={verticalOptions}
        onClose={() => setIsCreateOpen(false)}
        onCreated={() => {
          setIsCreateOpen(false);
          setReloadKey((key) => key + 1);
        }}
      />

      <PresentListCreateModal
        open={editingList !== null}
        verticalOptions={verticalOptions}
        list={editingList}
        onClose={() => setEditingList(null)}
        onCreated={() => {
          setEditingList(null);
          setReloadKey((key) => key + 1);
        }}
      />
    </div>
  );
}
