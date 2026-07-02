"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AddNewButton,
  CancelButton,
  DangerButton,
  TableActionButton,
} from "@/components/ui/action-buttons";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PrimaryButton } from "@/components/ui/form-controls";
import { IdBadge } from "@/components/ui/id-badge";
import { SectionLoading } from "@/components/ui/loading-indicator";
import { Modal } from "@/components/ui/modal";
import { PaymentMethodIcon } from "@/components/sellers/payment-method-icons";
import { SellerPaymentForm } from "@/components/sellers/seller-payment-form";
import {
  collectSellerPaymentFieldErrors,
  emptySellerPaymentSettings,
  formatPaymentMethodLabel,
  type SellerPaymentFieldErrorKey,
  type SellerPaymentFieldErrors,
  type SellerPaymentRecord,
  type SellerPaymentSettings,
} from "@/lib/seller-payment";

type SellerPaymentTabProps = {
  sellerId: string;
};

type PaymentFieldKey = keyof SellerPaymentSettings;

function toFormState(payment: SellerPaymentRecord): SellerPaymentSettings {
  const { id: _id, displayId: _displayId, ...settings } = payment;
  return settings;
}

export function SellerPaymentTab({ sellerId }: SellerPaymentTabProps) {
  const [payments, setPayments] = useState<SellerPaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [form, setForm] = useState<SellerPaymentSettings>(emptySellerPaymentSettings());
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<SellerPaymentFieldErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<SellerPaymentRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadPayments = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/sellers/${encodeURIComponent(sellerId)}/payments`);
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as SellerPaymentRecord[];
      setPayments(data);
    } finally {
      setIsLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  const openCreate = () => {
    setEditingPaymentId(null);
    setForm(emptySellerPaymentSettings());
    setFormError("");
    setFieldErrors({});
    setIsFormOpen(true);
  };

  const openEdit = (payment: SellerPaymentRecord) => {
    setEditingPaymentId(payment.id);
    setForm(toFormState(payment));
    setFormError("");
    setFieldErrors({});
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingPaymentId(null);
    setForm(emptySellerPaymentSettings());
    setFormError("");
    setFieldErrors({});
  };

  const updateField = <K extends PaymentFieldKey>(key: K, value: SellerPaymentSettings[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (formError) setFormError("");
    setFieldErrors((current) => {
      if (key === "method") return {};
      const fieldKey = key as SellerPaymentFieldErrorKey;
      if (!current[fieldKey]) return current;
      const next = { ...current };
      delete next[fieldKey];
      return next;
    });
  };

  const handleSave = async () => {
    const nextFieldErrors = collectSellerPaymentFieldErrors(form);
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }
    setFieldErrors({});

    setIsSaving(true);
    setFormError("");

    try {
      const url = editingPaymentId
        ? `/api/sellers/${encodeURIComponent(sellerId)}/payments/${encodeURIComponent(editingPaymentId)}`
        : `/api/sellers/${encodeURIComponent(sellerId)}/payments`;

      const response = await fetch(url, {
        method: editingPaymentId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const result = (await response.json().catch(() => null)) as SellerPaymentRecord | { message?: string } | null;

      if (!response.ok) {
        const message = (result as { message?: string } | null)?.message ?? "Failed to save payment info.";
        setFormError(message);
        return;
      }

      closeForm();
      await loadPayments();
    } catch {
      setFormError("Failed to save payment info.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/sellers/${encodeURIComponent(sellerId)}/payments/${encodeURIComponent(deleteTarget.id)}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        return;
      }

      setDeleteTarget(null);
      await loadPayments();
    } catch {
      // Keep delete modal open on failure.
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<SellerPaymentRecord>[] = [
    {
      key: "displayId",
      label: "ID",
      sortValue: (row) => row.displayId,
      render: (row) => (
        <button
          type="button"
          onClick={() => openEdit(row)}
          className="group inline-flex"
          aria-label={`Edit payment info ${row.displayId}`}
        >
          <IdBadge id={row.displayId} interactive />
        </button>
      ),
    },
    {
      key: "method",
      label: "Payment Method",
      sortValue: (row) => formatPaymentMethodLabel(row.method),
      render: (row) => (
        <div className="flex items-center gap-2.5">
          {row.method ? <PaymentMethodIcon method={row.method} size={22} /> : null}
          <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
            {formatPaymentMethodLabel(row.method)}
          </span>
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <TableActionButton onClick={() => openEdit(row)}>Detail</TableActionButton>
          <TableActionButton variant="danger" onClick={() => setDeleteTarget(row)}>
            Delete
          </TableActionButton>
        </div>
      ),
    },
  ];

  const formIdPrefix = editingPaymentId ? `payment-edit-${editingPaymentId}` : "payment-create";

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Payment Info</h3>
        <AddNewButton type="button" onClick={openCreate}>
          Add Payment Info
        </AddNewButton>
      </div>

      <div className="px-6 py-6">
        {isLoading ? (
          <SectionLoading message="Loading payment info..." />
        ) : (
          <DataTable<SellerPaymentRecord>
            columns={columns}
            rows={payments}
            emptyMessage='No payment info yet. Click “Add Payment Info” to create one.'
          />
        )}
      </div>

      <Modal
        open={isFormOpen}
        title={editingPaymentId ? "Edit Payment Info" : "Add Payment Info"}
        onClose={closeForm}
        panelClassName="max-w-3xl"
        actions={
          <>
            <CancelButton type="button" onClick={closeForm} />
            <PrimaryButton
              type="button"
              disabled={isSaving}
              onClick={() => void handleSave()}
              className="bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              {isSaving ? "Saving..." : "Save Payment Info"}
            </PrimaryButton>
          </>
        }
      >
        <SellerPaymentForm
          formIdPrefix={formIdPrefix}
          settings={form}
          formError={formError}
          fieldErrors={fieldErrors}
          onChange={updateField}
        />
      </Modal>

      <Modal
        open={deleteTarget !== null}
        title="Delete Payment Info"
        description={
          deleteTarget
            ? `Permanently delete payment info #${deleteTarget.displayId} (${formatPaymentMethodLabel(deleteTarget.method)})? This cannot be undone.`
            : undefined
        }
        onClose={() => setDeleteTarget(null)}
        actions={
          <>
            <CancelButton type="button" onClick={() => setDeleteTarget(null)} />
            <DangerButton type="button" disabled={isDeleting} onClick={() => void handleDelete()}>
              {isDeleting ? "Deleting..." : "Delete"}
            </DangerButton>
          </>
        }
      />
    </div>
  );
}
