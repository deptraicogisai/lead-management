"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AddNewButton, TableActionButton } from "@/components/ui/action-buttons";
import {
  CancelButton,
  FieldLabel,
  FormError,
  Input,
  PrimaryButton,
  Select,
} from "@/components/ui/form-controls";
import { IdBadge } from "@/components/ui/id-badge";
import { SectionLoading } from "@/components/ui/loading-indicator";
import { Modal } from "@/components/ui/modal";
import {
  ALL_CHANNELS_VALUE,
  PUBLISHER_DISTRIBUTION_TYPES,
  type PublisherDistributionRecord,
  type PublisherDistributionType,
} from "@/lib/publisher-distribution";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type ProductOption = {
  verticalId: string;
  verticalName: string;
  productLabel: string;
};

type ChannelOption = {
  id: string;
  apiName: string;
  verticalId: string;
};

type TreeOption = {
  id: string;
  name: string;
  displayId: number | null;
};

type ModalState = {
  id: string | null;
  verticalId: string;
  channelId: string;
  processingType: PublisherDistributionType;
  percents: Record<string, number>;
};

const emptyModal: ModalState = {
  id: null,
  verticalId: "",
  channelId: ALL_CHANNELS_VALUE,
  processingType: "Main processing",
  percents: {},
};

type GridRow = {
  distribution: PublisherDistributionRecord;
  allocationIndex: number;
  isFirst: boolean;
  rowSpan: number;
};

