"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IndustryForm } from "@/components/forms/industry-form";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ListControls } from "@/components/ui/list-controls";
import { Modal } from "@/components/ui/modal";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageSection } from "@/components/ui/state";
import type { Vertical } from "@/lib/mock-data";

type VerticalListResponse = {
  items: Vertical[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export default function IndustriesPage() {
  const [verticalRows, setVerticalRows] = useState<Vertical[]>([]);
  const [editingVerticalId, setEditingVerticalId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Vertical | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const editingVertical = verticalRows.find((vertical) => vertical.id === editingVerticalId) ?? null;

  useEffect(() => {
    const fetchIndustries = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
          search,
        });
        const response = await fetch(`/api/industries?${params.toString()}`);
        if (!response.ok) return;
        const data = (await response.json()) as VerticalListResponse;
        setVerticalRows(data.items);
        setTotalItems(data.totalItems);
        setTotalPages(data.totalPages);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchIndustries();
  }, [page, pageSize, search, reloadKey]);

  const handleDelete = async () => {
    if (!deleteTarget) return;

    const response = await fetch(`/api/industries/${encodeURIComponent(deleteTarget.id)}`, { method: "DELETE" });
    if (!response.ok) return;

    if (editingVerticalId === deleteTarget.id) {
      setEditingVerticalId(null);
      setIsFormOpen(false);
    }
    setDeleteTarget(null);
    if (verticalRows.length === 1 && page > 1) {
      setPage((prev) => prev - 1);
    } else {
      setReloadKey((prev) => prev + 1);
    }
  };

  const handleSubmitIndustry = async (values: Omit<Vertical, "id" | "fields">) => {
    if (editingVerticalId) {
      const response = await fetch(`/api/industries/${encodeURIComponent(editingVerticalId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) return;

      setEditingVerticalId(null);
      setIsFormOpen(false);
      setReloadKey((prev) => prev + 1);
      return;
    }

    const response = await fetch("/api/industries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!response.ok) return;

    setIsFormOpen(false);
    setPage(1);
    setReloadKey((prev) => prev + 1);
  };

  const openCreateModal = () => {
    setEditingVerticalId(null);
    setIsFormOpen(true);
  };

  const openEditModal = (verticalId: string) => {
    setEditingVerticalId(verticalId);
    setIsFormOpen(true);
  };

  const closeFormModal = () => {
    setEditingVerticalId(null);
    setIsFormOpen(false);
  };

  const columns: Column<Vertical>[] = [
    { key: "name", label: "Vertical Name" },
    { key: "description", label: "Description" },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="flex gap-2">
          <Link
            href={`/verticals/fields?verticalId=${encodeURIComponent(row.id)}&verticalName=${encodeURIComponent(row.name)}`}
            className="rounded-lg border border-blue-200 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/20"
          >
            Fields Configuration
          </Link>
          <button
            type="button"
            onClick={() => openEditModal(row.id)}
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
        searchPlaceholder="Search by vertical name or description"
      />

      <PageSection
        title="Vertical List"
        actions={
          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 dark:bg-blue-500 dark:text-white dark:hover:bg-blue-400"
          >
            Create Vertical
          </button>
        }
      >
        <DataTable<Vertical>
          columns={columns}
          rows={verticalRows}
          emptyMessage={isLoading ? "Loading verticals..." : "No verticals yet. Create your first vertical to get started."}
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
        title={editingVertical ? `Edit Vertical - ${editingVertical.name}` : "Create Vertical"}
        onClose={closeFormModal}
        panelClassName="max-w-2xl"
      >
        <IndustryForm
          key={editingVerticalId ?? "create-vertical"}
          initialValues={
            editingVertical
              ? {
                  name: editingVertical.name,
                  description: editingVertical.description,
                }
              : undefined
          }
          isEditing={Boolean(editingVertical)}
          onCancelEdit={closeFormModal}
          onSubmitIndustry={handleSubmitIndustry}
        />
      </Modal>

      <Modal
        open={deleteTarget !== null}
        title="Delete Vertical"
        description={deleteTarget ? `Delete vertical "${deleteTarget.name}"?` : undefined}
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
