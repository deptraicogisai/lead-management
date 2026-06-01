"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SellerForm } from "@/components/forms/seller-form";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ListControls } from "@/components/ui/list-controls";
import { Modal } from "@/components/ui/modal";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageSection } from "@/components/ui/state";
import type { Seller } from "@/lib/mock-data";

type SellerListResponse = {
  items: Seller[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export default function SellersPage() {
  const [sellerRows, setSellerRows] = useState<Seller[]>([]);
  const [editingSellerId, setEditingSellerId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Seller | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const editingSeller = sellerRows.find((seller) => seller.id === editingSellerId) ?? null;

  useEffect(() => {
    const fetchSellers = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
          search,
        });
        const response = await fetch(`/api/sellers?${params.toString()}`);
        if (!response.ok) return;

        const data = (await response.json()) as SellerListResponse;
        setSellerRows(data.items);
        setTotalItems(data.totalItems);
        setTotalPages(data.totalPages);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchSellers();
  }, [page, pageSize, search, reloadKey]);

  const handleDelete = async () => {
    if (!deleteTarget) return;

    const response = await fetch(`/api/sellers/${encodeURIComponent(deleteTarget.id)}`, { method: "DELETE" });
    if (!response.ok) return;

    if (editingSellerId === deleteTarget.id) {
      setEditingSellerId(null);
      setIsFormOpen(false);
    }
    setDeleteTarget(null);
    if (sellerRows.length === 1 && page > 1) {
      setPage((prev) => prev - 1);
    } else {
      setReloadKey((prev) => prev + 1);
    }
  };

  const handleEdit = (row: Seller) => {
    setEditingSellerId(row.id);
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setEditingSellerId(null);
    setIsFormOpen(true);
  };

  const closeFormModal = () => {
    setEditingSellerId(null);
    setIsFormOpen(false);
  };

  const handleSubmitSeller = async (values: Omit<Seller, "id">) => {
    if (editingSellerId) {
      const response = await fetch(`/api/sellers/${encodeURIComponent(editingSellerId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) return;

      closeFormModal();
      setReloadKey((prev) => prev + 1);
      return;
    }

    const response = await fetch("/api/sellers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!response.ok) return;

    closeFormModal();
    setPage(1);
    setReloadKey((prev) => prev + 1);
  };

  const columns: Column<Seller>[] = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "region", label: "Region" },
    { key: "status", label: "Status" },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="flex gap-2">
          <Link
            href={`/api-config?sellerId=${encodeURIComponent(row.id)}&sellerName=${encodeURIComponent(row.name)}`}
            className="rounded-lg border border-blue-200 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/20"
          >
            Generate API Config
          </Link>
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
        searchPlaceholder="Search by name, email, region or status"
      />

      <PageSection
        title="Sellers List"
        actions={
          <button
            type="button"
            onClick={handleCreate}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 dark:bg-blue-500 dark:text-white dark:hover:bg-blue-400"
          >
            Create Seller
          </button>
        }
      >
        <DataTable<Seller>
          columns={columns}
          rows={sellerRows}
          emptyMessage={isLoading ? "Loading sellers..." : "No sellers yet. Create your first seller to get started."}
        />
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
        title={editingSeller ? `Edit Seller - ${editingSeller.name}` : "Create Seller"}
        onClose={closeFormModal}
        panelClassName="max-w-2xl"
      >
        <SellerForm
          key={editingSellerId ?? "create-seller"}
          initialValues={
            editingSeller
              ? {
                  name: editingSeller.name,
                  email: editingSeller.email,
                  region: editingSeller.region,
                  status: editingSeller.status,
                }
              : undefined
          }
          isEditing={Boolean(editingSeller)}
          onCancelEdit={closeFormModal}
          onSubmitSeller={handleSubmitSeller}
        />
      </Modal>

      <Modal
        open={deleteTarget !== null}
        title="Delete Seller"
        description={deleteTarget ? `Delete seller "${deleteTarget.name}"?` : undefined}
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
              onClick={handleDelete}
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
