"use client";

import { useEffect, useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { FieldLabel, FormError, PrimaryButton } from "@/components/ui/form-controls";
import { ListControls } from "@/components/ui/list-controls";
import { Modal } from "@/components/ui/modal";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { ListTableContainer } from "@/components/ui/list-table-container";
import { PageSection } from "@/components/ui/state";
import { useListLoadState } from "@/lib/use-list-load-state";
import type { Seller, Vertical, VerticalMapping } from "@/lib/mock-data";

type VerticalMappingListResponse = {
  items: VerticalMapping[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

type FormState = {
  verticalId: string;
  sellerId: string;
};

const defaultForm: FormState = {
  verticalId: "",
  sellerId: "",
};

export default function VerticalMappingsPage() {
  const [verticals, setVerticals] = useState<Vertical[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [mappings, setMappings] = useState<VerticalMapping[]>([]);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { isInitialLoad, isRefreshing, beginLoad, endLoad } = useListLoadState();
  const [modalMessage, setModalMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VerticalMapping | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      beginLoad();
      try {
        const mappingParams = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
          search,
        });
        const [verticalResponse, sellerResponse, mappingResponse] = await Promise.all([
          fetch("/api/industries"),
          fetch("/api/sellers"),
          fetch(`/api/vertical-mappings?${mappingParams.toString()}`),
        ]);

        if (verticalResponse.ok) {
          const verticalData = (await verticalResponse.json()) as Vertical[];
          setVerticals(verticalData);
        }

        if (sellerResponse.ok) {
          const sellerData = (await sellerResponse.json()) as Seller[];
          setSellers(sellerData);
        }

        if (mappingResponse.ok) {
          const mappingData = (await mappingResponse.json()) as VerticalMappingListResponse;
          setMappings(mappingData.items);
          setTotalItems(mappingData.totalItems);
          setTotalPages(mappingData.totalPages);
        }
      } finally {
        endLoad();
      }
    };

    void fetchData();
  }, [page, pageSize, search, reloadKey]);

  const mappingLabels = useMemo(() => {
    return mappings.map((mapping) => {
      const verticalName = verticals.find((vertical) => vertical.id === mapping.verticalId)?.name ?? mapping.verticalId;
      const sellerName = sellers.find((seller) => seller.id === mapping.sellerId)?.name ?? mapping.sellerId;
      return {
        ...mapping,
        verticalName,
        sellerName,
      };
    });
  }, [mappings, sellers, verticals]);

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.verticalId) nextErrors.verticalId = "Vertical is required.";
    if (!form.sellerId) nextErrors.sellerId = "Seller is required.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const resetForm = () => {
    setForm(defaultForm);
    setErrors({});
    setEditingId(null);
    setIsFormOpen(false);
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const endpoint = editingId ? `/api/vertical-mappings/${encodeURIComponent(editingId)}` : "/api/vertical-mappings";
    const method = editingId ? "PATCH" : "POST";
    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const payload = (await response.json()) as VerticalMapping | { message?: string };
    if (!response.ok) {
      setModalMessage("message" in payload && payload.message ? payload.message : "Unable to save vertical mapping.");
      return;
    }

    if (editingId) {
      setReloadKey((prev) => prev + 1);
    } else {
      setPage(1);
      setReloadKey((prev) => prev + 1);
    }

    resetForm();
  };

  const handleEdit = (mapping: VerticalMapping) => {
    setEditingId(mapping.id);
    setIsFormOpen(true);
    setForm({
      verticalId: mapping.verticalId,
      sellerId: mapping.sellerId,
    });
    setErrors({});
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    const response = await fetch(`/api/vertical-mappings/${encodeURIComponent(deleteTarget.id)}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      setModalMessage("Unable to delete vertical mapping.");
      return;
    }

    if (editingId === deleteTarget.id) {
      resetForm();
    }
    setDeleteTarget(null);
    if (mappings.length === 1 && page > 1) {
      setPage((prev) => prev - 1);
    } else {
      setReloadKey((prev) => prev + 1);
    }
  };

  const openCreateModal = () => {
    setForm(defaultForm);
    setErrors({});
    setEditingId(null);
    setIsFormOpen(true);
  };

  const columns: Column<VerticalMapping>[] = [
    {
      key: "verticalId",
      label: "Vertical",
      render: (row) => mappingLabels.find((item) => item.id === row.id)?.verticalName ?? row.verticalId,
    },
    {
      key: "sellerId",
      label: "Seller",
      render: (row) => mappingLabels.find((item) => item.id === row.id)?.sellerName ?? row.sellerId,
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleEdit(row)}
            className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(row)}
            className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200 dark:hover:bg-red-500/20"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <ListControls
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search by seller or vertical"
      />

      <PageSection
        actions={
          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 dark:bg-blue-500 dark:text-white dark:hover:bg-blue-400"
          >
            Create Mapping
          </button>
        }
      >
        <ListTableContainer
          isInitialLoad={isInitialLoad}
          isRefreshing={isRefreshing}
          loadingMessage="Loading mappings..."
        >
          <DataTable<VerticalMapping>
            columns={columns}
            rows={mappings}
            emptyMessage="No mappings yet. Create your first vertical mapping to get started."
          />
        </ListTableContainer>
      </PageSection>

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

      <Modal
        open={isFormOpen}
        title={editingId ? "Update Vertical Mapping" : "Create Vertical Mapping"}
        onClose={resetForm}
        panelClassName="max-w-3xl"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <FieldLabel htmlFor="mapping-vertical" label="Vertical" />
            <select
              id="mapping-vertical"
              value={form.verticalId}
              onChange={(event) => setForm((prev) => ({ ...prev, verticalId: event.target.value }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25"
            >
              <option value="">Select vertical</option>
              {verticals.map((vertical) => (
                <option key={vertical.id} value={vertical.id}>
                  {vertical.name}
                </option>
              ))}
            </select>
            <FormError error={errors.verticalId} />
          </div>

          <div>
            <FieldLabel htmlFor="mapping-seller" label="Seller" />
            <select
              id="mapping-seller"
              value={form.sellerId}
              onChange={(event) => setForm((prev) => ({ ...prev, sellerId: event.target.value }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25"
            >
              <option value="">Select seller</option>
              {sellers.map((seller) => (
                <option key={seller.id} value={seller.id}>
                  {seller.name}
                </option>
              ))}
            </select>
            <FormError error={errors.sellerId} />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <PrimaryButton type="button" onClick={handleSubmit}>
            {editingId ? "Update Mapping" : "Create Mapping"}
          </PrimaryButton>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={modalMessage !== null}
        title="Validation Notice"
        description={modalMessage ?? undefined}
        onClose={() => setModalMessage(null)}
        actions={
          <button
            type="button"
            onClick={() => setModalMessage(null)}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 dark:bg-blue-500 dark:text-white dark:hover:bg-blue-400"
          >
            OK
          </button>
        }
      />

      <Modal
        open={deleteTarget !== null}
        title="Delete Vertical Mapping"
        description={
          deleteTarget
            ? `Delete mapping for ${mappingLabels.find((item) => item.id === deleteTarget.id)?.verticalName ?? deleteTarget.verticalId} and ${mappingLabels.find((item) => item.id === deleteTarget.id)?.sellerName ?? deleteTarget.sellerId}?`
            : undefined
        }
        onClose={() => setDeleteTarget(null)}
        actions={
          <>
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 dark:bg-red-500 dark:text-white dark:hover:bg-red-400"
            >
              Delete
            </button>
          </>
        }
      />
    </div>
  );
}
