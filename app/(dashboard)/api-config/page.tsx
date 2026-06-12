"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { CopyableValue } from "@/components/ui/copy-button";
import { CreateSellerApiModal } from "@/components/api-config/create-seller-api-modal";
import { EditSellerApiModal } from "@/components/api-config/edit-seller-api-modal";
import { IconActionButton } from "@/components/ui/action-buttons";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import { PageSection } from "@/components/ui/state";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

type SellerVertical = {
  id: string;
  verticalId: string;
  verticalName: string;
  apiName: string;
  status: "Active" | "Inactive";
  apiRequest?: {
    apiKey: string;
    url: string;
    method: string;
  };
};

export default function ApiConfigPage() {
  const searchParams = useSearchParams();
  const sellerId = searchParams.get("sellerId");
  const sellerName = searchParams.get("sellerName");
  const [verticals, setVerticals] = useState<SellerVertical[]>([]);
  const [isVerticalLoading, setIsVerticalLoading] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<SellerVertical | null>(null);
  const [deletingRow, setDeletingRow] = useState<SellerVertical | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchVerticals = useCallback(async () => {
    if (!sellerId) return;

    setIsVerticalLoading(true);
    try {
      const response = await fetch(`/api/sellers/${encodeURIComponent(sellerId)}/verticals`);
      if (!response.ok) return;
      const data = (await response.json()) as SellerVertical[];
      setVerticals(data);
    } finally {
      setIsVerticalLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    void fetchVerticals();
  }, [fetchVerticals]);

  const verticalRows = sellerId ? verticals : [];

  const handleDelete = async () => {
    if (!sellerId || !deletingRow) return;

    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/sellers/${encodeURIComponent(sellerId)}/verticals/mappings/${encodeURIComponent(deletingRow.id)}`,
        { method: "DELETE" }
      );
      if (!response.ok) return;

      setDeletingRow(null);
      await fetchVerticals();
    } finally {
      setIsDeleting(false);
    }
  };

  const verticalColumns: Column<SellerVertical>[] = [
    { key: "apiName", label: "API Name", render: (row) => <span className="font-medium">{row.apiName}</span> },
    { key: "verticalName", label: "Vertical Name" },
    {
      key: "apiKey",
      label: "API Key",
      render: (row) =>
        row.apiRequest?.apiKey ? (
          <CopyableValue value={row.apiRequest.apiKey} copyLabel="Copy API key" />
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (row) => (
        <div className="flex flex-wrap items-center gap-2">
          <IconActionButton
            icon={Pencil}
            variant="ghost"
            className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
            onClick={() => setEditingRow(row)}
          >
            Edit
          </IconActionButton>
          <IconActionButton
            icon={Trash2}
            variant="danger"
            className="rounded-lg px-2 py-1 text-xs"
            onClick={() => setDeletingRow(row)}
          >
            Delete
          </IconActionButton>
          <Link
            href={`/api-config/document/${encodeURIComponent(row.id)}?sellerId=${encodeURIComponent(sellerId ?? "")}&sellerName=${encodeURIComponent(sellerName ?? "")}&apiName=${encodeURIComponent(row.apiName)}&verticalName=${encodeURIComponent(row.verticalName)}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-emerald-200 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50"
          >
            Document
          </Link>
          <Link
            href={`/api-config/${encodeURIComponent(sellerId ?? "")}/mappings/${encodeURIComponent(row.id)}/field-configuration?apiName=${encodeURIComponent(row.apiName)}&verticalName=${encodeURIComponent(row.verticalName)}&sellerName=${encodeURIComponent(sellerName ?? "")}`}
            className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
          >
            View Fields Configuration
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {sellerId ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Generating API config for seller: <span className="font-semibold">{sellerName ?? sellerId}</span>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Please open API config from the Publisher List for a specific publisher.
        </div>
      )}

      <PageSection
        actions={
          sellerId ? (
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
            >
              <Plus size={16} />
              Create API
            </button>
          ) : null
        }
      >
        <DataTable<SellerVertical>
          columns={verticalColumns}
          rows={verticalRows}
          emptyMessage={isVerticalLoading ? "Loading APIs..." : "No APIs configured for this seller yet."}
        />
      </PageSection>

      {sellerId ? (
        <>
          <CreateSellerApiModal
            open={isCreateOpen}
            sellerId={sellerId}
            onClose={() => setIsCreateOpen(false)}
            onCreated={() => void fetchVerticals()}
          />
          <EditSellerApiModal
            open={Boolean(editingRow)}
            sellerId={sellerId}
            mapping={editingRow}
            onClose={() => setEditingRow(null)}
            onUpdated={() => void fetchVerticals()}
          />
          <Modal
            open={Boolean(deletingRow)}
            title="Delete API"
            description={`Delete API "${deletingRow?.apiName ?? ""}"? This action cannot be undone.`}
            onClose={() => {
              if (!isDeleting) setDeletingRow(null);
            }}
            actions={
              <>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeletingRow(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:text-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => void handleDelete()}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </>
            }
          />
        </>
      ) : null}
    </div>
  );
}
