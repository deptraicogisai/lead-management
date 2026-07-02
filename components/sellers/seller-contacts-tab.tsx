"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Briefcase,
  Link as LinkIcon,
  type LucideIcon,
  MessageCircle,
  MessageSquare,
  Plus,
  Send,
  ShieldCheck,
  UsersRound,
  X,
} from "lucide-react";
import {
  AddNewButton,
  CancelButton,
  DangerButton,
  TableActionButton,
} from "@/components/ui/action-buttons";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  FieldLabel,
  FormError,
  Input,
  PrimaryButton,
  SecondaryButton,
  Select,
} from "@/components/ui/form-controls";
import { IdBadge } from "@/components/ui/id-badge";
import { SectionLoading } from "@/components/ui/loading-indicator";
import { Modal } from "@/components/ui/modal";
import {
  CONTACT_CHANNEL_TYPES,
  type ContactChannel,
  type ContactChannelType,
  type SellerContact,
} from "@/lib/seller-contact";
import { toast } from "@/lib/toast";

const CHANNEL_ICONS: Record<ContactChannelType, { icon: LucideIcon; className: string }> = {
  Telegram: { icon: Send, className: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300" },
  Linkedin: { icon: Briefcase, className: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
  Teams: { icon: UsersRound, className: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300" },
  Signal: { icon: ShieldCheck, className: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" },
  Facebook: { icon: MessageCircle, className: "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300" },
  Whatsapp: { icon: MessageSquare, className: "bg-green-100 text-green-600 dark:bg-green-500/15 dark:text-green-300" },
  Other: { icon: LinkIcon, className: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300" },
};

// Thả ảnh .png vào public/icons/channels/ (xem README ở đó). Nếu thiếu ảnh sẽ tự fallback về icon lucide.
// "Other" luôn dùng icon mặc định nên không cần ảnh.
const CHANNEL_ICON_SRC: Partial<Record<ContactChannelType, string>> = {
  Telegram: "/icons/channels/telegram.png",
  Linkedin: "/icons/channels/linkedin.png",
  Teams: "/icons/channels/teams.png",
  Signal: "/icons/channels/signal.png",
  Facebook: "/icons/channels/facebook.png",
  Whatsapp: "/icons/channels/whatsapp.png",
};

function ChannelIcon({ type, size = 16 }: { type: ContactChannelType; size?: number }) {
  const [imageFailed, setImageFailed] = useState(false);
  const { icon: Icon, className } = CHANNEL_ICONS[type] ?? CHANNEL_ICONS.Other;
  const src = CHANNEL_ICON_SRC[type];

  useEffect(() => {
    setImageFailed(false);
  }, [type]);

  return (
    <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl ${className}`}>
      {src && !imageFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`${type} icon`}
          width={size + 4}
          height={size + 4}
          className="h-[60%] w-[60%] object-contain"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <Icon size={size} />
      )}
    </span>
  );
}

type SellerContactsTabProps = {
  sellerId: string;
};

type ContactFormState = {
  name: string;
  email: string;
  phone: string;
  website: string;
  channels: ContactChannel[];
};

type FieldErrors = {
  name?: string;
};

const emptyForm: ContactFormState = {
  name: "",
  email: "",
  phone: "",
  website: "",
  channels: [],
};

function toFormState(contact: SellerContact): ContactFormState {
  return {
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    website: contact.website,
    channels: contact.channels.map((channel) => ({ ...channel })),
  };
}

export function SellerContactsTab({ sellerId }: SellerContactsTabProps) {
  const [contacts, setContacts] = useState<SellerContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [form, setForm] = useState<ContactFormState>(emptyForm);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [showEmptyChannelError, setShowEmptyChannelError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<SellerContact | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadContacts = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/sellers/${encodeURIComponent(sellerId)}/contacts`);
      if (!response.ok) return;
      const data = (await response.json()) as SellerContact[];
      setContacts(data);
    } finally {
      setIsLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  const openCreate = () => {
    setEditingContactId(null);
    setForm(emptyForm);
    setFormError("");
    setFieldErrors({});
    setShowEmptyChannelError(false);
    setIsFormOpen(true);
  };

  const openEdit = (contact: SellerContact) => {
    setEditingContactId(contact.id);
    setForm(toFormState(contact));
    setFormError("");
    setFieldErrors({});
    setShowEmptyChannelError(false);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingContactId(null);
    setForm(emptyForm);
    setFormError("");
    setFieldErrors({});
    setShowEmptyChannelError(false);
  };

  const updateField = <K extends keyof ContactFormState>(key: K, value: ContactFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === "name") {
      setFieldErrors((current) => {
        if (!current.name) return current;
        const next = { ...current };
        delete next.name;
        return next;
      });
    }
  };

  const addChannel = () => {
    setForm((current) => ({
      ...current,
      channels: [...current.channels, { type: "Telegram", value: "" }],
    }));
  };

  const updateChannel = (index: number, patch: Partial<ContactChannel>) => {
    setForm((current) => ({
      ...current,
      channels: current.channels.map((channel, channelIndex) =>
        channelIndex === index ? { ...channel, ...patch } : channel
      ),
    }));
    if (patch.value !== undefined && showEmptyChannelError) {
      setShowEmptyChannelError(false);
    }
    if (formError) setFormError("");
  };

  const removeChannel = (index: number) => {
    setForm((current) => ({
      ...current,
      channels: current.channels.filter((_, channelIndex) => channelIndex !== index),
    }));
  };

  const handleSave = async () => {
    const nextFieldErrors: FieldErrors = {};
    if (!form.name.trim()) nextFieldErrors.name = "Name is required.";

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }
    setFieldErrors({});

    const hasEmptyChannel = form.channels.some((channel) => !channel.value.trim());
    if (hasEmptyChannel) {
      const message = "Please fill in a value for every channel, or remove the empty ones.";
      setShowEmptyChannelError(true);
      setFormError(message);
      toast.error(message);
      return;
    }
    setShowEmptyChannelError(false);

    const channels = form.channels.map((channel) => ({
      type: channel.type,
      value: channel.value.trim(),
    }));

    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      website: form.website.trim(),
      channels,
    };

    setIsSaving(true);
    setFormError("");

    try {
      const url = editingContactId
        ? `/api/sellers/${encodeURIComponent(sellerId)}/contacts/${encodeURIComponent(editingContactId)}`
        : `/api/sellers/${encodeURIComponent(sellerId)}/contacts`;

      const response = await fetch(url, {
        method: editingContactId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { message?: string } | null;
        setFormError(result?.message ?? "Failed to save contact.");
        return;
      }

      toast.success(editingContactId ? "Contact updated." : "Contact added.");
      closeForm();
      await loadContacts();
    } catch {
      setFormError("Failed to save contact.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/sellers/${encodeURIComponent(sellerId)}/contacts/${encodeURIComponent(deleteTarget.id)}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { message?: string } | null;
        toast.error(result?.message ?? "Failed to delete contact.");
        return;
      }

      toast.success("Contact deleted.");
      setDeleteTarget(null);
      await loadContacts();
    } catch {
      toast.error("Failed to delete contact.");
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<SellerContact>[] = [
    {
      key: "displayId",
      label: "ID",
      sortValue: (row) => row.displayId,
      render: (row) => (
        <button
          type="button"
          onClick={() => openEdit(row)}
          className="group inline-flex"
          aria-label={`Edit contact ${row.displayId}`}
        >
          <IdBadge id={row.displayId} interactive />
        </button>
      ),
    },
    {
      key: "name",
      label: "Name",
      render: (row) => <span className="font-medium text-slate-800 dark:text-slate-100">{row.name}</span>,
    },
    {
      key: "email",
      label: "Email",
      render: (row) => (
        <span className="text-xs text-slate-700 dark:text-slate-200">{row.email || "—"}</span>
      ),
    },
    {
      key: "phone",
      label: "Phone",
      render: (row) => (
        <span className="text-xs text-slate-700 dark:text-slate-200">{row.phone || "—"}</span>
      ),
    },
    {
      key: "website",
      label: "Website",
      render: (row) => (
        <span className="text-xs text-slate-700 dark:text-slate-200">{row.website || "—"}</span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <TableActionButton onClick={() => openEdit(row)}>Edit</TableActionButton>
          <TableActionButton variant="danger" onClick={() => setDeleteTarget(row)}>
            Delete
          </TableActionButton>
        </div>
      ),
    },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Contacts</h3>
        <AddNewButton type="button" onClick={openCreate}>
          Add Contact
        </AddNewButton>
      </div>

      <div className="px-6 py-6">
        {isLoading ? (
          <SectionLoading message="Loading contacts..." />
        ) : (
          <DataTable<SellerContact>
            columns={columns}
            rows={contacts}
            emptyMessage="No contacts yet. Click “Add Contact” to create one."
          />
        )}
      </div>

      <Modal
        open={isFormOpen}
        title={editingContactId ? "Edit Contact" : "Add Contact"}
        onClose={closeForm}
        panelClassName="max-w-2xl"
        actions={
          <>
            <CancelButton type="button" onClick={closeForm} />
            <PrimaryButton
              type="button"
              disabled={isSaving}
              onClick={() => void handleSave()}
              className="bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              {isSaving ? "Saving..." : "Save Contact"}
            </PrimaryButton>
          </>
        }
      >
        <div className="space-y-4">
          <FormError error={formError} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="contact-name" label="Name" required />
              <FormError error={fieldErrors.name} />
              <Input
                id="contact-name"
                value={form.name}
                invalid={Boolean(fieldErrors.name)}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Contact name"
              />
            </div>
            <div>
              <FieldLabel htmlFor="contact-email" label="Email" />
              <Input
                id="contact-email"
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                placeholder="name@example.com"
              />
            </div>
            <div>
              <FieldLabel htmlFor="contact-phone" label="Phone" />
              <Input
                id="contact-phone"
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                placeholder="Phone number"
              />
            </div>
            <div>
              <FieldLabel htmlFor="contact-website" label="Website" />
              <Input
                id="contact-website"
                value={form.website}
                onChange={(event) => updateField("website", event.target.value)}
                placeholder="https://example.com"
              />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Contact channels</span>
              <SecondaryButton type="button" icon={Plus} onClick={addChannel}>
                Add channel
              </SecondaryButton>
            </div>

            {form.channels.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No channels added. Click “Add channel” to include Telegram, LinkedIn, and more.
              </p>
            ) : (
              <div className="space-y-3">
                {form.channels.map((channel, index) => (
                  <div key={index} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <ChannelIcon type={channel.type} />
                    <div className="sm:w-44">
                      <Select
                        aria-label={`Channel ${index + 1} type`}
                        value={channel.type}
                        onChange={(event) => {
                          updateChannel(index, { type: event.target.value as ContactChannelType });
                          if (formError) setFormError("");
                        }}
                      >
                        {CONTACT_CHANNEL_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <Input
                      aria-label={`Channel ${index + 1} value`}
                      value={channel.value}
                      invalid={showEmptyChannelError && !channel.value.trim()}
                      onChange={(event) => updateChannel(index, { value: event.target.value })}
                      placeholder="Contact info / handle / link"
                      className="flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => removeChannel(index)}
                      aria-label={`Remove channel ${index + 1}`}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-300 text-slate-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-slate-600 dark:text-slate-300 dark:hover:border-red-500/50 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        title="Delete Contact"
        description={
          deleteTarget
            ? `Permanently delete contact "${deleteTarget.name}"? This cannot be undone.`
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
