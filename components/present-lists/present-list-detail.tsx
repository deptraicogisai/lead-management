"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useBreadcrumbLabel } from "@/components/layout/breadcrumb-context";
import { ClearButton, IconActionButton, SearchButton } from "@/components/ui/action-buttons";
import { DataTable, type Column } from "@/components/ui/data-table";
import { FieldLabel, FormError, Input, PrimaryButton } from "@/components/ui/form-controls";
import { Modal } from "@/components/ui/modal";
import { ListTableContainer } from "@/components/ui/list-table-container";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageSection, Spinner } from "@/components/ui/state";
import { PAGE_SIZE_OPTIONS } from "@/lib/pagination";
import { useListLoadState } from "@/lib/use-list-load-state";
import { formatPresentListDateTime, type PresentListRecord, type PresentListValueRecord } from "@/lib/present-list";
import { toast } from "@/lib/toast";

type PresentListDetailProps = {
  listId: string;
};

export function PresentListDetail({ listId }: PresentListDetailProps) {
  const [list, setList] = useState<PresentListRecord | null>(null);
  useBreadcrumbLabel(list?.name ?? null);
  const [values, setValues] = useState<PresentListValueRecord[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const { isInitialLoad, isRefreshing, beginLoad, endLoad } = useListLoadState();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [valuesText, setValuesText] = useState("");
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<PresentListValueRecord | null>(null);

  const loadList = useCallback(async () => {
    beginLoad();
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (appliedSearch) params.set("search", appliedSearch);
      const response = await fetch(`/api/present-lists/${encodeURIComponent(listId)}?${params.toString()}`);
      if (!response.ok) return;
      const data = (await response.json()) as {
        list: PresentListRecord;
        values: PresentListValueRecord[];
        totalItems: number;
        totalPages: number;
      };
      setList(data.list);
      setValues(data.values);
      setTotalItems(data.totalItems);
      setTotalPages(data.totalPages);
    } finally {
      endLoad();
    }
  }, [appliedSearch, beginLoad, endLoad, listId, page, pageSize]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const handleAddValues = async () => {
    setError("");
    const response = await fetch(`/api/present-lists/${encodeURIComponent(listId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valuesText }),
    });
    const result = (await response.json().catch(() => null)) as { message?: string; addedCount?: number } | null;
    if (!response.ok) {
      setError(result?.message ?? "Failed to add values.");
      return;
    }
    toast.success(`Added ${result?.addedCount ?? 0} value(s).`);
    setValuesText("");
    setIsAddOpen(false);
    void loadList();
  };

  const handleDeleteValue = async () => {
    if (!deleteTarget) return;
    await fetch(`/api/present-lists/${encodeURIComponent(listId)}?valueId=${encodeURIComponent(deleteTarget.id)}`, {
      method: "DELETE",
    });
    setDeleteTarget(null);
    void loadList();
  };

  const columns: Column<PresentListValueRecord>[] = [
    { key: "value", label: "Value", render: (row) => row.value },
    { key: "created", label: "Created Date", render: (row) => formatPresentListDateTime(row.createdAt) },
    { key: "expiration", label: "Expiration Date", render: (row) => (row.expirationDate ? formatPresentListDateTime(row.expirationDate) : "-") },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <IconActionButton
          icon={Trash2}
          variant="danger"
          onClick={() => setDeleteTarget(row)}
          className="rounded-lg px-2 py-1 text-xs"
          aria-label="Delete value"
        >
          Delete
        </IconActionButton>
      ),
    },
  ];

  if (isInitialLoad && !list) {
    return (
      <PageSection>
        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          <Spinner />
          <span>Loading list...</span>
        </div>
      </PageSection>
    );
  }

  if (!list) {
    return (
      <PageSection>
        <p className="text-sm text-slate-500">List not found.</p>
      </PageSection>
    );
  }

  return (
    <div className="space-y-6">
      <PageSection>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
          <FieldLabel htmlFor="value-search" label="Search for a Value" />
          <Input id="value-search" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="mt-3 flex gap-3">
            <SearchButton onClick={() => { setAppliedSearch(search); setPage(1); }} />
            <ClearButton onClick={() => { setSearch(""); setAppliedSearch(""); setPage(1); }} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {list.productLabel} · {list.listType} · Field: {list.applyToField}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setIsAddOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600">
              <Plus size={16} />
              Add new value
            </button>
          </div>
        </div>

        <div className="mt-4">
          <ListTableContainer
            isInitialLoad={isInitialLoad}
            isRefreshing={isRefreshing}
            loadingMessage="Loading values..."
          >
            <DataTable columns={columns} rows={values} emptyMessage="No values yet." />
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
      </PageSection>

      <Modal
        open={isAddOpen}
        title="Add new value"
        description="Paste one value per line."
        onClose={() => setIsAddOpen(false)}
        panelClassName="max-w-2xl"
        actions={
          <>
            <button type="button" onClick={() => setIsAddOpen(false)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100">
              Cancel
            </button>
            <PrimaryButton type="button" onClick={() => void handleAddValues()} className="bg-emerald-700 hover:bg-emerald-800">
              Save values
            </PrimaryButton>
          </>
        }
      >
        <textarea
          value={valuesText}
          onChange={(e) => setValuesText(e.target.value)}
          rows={12}
          placeholder={"96017418\n96001013\n96001014"}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50"
        />
        <FormError error={error} />
      </Modal>

      <Modal
        open={deleteTarget !== null}
        title="Delete Value"
        description={deleteTarget ? `Delete value "${deleteTarget.value}"?` : undefined}
        onClose={() => setDeleteTarget(null)}
        actions={
          <>
            <button type="button" onClick={() => setDeleteTarget(null)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100">
              Cancel
            </button>
            <button type="button" onClick={() => void handleDeleteValue()} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
              Delete
            </button>
          </>
        }
      />
    </div>
  );
}