export function SellerPingTreeTab({ sellerId }: { sellerId: string }) {
  const [records, setRecords] = useState<PublisherDistributionRecord[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [modal, setModal] = useState<ModalState>(emptyModal);
  const [trees, setTrees] = useState<TreeOption[]>([]);
  const [treesLoading, setTreesLoading] = useState(false);
  const [modalError, setModalError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<PublisherDistributionRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/sellers/${sellerId}/distributions`);
      if (!response.ok) return;
      setRecords((await response.json()) as PublisherDistributionRecord[]);
    } finally {
      setIsLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/ping-tree-configs/products");
      if (!response.ok) return;
      setProducts((await response.json()) as ProductOption[]);
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      const response = await fetch(`/api/sellers/${sellerId}/verticals?status=Active`);
      if (!response.ok) return;
      const data = (await response.json()) as Array<{ id: string; apiName: string; verticalId: string }>;
      setChannels(data.map((item) => ({ id: item.id, apiName: item.apiName, verticalId: item.verticalId })));
    })();
  }, [sellerId]);

  // Load ping trees for the selected product + type only.
  useEffect(() => {
    if (!modalOpen || !modal.verticalId || !modal.processingType) {
      setTrees([]);
      return;
    }
    let cancelled = false;
    setTreesLoading(true);
    void (async () => {
      try {
        const params = new URLSearchParams({
          processingType: modal.processingType,
          verticalId: modal.verticalId,
        });
        const response = await fetch(`/api/ping-tree-configs?${params.toString()}`);
        if (!response.ok) return;
        const data = (await response.json()) as Array<{
          id: string;
          name: string;
          displayId: number | null;
          status: string;
        }>;
        if (cancelled) return;
        setTrees(
          data
            .filter((tree) => tree.status === "Active")
            .map((tree) => ({ id: tree.id, name: tree.name, displayId: tree.displayId }))
        );
      } finally {
        if (!cancelled) setTreesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modalOpen, modal.verticalId, modal.processingType]);

  const channelOptions = useMemo(
    () => channels.filter((channel) => channel.verticalId === modal.verticalId),
    [channels, modal.verticalId]
  );

  const selectedProductLabel = useMemo(
    () => products.find((product) => product.verticalId === modal.verticalId)?.productLabel ?? "",
    [products, modal.verticalId]
  );

  // Group records by product (vertical), preserving the products list order.
  const groups = useMemo(() => {
    const byProduct = new Map<string, { label: string; rows: GridRow[] }>();
    for (const distribution of records) {
      if (!byProduct.has(distribution.verticalId)) {
        byProduct.set(distribution.verticalId, { label: distribution.productLabel, rows: [] });
      }
      const bucket = byProduct.get(distribution.verticalId)!;
      const allocations = distribution.allocations.length > 0 ? distribution.allocations : [];
      allocations.forEach((_, index) => {
        bucket.rows.push({
          distribution,
          allocationIndex: index,
          isFirst: index === 0,
          rowSpan: allocations.length,
        });
      });
    }
    return Array.from(byProduct.entries()).map(([verticalId, value]) => ({
      verticalId,
      label: value.label,
      rows: value.rows,
    }));
  }, [records]);

  const modalTotal = useMemo(
    () => trees.reduce((total, tree) => total + (modal.percents[tree.id] ?? 0), 0),
    [trees, modal.percents]
  );

  const openCreate = () => {
    const firstProduct = products[0]?.verticalId ?? "";
    setModal({ ...emptyModal, verticalId: firstProduct });
    setModalError("");
    setModalOpen(true);
  };

  const openEdit = (distribution: PublisherDistributionRecord) => {
    setModal({
      id: distribution.id,
      verticalId: distribution.verticalId,
      channelId: distribution.mappingId ?? ALL_CHANNELS_VALUE,
      processingType: distribution.processingType,
      percents: Object.fromEntries(
        distribution.allocations.map((allocation) => [allocation.configId, allocation.percent])
      ),
    });
    setModalError("");
    setModalOpen(true);
  };

  const setPercent = (treeId: string, value: number) => {
    setModal((current) => ({
      ...current,
      percents: { ...current.percents, [treeId]: Math.max(0, Math.min(100, Math.round(value) || 0)) },
    }));
  };

  const setTreeTo100 = (treeId: string) => {
    setModal((current) => {
      const next: Record<string, number> = {};
      for (const tree of trees) next[tree.id] = tree.id === treeId ? 100 : 0;
      return { ...current, percents: next };
    });
  };

  const submitModal = async () => {
    setModalError("");

    if (!modal.verticalId) {
      setModalError("Please select a product.");
      return;
    }
    const allocations = trees
      .map((tree) => ({ configId: tree.id, percent: modal.percents[tree.id] ?? 0 }))
      .filter((allocation) => allocation.percent > 0);

    if (allocations.length === 0) {
      setModalError("Set a percentage for at least one ping tree.");
      return;
    }
    if (modalTotal !== 100) {
      setModalError(`Total percent is ${modalTotal}%. The total for all ping trees must equal 100%.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        verticalId: modal.verticalId,
        mappingId: modal.channelId === ALL_CHANNELS_VALUE ? null : modal.channelId,
        processingType: modal.processingType,
        allocations,
      };
      const response = await fetch(
        modal.id
          ? `/api/sellers/${sellerId}/distributions/${modal.id}`
          : `/api/sellers/${sellerId}/distributions`,
        {
          method: modal.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string };
        setModalError(data.message ?? "Failed to save distribution setting.");
        return;
      }
      toast.success(
        modal.id ? "Distribution updated." : "Distribution created.",
        "Distribution by Publisher"
      );
      setModalOpen(false);
      void loadRecords();
    } catch {
      setModalError("Failed to save distribution setting.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/sellers/${sellerId}/distributions/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string };
        toast.error(data.message ?? "Failed to delete distribution setting.", "Distribution by Publisher");
        return;
      }
      toast.success("Distribution deleted.", "Distribution by Publisher");
      setDeleteTarget(null);
      void loadRecords();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-center text-base font-semibold text-slate-900 sm:text-left dark:text-slate-100">
          Distribution by Publisher
        </h3>
        <AddNewButton type="button" onClick={openCreate}>
          Create new Distribution Settings
        </AddNewButton>
      </div>

      {isLoading ? (
        <SectionLoading message="Loading distribution settings..." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Ping Tree</th>
                <th className="px-4 py-3">Distribution, %</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    No distribution settings yet. Click &quot;Create new Distribution Settings&quot; to add one.
                  </td>
                </tr>
              ) : (
                groups.map((group) => (
                  <GroupRows
                    key={group.verticalId}
                    label={group.label}
                    rows={group.rows}
                    onEdit={openEdit}
                    onDelete={setDeleteTarget}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal
        open={modalOpen}
        title={modal.id ? "Edit Distribution Settings" : "Create new Distribution Settings"}
        onClose={() => setModalOpen(false)}
        panelClassName="max-w-2xl"
        actions={
          <>
            <CancelButton onClick={() => setModalOpen(false)} disabled={isSubmitting} />
            <PrimaryButton onClick={submitModal} disabled={isSubmitting || modalTotal !== 100}>
              {isSubmitting ? "Applying..." : "Apply"}
            </PrimaryButton>
          </>
        }
      >
        <div className="space-y-4">
          <FormError error={modalError} />

          <div>
            <FieldLabel htmlFor="dist-product" label="Product" required />
            <Select
              id="dist-product"
              value={modal.verticalId}
              onChange={(event) =>
                setModal((current) => ({
                  ...current,
                  verticalId: event.target.value,
                  channelId: ALL_CHANNELS_VALUE,
                  percents: {},
                }))
              }
            >
              <option value="" disabled>
                Select a product
              </option>
              {products.map((product) => (
                <option key={product.verticalId} value={product.verticalId}>
                  {product.productLabel}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <FieldLabel htmlFor="dist-channel" label="Channel" />
            <Select
              id="dist-channel"
              value={modal.channelId}
              onChange={(event) => setModal((current) => ({ ...current, channelId: event.target.value }))}
            >
              <option value={ALL_CHANNELS_VALUE}>All Channels</option>
              {channelOptions.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.apiName}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <FieldLabel htmlFor="dist-type" label="Type" required />
            <Select
              id="dist-type"
              value={modal.processingType}
              onChange={(event) =>
                setModal((current) => ({
                  ...current,
                  processingType: event.target.value as PublisherDistributionType,
                  percents: {},
                }))
              }
            >
              {PUBLISHER_DISTRIBUTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </div>

          {modal.verticalId && modal.processingType ? (
            treesLoading ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Loading ping trees...</p>
            ) : trees.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-400">
                No active ping trees for {selectedProductLabel} · {modal.processingType}. Create them in Ping Tree
                Settings first.
              </p>
            ) : (
              <>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Ping trees for {selectedProductLabel} · {modal.processingType}
                </p>
                <div className="space-y-2.5">
                {trees.map((tree) => (
                  <div key={tree.id} className="grid grid-cols-[1fr_8rem_3rem_auto] items-center gap-3">
                    <span className="text-right font-medium text-slate-800 dark:text-slate-100">{tree.name}</span>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={modal.percents[tree.id] ?? 0}
                      onChange={(event) => setPercent(tree.id, Number(event.target.value))}
                    />
                    <span className="text-sm text-emerald-600 dark:text-emerald-400">
                      {modal.percents[tree.id] ?? 0}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setTreeTo100(tree.id)}
                      className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600"
                    >
                      Set to 100%
                    </button>
                  </div>
                ))}
              </div>
              <div
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm font-medium",
                  modalTotal === 100
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300"
                    : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
                )}
              >
                Total percent: {modalTotal}%
              </div>
            </>
            )
          ) : null}
        </div>
      </Modal>

      {/* Delete confirm modal */}
      <Modal
        open={deleteTarget !== null}
        title="Delete Distribution Settings"
        description={
          deleteTarget
            ? `Are you sure you want to delete the ${deleteTarget.processingType} distribution for "${deleteTarget.channelName}"?`
            : undefined
        }
        onClose={() => setDeleteTarget(null)}
        actions={
          <>
            <CancelButton onClick={() => setDeleteTarget(null)} disabled={isDeleting} />
            <PrimaryButton
              onClick={submitDelete}
              disabled={isDeleting}
              className="border-red-600 bg-red-600 hover:bg-red-700 dark:border-red-500 dark:bg-red-500"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </PrimaryButton>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">This action cannot be undone.</p>
      </Modal>
    </div>
  );
}

type GroupRowsProps = {
  label: string;
  rows: GridRow[];
  onEdit: (distribution: PublisherDistributionRecord) => void;
  onDelete: (distribution: PublisherDistributionRecord) => void;
};

function GroupRows({ label, rows, onEdit, onDelete }: GroupRowsProps) {
  return (
    <>
      <tr className="border-b border-slate-300 bg-slate-200 dark:border-slate-600 dark:bg-slate-700/70">
        <td colSpan={5} className="px-4 py-2.5">
          <span className="block text-center text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-slate-100">
            {label}
          </span>
        </td>
      </tr>
      {rows.map((row) => {
        const allocation = row.distribution.allocations[row.allocationIndex];
        return (
          <tr
            key={`${row.distribution.id}-${allocation?.configId ?? row.allocationIndex}`}
            className="border-b border-slate-100 text-slate-700 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800/40"
          >
            <td className="px-4 py-3 align-middle">{row.distribution.processingType}</td>
            <td className="px-4 py-3 align-middle font-medium text-slate-800 dark:text-slate-100">
              {row.distribution.channelName}
            </td>
            <td className="px-4 py-3 align-middle">
              <span className="inline-flex items-center gap-2">
                {allocation?.displayId != null ? <IdBadge id={allocation.displayId} /> : null}
                <span>{allocation?.configName ?? "—"}</span>
              </span>
            </td>
            <td className="px-4 py-3 align-middle">{allocation ? `${allocation.percent}%` : "—"}</td>
            {row.isFirst ? (
              <td className="px-4 py-3 align-middle" rowSpan={row.rowSpan}>
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  <TableActionButton variant="danger" onClick={() => onDelete(row.distribution)}>
                    Delete
                  </TableActionButton>
                  <TableActionButton onClick={() => onEdit(row.distribution)}>Edit</TableActionButton>
                </div>
              </td>
            ) : null}
          </tr>
        );
      })}
    </>
  );
}
