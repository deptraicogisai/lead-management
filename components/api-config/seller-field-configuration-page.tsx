"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { FieldLabel, FormError, Input, PrimaryButton } from "@/components/ui/form-controls";
import { Modal } from "@/components/ui/modal";
import { PageSection } from "@/components/ui/state";
import { cn } from "@/lib/utils";
import { formatVerticalFieldTypeLabel, type VerticalFieldOption } from "@/lib/vertical-field";

const inlineInputClass =
  "min-w-[9rem] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25";

const inlineSelectClass =
  "min-w-[7rem] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25";

const dataTypeOptions = [
  { value: "string", label: "String" },
  { value: "number", label: "Number" },
  { value: "numberic", label: "Numberic" },
  { value: "boolean", label: "Boolean" },
  { value: "email", label: "Email" },
  { value: "date", label: "Date" },
];

const dataTypeFilterOptions = ["", "Text", "Range", "Checkbox"];

type ApiField = {
  id: string;
  fieldName: string;
  description: string;
  type: string;
  required: boolean;
  format?: string;
  displayArrayMapping: boolean;
  dataTypeFilter?: string | null;
  options: VerticalFieldOption[];
  emailDuplicateRule?: {
    mode: "days" | "forever";
    days?: number;
  };
  ignoreValues?: string[];
  isCustom: boolean;
  sourceVerticalFieldId?: string;
};

type NewFieldDraft = {
  fieldName: string;
  description: string;
  type: string;
  required: boolean;
  format: string;
  displayArrayMapping: boolean;
  dataTypeFilter: string;
  emailDuplicateMode: "days" | "forever";
  emailDuplicateDays: string;
  ignoreValues: string[];
};

const defaultNewFieldDraft: NewFieldDraft = {
  fieldName: "",
  description: "",
  type: "string",
  required: false,
  format: "",
  displayArrayMapping: false,
  dataTypeFilter: "",
  emailDuplicateMode: "days",
  emailDuplicateDays: "30",
  ignoreValues: [],
};

function normalizeApiField(field: ApiField): ApiField {
  return {
    ...field,
    format: field.format ?? "",
    displayArrayMapping: Boolean(field.displayArrayMapping),
    dataTypeFilter: field.dataTypeFilter ?? null,
    options: Array.isArray(field.options) ? field.options.map((option) => ({ ...option })) : [],
    ignoreValues: [...(field.ignoreValues ?? [])],
    emailDuplicateRule: field.emailDuplicateRule ? { ...field.emailDuplicateRule } : undefined,
  };
}

function cloneField(field: ApiField): ApiField {
  return normalizeApiField(field);
}

function buildFieldPayload(field: ApiField) {
  const isEmailType = field.type.trim().toLowerCase() === "email";

  return {
    fieldName: field.fieldName.trim(),
    description: field.description.trim(),
    type: field.type.trim(),
    required: field.required,
    format: isEmailType ? "email" : (field.format ?? "").trim(),
    displayArrayMapping: field.displayArrayMapping,
    dataTypeFilter: field.dataTypeFilter?.trim() || null,
    options: field.options,
    emailDuplicateRule: isEmailType
      ? field.emailDuplicateRule ?? { mode: "days" as const, days: 30 }
      : undefined,
    ignoreValues: isEmailType ? [] : field.ignoreValues ?? [],
  };
}

