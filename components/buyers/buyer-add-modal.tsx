"use client";

import { useEffect, useState } from "react";
import { BuyerForm } from "@/components/forms/buyer-form";
import { Modal } from "@/components/ui/modal";
import { type BuyerCreatePayload } from "@/lib/buyer";

type BuyerAddModalProps = {
  open: boolean;
  isSaving?: boolean;
  onClose: () => void;
  onSubmit: (values: BuyerCreatePayload) => Promise<void> | void;
};

export function BuyerAddModal({ open, isSaving = false, onClose, onSubmit }: BuyerAddModalProps) {
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (open) {
      setFormKey((current) => current + 1);
    }
  }, [open]);

  return (
    <Modal open={open} title="Create Buyer" onClose={onClose} panelClassName="max-w-2xl">
      <BuyerForm key={formKey} isSaving={isSaving} onSubmit={onSubmit} />
    </Modal>
  );
}
