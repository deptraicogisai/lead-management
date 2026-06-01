"use client";

import { useEffect, useMemo, useState } from "react";
import { BuyerForm, type BuyerFormValues } from "@/components/forms/buyer-form";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ListControls } from "@/components/ui/list-controls";
import { Modal } from "@/components/ui/modal";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageSection } from "@/components/ui/state";
import type { Buyer } from "@/lib/mock-data";

type BuyerListResponse = {
  items: Buyer[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export default function BuyersPage() {
  const [buyerRows, setBuyerRows] = useState<Buyer[]>([]);
  const [editingBuyerId, setEditingBuyerId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Buyer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const editingBuyer = useMemo(
    () => buyerRows.find((buyer) => buyer.id === editingBuyerId) ?? null,
    [buyerRows, editingBuyerId]
  );

  useEffect(() => {
    const fetchBuyers = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
          search,
        });
        const response = await fetch(`/api/buyers?${params.toString()}`);
        if (!response.ok) return;

        const data = (await response.json()) as BuyerListResponse;
        setBuyerRows(data.items);
        setTotalItems(data.totalItems);
        setTotalPages(data.totalPages);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchBuyers();
  }, [page, pageSize, search, reloadKey]);

  const openCreateModal = () => {
    setEditingBuyerId(null);
    setIsFormOpen(true);
  };

  const openEditModal = (buyer: Buyer) => {
    setEditingBuyerId(buyer.id);
    setIsFormOpen(true);
  };

  const closeFormModal = () => {
    setEditingBuyerId(null);
    setIsFormOpen(false);
  };

  const handleSubmitBuyer = async (values: BuyerFormValues) => {
    if (editingBuyerId) {
      const response = await fetch(`/api/buyers/${encodeURIComponent(editingBuyerId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) return;

      closeFormModal();
      setReloadKey((prev) => prev + 1);
      return;
    }

    const response = await fetch("/api/buyers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!response.ok) return;

    closeFormModal();
    setPage(1);
    setReloadKey((prev) => prev + 1);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    const response = await fetch(`/api/buyers/${encodeURIComponent(deleteTarget.id)}`, {
      method: "DELETE",
    });
    if (!response.ok) return;

    if (editingBuyerId === deleteTarget.id) {
      closeFormModal();
    }
    setDeleteTarget(null);
    if (buyerRows.length === 1 && page > 1) {
      setPage((prev) => prev - 1);
    } else {
      setReloadKey((prev) => prev + 1);
    }
  };

  const columns: Column<Buyer>[] = [
    { key: "firstName", label: "First Name" },
    { key: "lastName", label: "Last Name" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "company", label: "Company" },
    { key: "verticalName", label: "Vertical" },
    {
      key: "status",
      label: "Status",
      render: (row) => (
        <span
          className={
            row.status === "Active"
              ? "rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700"
              : "rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700"
          }
        >
          {row.status}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openEditModal(row)}
            className="rounded-lg border border-blue-200 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/20"
          >
            Mapping Field
          </button>
          <button
            type="button"
            onClick={() => openEditModal(row)}
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
        searchPlaceholder="Search by name, email, phone, company, vertical or status"
      />

      <PageSection
        title="Buyer List"
        actions={
          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 dark:bg-blue-500 dark:text-white dark:hover:bg-blue-400"
          >
            Create Buyer
          </button>
        }
      >
        <DataTable<Buyer>
          columns={columns}
          rows={buyerRows}
          emptyMessage={isLoading ? "Loading buyers..." : "No buyers yet. Create your first buyer to start distribution mapping."}
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
        title={editingBuyer ? `Edit Buyer - ${editingBuyer.company}` : "Create Buyer"}
        onClose={closeFormModal}
        panelClassName="max-w-3xl"
      >
        <BuyerForm
          key={editingBuyerId ?? "create-buyer"}
          initialValues={
            editingBuyer
              ? {
                  firstName: editingBuyer.firstName,
                  lastName: editingBuyer.lastName,
                  email: editingBuyer.email,
                  phone: editingBuyer.phone,
                  company: editingBuyer.company,
                  verticalId: editingBuyer.verticalId,
                    apiKey: editingBuyer.apiKey,
                    postLeadUrl: editingBuyer.postLeadUrl,
                  status: editingBuyer.status,
                  mappings: editingBuyer.mappings,
                }
              : undefined
          }
          isEditing={Boolean(editingBuyer)}
          onCancelEdit={closeFormModal}
          onSubmitBuyer={handleSubmitBuyer}
        />
      </Modal>

      <Modal
        open={deleteTarget !== null}
        title="Delete Buyer"
        description={deleteTarget ? `Delete buyer "${deleteTarget.company}"?` : undefined}
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