export function SellerFieldConfigurationPage() {
  const params = useParams<{ sellerId: string; mappingId: string }>();
  const searchParams = useSearchParams();
  const sellerId = params?.sellerId ?? "";
  const mappingId = params?.mappingId ?? "";
  const sellerName = searchParams.get("sellerName");
  const verticalName = searchParams.get("verticalName");
  const apiName = searchParams.get("apiName");

  const [fields, setFields] = useState<ApiField[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ApiField | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [optionsModalFieldId, setOptionsModalFieldId] = useState<string | null>(null);
  const [optionsDraft, setOptionsDraft] = useState<VerticalFieldOption[]>([]);
  const [optionsError, setOptionsError] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<NewFieldDraft>(defaultNewFieldDraft);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [isCreatingField, setIsCreatingField] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<
    { mode: "single"; field: ApiField } | { mode: "bulk"; ids: string[] } | null
  >(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchFields = async () => {
    if (!sellerId || !mappingId) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/sellers/${encodeURIComponent(sellerId)}/verticals/mappings/${encodeURIComponent(mappingId)}/field-configuration`
      );
      const result = (await response.json().catch(() => null)) as ApiField[] | { message?: string } | null;
      if (!response.ok) {
        setActionError((result as { message?: string } | null)?.message ?? "Failed to load field configuration.");
        setFields([]);
        return;
      }
      const data = (result as ApiField[]) ?? [];
      setActionError("");
      setFields(data.map((field) => normalizeApiField(field)));
      setSelectedFieldIds((current) => current.filter((id) => data.some((field) => field.id === id)));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchFields();
  }, [sellerId, mappingId]);

  const rows = sellerId && mappingId ? fields : [];
  const optionsModalField =
    (editingFieldId === optionsModalFieldId && editDraft) ||
    fields.find((field) => field.id === optionsModalFieldId) ||
    null;

  const clearActionFeedback = () => {
    setActionMessage("");
    setActionError("");
  };

  const saveField = async (field: ApiField): Promise<{ ok: true; data: ApiField } | { ok: false; message: string }> => {
    if (!sellerId || !mappingId) return { ok: false, message: "Seller or API is missing." };

    if (!field.fieldName.trim() || !field.description.trim()) {
      return { ok: false, message: "Field Name and Description are required." };
    }

    const isEmailType = field.type.trim().toLowerCase() === "email";
    if (isEmailType && field.emailDuplicateRule?.mode === "days") {
      const days = Number(field.emailDuplicateRule.days);
      if (!Number.isInteger(days) || days <= 0) {
        return { ok: false, message: "Please enter a valid number of days for the email duplicate rule." };
      }
    }

    try {
      const response = await fetch(
        `/api/sellers/${encodeURIComponent(sellerId)}/verticals/mappings/${encodeURIComponent(mappingId)}/field-configuration/${encodeURIComponent(field.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildFieldPayload(field)),
        }
      );

      const result = (await response.json().catch(() => null)) as ApiField | { message?: string } | null;

      if (!response.ok) {
        return { ok: false, message: (result as { message?: string } | null)?.message ?? "Failed to save field." };
      }

      const updatedField = normalizeApiField(result as ApiField);
      setFields((current) => current.map((item) => (item.id === field.id ? updatedField : item)));
      return { ok: true, data: updatedField };
    } catch {
      return { ok: false, message: "Failed to save field." };
    }
  };

  const startEdit = (field: ApiField) => {
    clearActionFeedback();
    setEditingFieldId(field.id);
    setEditDraft(cloneField(field));
  };

  const cancelEdit = () => {
    setEditingFieldId(null);
    setEditDraft(null);
    setIsSavingEdit(false);
  };

  const updateEditDraft = (patch: Partial<ApiField>) => {
    setEditDraft((current) => {
      if (!current) return current;

      const next = { ...current, ...patch };

      if (patch.type) {
        const isEmailType = patch.type.trim().toLowerCase() === "email";
        if (isEmailType) {
          next.format = "email";
          next.ignoreValues = [];
          next.emailDuplicateRule = next.emailDuplicateRule ?? { mode: "days", days: 30 };
        } else {
          next.format = next.format === "email" ? "" : next.format;
          next.emailDuplicateRule = undefined;
        }
      }

      return next;
    });
  };

  const openCreateModal = () => {
    clearActionFeedback();
    cancelEdit();
    setCreateDraft(defaultNewFieldDraft);
    setCreateErrors({});
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    setCreateDraft(defaultNewFieldDraft);
    setCreateErrors({});
    setIsCreatingField(false);
  };

  const updateCreateDraft = (patch: Partial<NewFieldDraft>) => {
    setCreateDraft((current) => {
      const next = { ...current, ...patch };
      if (patch.type) {
        const isEmailType = patch.type.trim().toLowerCase() === "email";
        if (isEmailType) {
          next.format = "email";
          next.ignoreValues = [];
        } else if (current.type.trim().toLowerCase() === "email") {
          next.format = "";
        }
      }
      return next;
    });
  };

  const validateCreateDraft = () => {
    const nextErrors: Record<string, string> = {};

    if (!createDraft.fieldName.trim()) nextErrors.fieldName = "Field Name is required.";
    if (!createDraft.description.trim()) nextErrors.description = "Description is required.";

    if (createDraft.type.trim().toLowerCase() === "email" && createDraft.emailDuplicateMode === "days") {
      const days = Number(createDraft.emailDuplicateDays);
      if (!Number.isInteger(days) || days <= 0) {
        nextErrors.emailDuplicateDays = "Please enter a valid number of days.";
      }
    }

    setCreateErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleCreateField = async () => {
    if (!sellerId || !mappingId || !validateCreateDraft()) return;

    setIsCreatingField(true);
    clearActionFeedback();

    const isEmailType = createDraft.type.trim().toLowerCase() === "email";
    const payload = {
      fieldName: createDraft.fieldName.trim(),
      description: createDraft.description.trim(),
      type: createDraft.type.trim(),
      required: createDraft.required,
      format: isEmailType ? "email" : createDraft.format.trim(),
      emailDuplicateRule: isEmailType
        ? {
            mode: createDraft.emailDuplicateMode,
            ...(createDraft.emailDuplicateMode === "days" ? { days: Number(createDraft.emailDuplicateDays) } : {}),
          }
        : undefined,
      displayArrayMapping: createDraft.displayArrayMapping,
      dataTypeFilter: createDraft.dataTypeFilter.trim() || null,
      options: [],
      ignoreValues: isEmailType ? [] : createDraft.ignoreValues,
    };

    try {
      const response = await fetch(
        `/api/sellers/${encodeURIComponent(sellerId)}/verticals/mappings/${encodeURIComponent(mappingId)}/field-configuration`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const result = (await response.json().catch(() => null)) as ApiField | { message?: string } | null;

      if (!response.ok) {
        setCreateErrors({
          form: (result as { message?: string } | null)?.message ?? "Failed to create field.",
        });
        return;
      }

      const createdField = normalizeApiField(result as ApiField);
      setFields((current) => [...current, createdField]);
      setActionMessage(`Field "${createdField.fieldName}" created successfully.`);
      closeCreateModal();
    } catch {
      setCreateErrors({ form: "Failed to create field." });
    } finally {
      setIsCreatingField(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editDraft) return;

    setIsSavingEdit(true);
    clearActionFeedback();

    const result = await saveField(editDraft);
    setIsSavingEdit(false);

    if (result.ok) {
      setActionMessage(`Field "${result.data.fieldName}" saved successfully.`);
      cancelEdit();
    } else {
      setActionError(result.message);
    }
  };

  const handleToggleRow = (rowId: string) => {
    setSelectedFieldIds((current) =>
      current.includes(rowId) ? current.filter((id) => id !== rowId) : [...current, rowId]
    );
  };

  const handleToggleAllRows = (checked: boolean) => {
    setSelectedFieldIds(checked ? rows.map((row) => row.id) : []);
  };

  const openDeleteConfirm = (field: ApiField) => {
    clearActionFeedback();
    setDeleteConfirm({ mode: "single", field });
  };

  const openBulkDeleteConfirm = () => {
    if (selectedFieldIds.length === 0) return;
    clearActionFeedback();
    setDeleteConfirm({ mode: "bulk", ids: [...selectedFieldIds] });
  };

  const closeDeleteConfirm = () => {
    if (isDeleting) return;
    setDeleteConfirm(null);
  };

  const deleteFieldsByIds = async (idsToDelete: string[]) => {
    if (!sellerId || !mappingId || idsToDelete.length === 0) return { deletedCount: 0, failed: false };

    let deletedCount = 0;
    let failed = false;

    for (const id of idsToDelete) {
      const response = await fetch(
        `/api/sellers/${encodeURIComponent(sellerId)}/verticals/mappings/${encodeURIComponent(mappingId)}/field-configuration/${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        failed = true;
        continue;
      }

      deletedCount += 1;
    }

    setFields((current) => current.filter((item) => !idsToDelete.includes(item.id)));
    setSelectedFieldIds((current) => current.filter((id) => !idsToDelete.includes(id)));

    if (editingFieldId && idsToDelete.includes(editingFieldId)) {
      cancelEdit();
    }

    return { deletedCount, failed };
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;

    setIsDeleting(true);
    clearActionFeedback();

    const idsToDelete = deleteConfirm.mode === "single" ? [deleteConfirm.field.id] : deleteConfirm.ids;
    const { deletedCount, failed } = await deleteFieldsByIds(idsToDelete);

    if (deleteConfirm.mode === "single") {
      if (failed) {
        setActionError(`Failed to delete field "${deleteConfirm.field.fieldName}".`);
      } else {
        setActionMessage(`Field "${deleteConfirm.field.fieldName}" deleted successfully.`);
      }
    } else if (failed) {
      setActionError(`Deleted ${deletedCount} field(s), but some deletions failed.`);
    } else {
      setActionMessage(`Deleted ${deletedCount} field(s).`);
    }

    setIsDeleting(false);
    setDeleteConfirm(null);
  };

  const openOptionsModal = (field: ApiField) => {
    const source = editingFieldId === field.id && editDraft ? editDraft : field;
    setOptionsModalFieldId(field.id);
    setOptionsDraft(source.options.map((option) => ({ ...option })));
    setOptionsError("");
  };

  const closeOptionsModal = () => {
    setOptionsModalFieldId(null);
    setOptionsDraft([]);
    setOptionsError("");
  };

  const updateOptionDraft = (index: number, key: keyof VerticalFieldOption, value: string) => {
    setOptionsDraft((current) =>
      current.map((option, optionIndex) => (optionIndex === index ? { ...option, [key]: value } : option))
    );
  };

  const addOptionDraft = () => {
    setOptionsDraft((current) => [...current, { label: "", value: "" }]);
  };

  const removeOptionDraft = (index: number) => {
    setOptionsDraft((current) => current.filter((_, optionIndex) => optionIndex !== index));
  };

  const handleSaveOptions = () => {
    if (!optionsModalField) return;

    const normalizedOptions = optionsDraft
      .map((option) => ({
        label: option.label.trim(),
        value: option.value.trim(),
      }))
      .filter((option) => option.label || option.value);

    for (const option of normalizedOptions) {
      if (!option.label) {
        setOptionsError("Each option must have a label.");
        return;
      }
    }

    const nextOptions = normalizedOptions.map((option) => ({
      label: option.label,
      value: option.value || option.label,
    }));

    if (editingFieldId === optionsModalField.id && editDraft) {
      setEditDraft({ ...editDraft, options: nextOptions });
      closeOptionsModal();
      return;
    }

    void (async () => {
      setOptionsError("");
      clearActionFeedback();

      const result = await saveField({ ...optionsModalField, options: nextOptions });

      if (result.ok) {
        setActionMessage(`Options for "${result.data.fieldName}" saved successfully.`);
        closeOptionsModal();
      } else {
        setOptionsError(result.message);
      }
    })();
  };

  const renderFieldCell = (row: ApiField, view: ReactNode, edit: ReactNode) =>
    editingFieldId === row.id ? edit : view;

  const columns: Column<ApiField>[] = [
    {
      key: "fieldName",
      label: "Field Name",
      render: (row) =>
        renderFieldCell(
          row,
          <span className="font-medium text-slate-800 dark:text-slate-100">{row.fieldName}</span>,
          <Input
            value={editDraft?.fieldName ?? ""}
            onChange={(event) => updateEditDraft({ fieldName: event.target.value })}
            className={inlineInputClass}
          />
        ),
    },
    {
      key: "description",
      label: "Description",
      render: (row) =>
        renderFieldCell(
          row,
          <span className="text-slate-700 dark:text-slate-200">{row.description}</span>,
          <Input
            value={editDraft?.description ?? ""}
            onChange={(event) => updateEditDraft({ description: event.target.value })}
            className={cn(inlineInputClass, "min-w-[12rem]")}
          />
        ),
    },
    {
      key: "isCustom",
      label: "Source",
      render: (row) => (
        <span
          className={
            row.isCustom
              ? "rounded-full bg-violet-100 px-2 py-1 text-xs font-medium text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
              : "rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
          }
        >
          {row.isCustom ? "Custom" : "Copied from Vertical"}
        </span>
      ),
    },
    {
      key: "type",
      label: "Data Type",
      render: (row) =>
        renderFieldCell(
          row,
          <span className="text-slate-700 dark:text-slate-200">{formatVerticalFieldTypeLabel(row.type)}</span>,
          <select
            value={(editDraft?.type ?? row.type).toLowerCase()}
            onChange={(event) => updateEditDraft({ type: event.target.value })}
            className={inlineSelectClass}
          >
            {dataTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ),
    },
    {
      key: "required",
      label: "Required",
      render: (row) =>
        renderFieldCell(
          row,
          <span
            className={
              row.required
                ? "rounded-full bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                : "rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            }
          >
            {row.required ? "Yes" : "No"}
          </span>,
          <select
            value={editDraft?.required ? "yes" : "no"}
            onChange={(event) => updateEditDraft({ required: event.target.value === "yes" })}
            className={inlineSelectClass}
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        ),
    },
    {
      key: "displayArrayMapping",
      label: "Display Array Mapping",
      render: (row) =>
        renderFieldCell(
          row,
          <span
            className={
              row.displayArrayMapping
                ? "rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            }
          >
            {row.displayArrayMapping ? "Yes" : "No"}
          </span>,
          <select
            value={editDraft?.displayArrayMapping ? "yes" : "no"}
            onChange={(event) => updateEditDraft({ displayArrayMapping: event.target.value === "yes" })}
            className={inlineSelectClass}
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        ),
    },
    {
      key: "dataTypeFilter",
      label: "Data Type Filter",
      render: (row) =>
        renderFieldCell(
          row,
          <span className="text-slate-700 dark:text-slate-200">{row.dataTypeFilter ?? "-"}</span>,
          <select
            value={editDraft?.dataTypeFilter ?? ""}
            onChange={(event) => updateEditDraft({ dataTypeFilter: event.target.value || null })}
            className={inlineSelectClass}
          >
            {dataTypeFilterOptions.map((option) => (
              <option key={option || "none"} value={option}>
                {option || "-"}
              </option>
            ))}
          </select>
        ),
    },
    {
      key: "options",
      label: "Options",
      render: (row) => {
        const optionCount = editingFieldId === row.id && editDraft ? editDraft.options.length : row.options.length;

        return (
          <button
            type="button"
            onClick={() => openOptionsModal(row)}
            className="text-left text-sm font-medium text-blue-600 underline-offset-2 transition hover:underline dark:text-blue-300"
          >
            {optionCount > 0 ? `${optionCount} option(s)` : "View options"}
          </button>
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) =>
        editingFieldId === row.id ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isSavingEdit}
              onClick={() => void handleSaveEdit()}
              className="rounded-lg border border-emerald-700 bg-emerald-800 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60 dark:border-emerald-500 dark:bg-emerald-600"
            >
              {isSavingEdit ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              disabled={isSavingEdit}
              onClick={cancelEdit}
              className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={Boolean(editingFieldId && editingFieldId !== row.id)}
              onClick={() => startEdit(row)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              <Pencil size={13} />
              <span>Edit</span>
            </button>
            <button
              type="button"
              disabled={Boolean(editingFieldId)}
              onClick={() => openDeleteConfirm(row)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200 dark:hover:bg-red-500/20"
            >
              <Trash2 size={13} />
              <span>Delete</span>
            </button>
          </div>
        ),
    },
  ];

  const isCreateEmailType = createDraft.type.trim().toLowerCase() === "email";

  return (
    <div className="space-y-6">
      {sellerId && mappingId ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
          Managing field configuration for API{" "}
          <span className="font-semibold">{apiName ?? "selected API"}</span> (
          <span className="font-semibold">{sellerName ?? "selected seller"}</span> /{" "}
          <span className="font-semibold">{verticalName ?? "selected vertical"}</span>). Fields are copied from the vertical field list on
          first open and can be edited independently without changing the original vertical definition.
        </div>
      ) : null}

      <PageSection
        title="Field Configuration List"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <PrimaryButton
              type="button"
              disabled={!sellerId || !mappingId || Boolean(editingFieldId)}
              onClick={openCreateModal}
            >
              <Plus size={15} />
              <span>Add Field</span>
            </PrimaryButton>
            <Link
              href={`/api-config?sellerId=${encodeURIComponent(sellerId)}&sellerName=${encodeURIComponent(sellerName ?? "")}`}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              Back to API Configuration
            </Link>
          </div>
        }
      >
        <div className="mb-4 space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Click <span className="font-medium">Add Field</span> to create a new field, or{" "}
            <span className="font-medium">Edit</span> on a row to update it directly in the grid. Use checkboxes to select fields and delete
            them in bulk. Click Options to view or edit option values.
          </p>

          {selectedFieldIds.length > 0 ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/70">
              <span className="text-sm text-slate-700 dark:text-slate-200">{selectedFieldIds.length} field(s) selected</span>
              <button
                type="button"
                disabled={isDeleting}
                onClick={openBulkDeleteConfirm}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200 dark:hover:bg-red-500/20"
              >
                <Trash2 size={14} />
                <span>Delete selected</span>
              </button>
            </div>
          ) : null}

          <FormError error={actionError} />
          {actionMessage ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{actionMessage}</p> : null}
        </div>

        <DataTable<ApiField>
          columns={columns}
          rows={rows}
          emptyMessage={
            isLoading
              ? "Loading fields..."
              : "No field configuration yet. Fields will be copied from the vertical when available."
          }
          selectedRowIds={selectedFieldIds}
          onToggleRow={handleToggleRow}
          onToggleAllRows={handleToggleAllRows}
        />
      </PageSection>

      <Modal
        open={Boolean(optionsModalField)}
        title={optionsModalField ? `Options — ${optionsModalField.fieldName}` : "Options"}
        description={
          editingFieldId === optionsModalFieldId
            ? "Changes will apply to the current edit. Click Save on the row to persist them."
            : "Edit option labels and values for this field."
        }
        onClose={closeOptionsModal}
        panelClassName="max-w-2xl"
        actions={
          <>
            <button
              type="button"
              onClick={closeOptionsModal}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <PrimaryButton type="button" onClick={handleSaveOptions}>
              {editingFieldId === optionsModalFieldId ? "Apply options" : "Save options"}
            </PrimaryButton>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Label</p>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Value</p>
          </div>

          {optionsDraft.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
              No options yet. Click Add option to create one.
            </div>
          ) : (
            optionsDraft.map((option, index) => (
              <div key={`option-${index}`} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_40px]">
                <Input
                  value={option.label}
                  onChange={(event) => updateOptionDraft(index, "label", event.target.value)}
                  placeholder="Any time"
                />
                <Input
                  value={option.value}
                  onChange={(event) => updateOptionDraft(index, "value", event.target.value)}
                  placeholder="ANY_TIME"
                />
                <button
                  type="button"
                  onClick={() => removeOptionDraft(index)}
                  className="flex h-11 items-center justify-center rounded-xl border border-red-200 text-red-500 transition hover:bg-red-50 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200 dark:hover:bg-red-500/20"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}

          <button
            type="button"
            onClick={addOptionDraft}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-700 bg-emerald-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            <Plus size={15} />
            <span>Add option</span>
          </button>

          <FormError error={optionsError} />
        </div>
      </Modal>

      <Modal
        open={isCreateModalOpen}
        title="Add New Field"
        description="Create a new custom field for this seller API mapping."
        onClose={closeCreateModal}
        panelClassName="max-w-2xl"
        actions={
          <>
            <button
              type="button"
              disabled={isCreatingField}
              onClick={closeCreateModal}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <PrimaryButton
              type="button"
              disabled={isCreatingField}
              onClick={() => void handleCreateField()}
              className="bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              {isCreatingField ? "Creating..." : "Create Field"}
            </PrimaryButton>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <FieldLabel htmlFor="create-mapping-field-name" label="Field Name" />
            <Input
              id="create-mapping-field-name"
              value={createDraft.fieldName}
              onChange={(event) => updateCreateDraft({ fieldName: event.target.value })}
              placeholder="phone_number"
            />
            <FormError error={createErrors.fieldName} />
          </div>

          <div>
            <FieldLabel htmlFor="create-mapping-description" label="Description" />
            <Input
              id="create-mapping-description"
              value={createDraft.description}
              onChange={(event) => updateCreateDraft({ description: event.target.value })}
              placeholder="Phone Number"
            />
            <FormError error={createErrors.description} />
          </div>

          <div>
            <FieldLabel htmlFor="create-mapping-data-type" label="Data Type" />
            <select
              id="create-mapping-data-type"
              value={createDraft.type.toLowerCase()}
              onChange={(event) => updateCreateDraft({ type: event.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25"
            >
              {dataTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel htmlFor="create-mapping-required" label="Required" />
            <select
              id="create-mapping-required"
              value={createDraft.required ? "yes" : "no"}
              onChange={(event) => updateCreateDraft({ required: event.target.value === "yes" })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25"
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>

          <div>
            <FieldLabel htmlFor="create-mapping-display-array" label="Display Array Mapping" />
            <select
              id="create-mapping-display-array"
              value={createDraft.displayArrayMapping ? "yes" : "no"}
              onChange={(event) => updateCreateDraft({ displayArrayMapping: event.target.value === "yes" })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25"
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>

          <div>
            <FieldLabel htmlFor="create-mapping-data-type-filter" label="Data Type Filter" />
            <select
              id="create-mapping-data-type-filter"
              value={createDraft.dataTypeFilter}
              onChange={(event) => updateCreateDraft({ dataTypeFilter: event.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25"
            >
              {dataTypeFilterOptions.map((option) => (
                <option key={option || "none"} value={option}>
                  {option || "-"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel htmlFor="create-mapping-format" label="Format" />
            <Input
              id="create-mapping-format"
              value={isCreateEmailType ? "email" : createDraft.format}
              onChange={(event) => updateCreateDraft({ format: event.target.value })}
              disabled={isCreateEmailType}
              placeholder="email / E.164 / ISO-8601"
            />
          </div>

          {isCreateEmailType ? (
            <>
              <div>
                <FieldLabel htmlFor="create-mapping-email-duplicate-mode" label="Email Duplicate Rule" />
                <select
                  id="create-mapping-email-duplicate-mode"
                  value={createDraft.emailDuplicateMode}
                  onChange={(event) =>
                    updateCreateDraft({ emailDuplicateMode: event.target.value as "days" | "forever" })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25"
                >
                  <option value="days">Unique within days</option>
                  <option value="forever">Unique forever</option>
                </select>
              </div>

              {createDraft.emailDuplicateMode === "days" ? (
                <div>
                  <FieldLabel htmlFor="create-mapping-email-duplicate-days" label="Duplicate Window (days)" />
                  <Input
                    id="create-mapping-email-duplicate-days"
                    type="number"
                    min={1}
                    value={createDraft.emailDuplicateDays}
                    onChange={(event) => updateCreateDraft({ emailDuplicateDays: event.target.value })}
                    placeholder="30"
                  />
                  <FormError error={createErrors.emailDuplicateDays} />
                </div>
              ) : null}
            </>
          ) : (
            <div className="md:col-span-2">
              <FieldLabel htmlFor="create-mapping-ignore-values" label="Ignore Values" />
              <div className="rounded-2xl border border-slate-300 bg-white p-3 dark:border-slate-600 dark:bg-slate-900">
                {createDraft.ignoreValues.length > 0 ? (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {createDraft.ignoreValues.map((value) => (
                      <span
                        key={value}
                        className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        {value}
                        <button
                          type="button"
                          onClick={() =>
                            updateCreateDraft({
                              ignoreValues: createDraft.ignoreValues.filter((item) => item !== value),
                            })
                          }
                          className="text-slate-500 transition hover:text-slate-800 dark:text-slate-300 dark:hover:text-white"
                        >
                          x
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ignore values can be configured after creating the field.
                </p>
              </div>
            </div>
          )}
        </div>

        <FormError error={createErrors.form} />
      </Modal>

      <Modal
        open={deleteConfirm !== null}
        title={deleteConfirm?.mode === "bulk" ? "Delete Selected Fields" : "Delete Field"}
        description={
          deleteConfirm?.mode === "single"
            ? `Delete field "${deleteConfirm.field.fieldName}" (${deleteConfirm.field.description})? This action cannot be undone.`
            : deleteConfirm?.mode === "bulk"
              ? `Delete ${deleteConfirm.ids.length} selected field(s)? This action cannot be undone.`
              : undefined
        }
        onClose={closeDeleteConfirm}
        actions={
          <>
            <button
              type="button"
              disabled={isDeleting}
              onClick={closeDeleteConfirm}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => void handleConfirmDelete()}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 dark:bg-red-500 dark:text-white dark:hover:bg-red-400"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </>
        }
      />
    </div>
  );
}
