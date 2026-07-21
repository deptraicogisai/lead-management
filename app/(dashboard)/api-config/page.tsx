"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  FileText,
  Pencil,
  Settings2,
} from "lucide-react";
import { IdBadge } from "@/components/ui/id-badge";
import { CopyableValue } from "@/components/ui/copy-button";
import { CreateSellerApiModal } from "@/components/api-config/create-seller-api-modal";
import { EditSellerApiModal } from "@/components/api-config/edit-seller-api-modal";
import {
  AddNewButton,
  CancelButton,
  DangerButton,
  TableActionButton,
  TableActionLink,
  tableActionButtonClassName,
} from "@/components/ui/action-buttons";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import { ListTableContainer } from "@/components/ui/list-table-container";
import { PageSection } from "@/components/ui/state";
import { StatusBadge } from "@/components/ui/status-badge";
import { IconText } from "@/lib/button-icons";
import { useListLoadState } from "@/lib/use-list-load-state";
import { cn } from "@/lib/utils";

type SellerVertical = {
  id: string;
  displayId: number | null;
  verticalId: string;
  verticalName: string;
  publisherName: string;
  apiName: string;
  apiType: "Redirect" | "Silent";
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
  const { isInitialLoad, isRefreshing, beginLoad, endLoad } = useListLoadState();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<SellerVertical | null>(null);
  const [deletingRow, setDeletingRow] = useState<SellerVertical | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchVerticals = useCallback(async () => {
    if (!sellerId) return;

    beginLoad();
    try {
      const response = await fetch(`/api/sellers/${encodeURIComponent(sellerId)}/verticals`);
      if (!response.ok) return;
      const data = (await response.json()) as SellerVertical[];
      setVerticals(data);
    } finally {
      endLoad();
    }
  }, [sellerId, beginLoad, endLoad]);

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
    {
      key: "displayId",
      label: "ID",
      sortValue: (row) => row.displayId ?? 0,
      headerClassName: "w-16 whitespace-nowrap",
      className: "w-16 whitespace-nowrap align-middle",
      render: (row) => <IdBadge id={row.displayId ?? "-"} />,
    },
    {
      key: "apiName",
      label: "Publisher Channel",
      headerClassName: "whitespace-nowrap",
      className: "whitespace-nowrap",
      render: (row) => <span className="font-medium">{row.apiName}</span>,
    },
    {
      key: "publisherName",
      label: "Publisher",
      render: (row) => row.publisherName || sellerName || "—",
    },
    { key: "verticalName", label: "Vertical Name" },
    { key: "apiType", label: "Type", render: (row) => row.apiType },
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
      headerClassName: "whitespace-nowrap",
      className: "whitespace-nowrap",
      render: (row) => (
        <div className="flex flex-wrap items-center gap-2">
          <TableActionButton icon={Pencil} onClick={() => setEditingRow(row)}>
            Edit
          </TableActionButton>
          <TableActionButton variant="danger" onClick={() => setDeletingRow(row)}>
            Delete
          </TableActionButton>
          <Link
            href={`/api-config/document/${encodeURIComponent(row.id)}?sellerId=${encodeURIComponent(sellerId ?? "")}&sellerName=${encodeURIComponent(sellerName ?? "")}&apiName=${encodeURIComponent(row.apiName)}&verticalName=${encodeURIComponent(row.verticalName)}`}
            target="_blank"
            rel="noreferrer"
            className={cn(
              tableActionButtonClassName,
              "inline-flex items-center gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/40 dark:text-emerald-200 dark:hover:bg-emerald-500/10"
            )}
          >
            <IconText icon={FileText} size={12}>
              Document
            </IconText>
          </Link>
          <TableActionLink
            href={`/api-config/${encodeURIComponent(sellerId ?? "")}/mappings/${encodeURIComponent(row.id)}/field-configuration?apiName=${encodeURIComponent(row.apiName)}&verticalName=${encodeURIComponent(row.verticalName)}&sellerName=${encodeURIComponent(sellerName ?? "")}`}
            icon={Settings2}
          >
            View Fields Configuration
          </TableActionLink>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {sellerId ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Publisher channels for: <span className="font-semibold">{sellerName ?? sellerId}</span>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Please open Publisher Channel from the Publisher List for a specific publisher.
        </div>
      )}

      <PageSection
        actions={
          sellerId ? (
            <AddNewButton onClick={() => setIsCreateOpen(true)}>Create Publisher Channel</AddNewButton>
          ) : null
        }
      >
        <ListTableContainer
          isInitialLoad={Boolean(sellerId) && isInitialLoad}
          isRefreshing={isRefreshing}
          loadingMessage="Loading publisher channels"
          skeletonRows={8}
        >
          <DataTable<SellerVertical>
            columns={verticalColumns}
            rows={verticalRows}
            emptyMessage="No publisher channels configured for this publisher yet."
          />
        </ListTableContainer>
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
            title="Delete Publisher Channel"
            description={`Delete publisher channel "${deletingRow?.apiName ?? ""}"? This action cannot be undone.`}
            onClose={() => {
              if (!isDeleting) setDeletingRow(null);
            }}
            actions={
              <>
                <CancelButton disabled={isDeleting} onClick={() => setDeletingRow(null)}>
                  Cancel
                </CancelButton>
                <DangerButton disabled={isDeleting} onClick={() => void handleDelete()}>
                  {isDeleting ? "Deleting..." : "Delete"}
                </DangerButton>
              </>
            }
          />
        </>
      ) : null}
    </div>
  );
}
