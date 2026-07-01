"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pencil, Plus, Trash2, Upload } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { FieldLabel, FormError, Input, PrimaryButton } from "@/components/ui/form-controls";
import { ListTableContainer } from "@/components/ui/list-table-container";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageSection } from "@/components/ui/state";
import type { ApiFieldConfig } from "@/lib/mock-data";
import { reorderItemsByIds } from "@/lib/reorder-fields";
import { toast } from "@/lib/toast";
import { useListLoadState } from "@/lib/use-list-load-state";
import { cn } from "@/lib/utils";
import { formatVerticalFieldTypeLabel, type VerticalFieldOption } from "@/lib/vertical-field";

const inlineInputClass =
  "min-w-[9rem] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25";

const inlineSelectClass =
  "min-w-[7rem] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25";

const dataTypeOptions = [
  { value: "string", label: "String" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "email", label: "Email" },
  { value: "date", label: "Date" },
];

const dataTypeFilterOptions = ["", "Text", "Range", "Checkbox", "Multi Select"];

type NewFieldDraft = {
  fieldName: string;
  description: string;
  type: string;
  required: boolean;
  displayArrayMapping: boolean;
  dataTypeFilter: string;
  emailDuplicateMode: "days" | "forever";
  emailDuplicateDays: string;
};

const defaultNewFieldDraft: NewFieldDraft = {
  fieldName: "",
  description: "",
  type: "string",
  required: false,
  displayArrayMapping: false,
  dataTypeFilter: "",
  emailDuplicateMode: "days",
  emailDuplicateDays: "30",
};

function buildFieldPayload(field: ApiFieldConfig) {
  return {
    fieldName: field.fieldName.trim(),
    description: field.description.trim(),
    type: field.type.trim() || "string",
    required: field.required,
    format: field.format,
    displayArrayMapping: field.displayArrayMapping,
    dataTypeFilter: field.dataTypeFilter ?? null,
    options: field.options,
    ignoreValues: field.ignoreValues ?? [],
    emailDuplicateRule: field.emailDuplicateRule,
  };
}

function cloneField(field: ApiFieldConfig): ApiFieldConfig {
  return {
    ...field,
    options: field.options.map((option) => ({ ...option })),
  };
}

export default function IndustryFieldsPage() {
  const searchParams = useSearchParams();
  const verticalId = searchParams.get("verticalId");
  const verticalName = searchParams.get("verticalName");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fields, setFields] = useState<ApiFieldConfig[]>([]);
  const { isInitialLoad, isRefreshing, beginLoad, endLoad } = useListLoadState();
  const isTableLoading = isInitialLoad || isRefreshing;
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [actionError, setActionError] = useState("");
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ApiFieldConfig | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [optionsModalFieldId, setOptionsModalFieldId] = useState<string | null>(null);
  const [optionsDraft, setOptionsDraft] = useState<VerticalFieldOption[]>([]);
  const [optionsError, setOptionsError] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<NewFieldDraft>(defaultNewFieldDraft);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [isCreatingField, setIsCreatingField] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<
    { mode: "single"; field: ApiFieldConfig } | { mode: "bulk"; ids: string[] } | null
  >(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [isOrderDirty, setIsOrderDirty] = useState(false);

  const fetchFields = async () => {
    if (!verticalId) return;

    beginLoad();
    try {
      const response = await fetch(`/api/industries/${encodeURIComponent(verticalId)}/fields`);
      if (!response.ok) return;
      const data = (await response.json()) as ApiFieldConfig[];
      setFields(data);
      setIsOrderDirty(false);
      setSelectedFieldIds((current) => current.filter((id) => data.some((field) => field.id === id)));
    } finally {
      endLoad();
    }
  };

  useEffect(() => {
    void fetchFields();
  }, [verticalId]);

  const rows = verticalId ? fields : [];
  const optionsModalField =
    (editingFieldId === optionsModalFieldId && editDraft) ||
    fields.find((field) => field.id === optionsModalFieldId) ||
    null;

  const clearActionFeedback = () => {
    setActionError("");
  };

  const saveField = async (field: ApiFieldConfig): Promise<{ ok: true; data: ApiFieldConfig } | { ok: false; message: string }> => {
    if (!verticalId) return { ok: false, message: "Vertical is missing." };

    if (!field.fieldName.trim() || !field.description.trim()) {
      return { ok: false, message: "Field Name and Description are required." };
    }

    try {
      const response = await fetch(
        `/api/industries/${encodeURIComponent(verticalId)}/fields/${encodeURIComponent(field.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildFieldPayload(field)),
        }
      );

      const result = (await response.json().catch(() => null)) as ApiFieldConfig | { message?: string } | null;

      if (!response.ok) {
        return { ok: false, message: (result as { message?: string } | null)?.message ?? "Failed to save field." };
      }

      const updatedField = result as ApiFieldConfig;
      setFields((current) => current.map((item) => (item.id === field.id ? updatedField : item)));
      return { ok: true, data: updatedField };
    } catch {
      return { ok: false, message: "Failed to save field." };
    }
  };

  const startEdit = (field: ApiFieldConfig) => {
    clearActionFeedback();
    setEditingFieldId(field.id);
    setEditDraft(cloneField(field));
  };

  const cancelEdit = () => {
    setEditingFieldId(null);
    setEditDraft(null);
    setIsSavingEdit(false);
  };

  const updateEditDraft = (patch: Partial<ApiFieldConfig>) => {
    setEditDraft((current) => (current ? { ...current, ...patch } : current));
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
    setCreateDraft((current) => ({ ...current, ...patch }));
  };

  const validateCreateDraft = () => {
    const nextErrors: Record<string, string> = {};

    if (!createDraft.fieldName.trim()) {
      nextErrors.fieldName = "Field Name is required.";
    }

    if (!createDraft.description.trim()) {
      nextErrors.description = "Description is required.";
    }

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
    if (!verticalId || !validateCreateDraft()) return;

    setIsCreatingField(true);
    clearActionFeedback();

    const isEmailType = createDraft.type.trim().toLowerCase() === "email";
    const payload = {
      fieldName: createDraft.fieldName.trim(),
      description: createDraft.description.trim(),
      type: createDraft.type.trim(),
      required: createDraft.required,
      displayArrayMapping: createDraft.displayArrayMapping,
      dataTypeFilter: createDraft.dataTypeFilter.trim() || null,
      options: [],
      ...(isEmailType
        ? {
            format: "email",
            emailDuplicateRule: {
              mode: createDraft.emailDuplicateMode,
              ...(createDraft.emailDuplicateMode === "days"
                ? { days: Number(createDraft.emailDuplicateDays) }
                : {}),
            },
          }
        : {}),
    };

    try {
      const response = await fetch(`/api/industries/${encodeURIComponent(verticalId)}/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => null)) as ApiFieldConfig | { message?: string } | null;

      if (!response.ok) {
        setCreateErrors({
          form: (result as { message?: string } | null)?.message ?? "Failed to create field.",
        });
        return;
      }

      const createdField = result as ApiFieldConfig;
      setFields((current) => [...current, createdField]);
      toast.success(`Field "${createdField.fieldName}" created successfully.`);
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
      toast.success(`Field "${result.data.fieldName}" saved successfully.`);
      cancelEdit();
    } else {
      setActionError(result.message);
    }
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !verticalId) return;

    clearActionFeedback();
    setImportError("");
    setIsImporting(true);
    cancelEdit();

    try {
      const text = await file.text();
      const payload = JSON.parse(text) as unknown;

      const response = await fetch(`/api/industries/${encodeURIComponent(verticalId)}/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      let result: { message?: string; count?: number } | null = null;

      try {
        result = JSON.parse(responseText) as { message?: string; count?: number };
      } catch {
        setImportError(
          response.ok
            ? "Import completed but the server returned an unexpected response."
            : "Import failed. Please restart the dev server and try again."
        );
        return;
      }

      if (!response.ok) {
        setImportError(result?.message ?? "Failed to import fields.");
        return;
      }

      toast.success(result?.message ?? `Imported ${result?.count ?? 0} field(s).`);
      setSelectedFieldIds([]);
      await fetchFields();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Invalid JSON file.");
    } finally {
      setIsImporting(false);
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

  const handleReorderFields = (orderedIds: string[]) => {
    if (!verticalId) return;

    const reordered = reorderItemsByIds(fields, orderedIds);
    if (!reordered) return;

    setFields(reordered);
    setIsOrderDirty(true);
    clearActionFeedback();
  };

  const saveFieldOrder = async () => {
    if (!verticalId || isSavingOrder || !isOrderDirty) return;

    const orderedIds = fields.map((field) => field.id);
    setIsSavingOrder(true);
    clearActionFeedback();

    try {
      const response = await fetch(`/api/industries/${encodeURIComponent(verticalId)}/fields/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldIds: orderedIds }),
      });
      const result = (await response.json().catch(() => null)) as ApiFieldConfig[] | { message?: string } | null;

      if (!response.ok) {
        setActionError((result as { message?: string } | null)?.message ?? "Failed to save field order.");
        return;
      }

      setFields((result as ApiFieldConfig[]) ?? fields);
      setIsOrderDirty(false);
      toast.success("Field order saved.");
    } catch {
      setActionError("Failed to save field order.");
    } finally {
      setIsSavingOrder(false);
    }
  };

  const openDeleteConfirm = (field: ApiFieldConfig) => {
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
    if (!verticalId || idsToDelete.length === 0) return { deletedCount: 0, failed: false };

    let deletedCount = 0;
    let failed = false;

    for (const id of idsToDelete) {
      const response = await fetch(
        `/api/industries/${encodeURIComponent(verticalId)}/fields/${encodeURIComponent(id)}`,
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
    if (!deleteConfirm || !verticalId) return;

    setIsDeleting(true);
    clearActionFeedback();

    const idsToDelete =
      deleteConfirm.mode === "single" ? [deleteConfirm.field.id] : deleteConfirm.ids;
    const { deletedCount, failed } = await deleteFieldsByIds(idsToDelete);

    if (deleteConfirm.mode === "single") {
      if (failed) {
        setActionError(`Failed to delete field "${deleteConfirm.field.fieldName}".`);
      } else {
        toast.success(`Field "${deleteConfirm.field.fieldName}" deleted successfully.`);
      }
    } else if (failed) {
      setActionError(`Deleted ${deletedCount} field(s), but some deletions failed.`);
    } else {
      toast.success(`Deleted ${deletedCount} field(s).`);
    }

    setIsDeleting(false);
    setDeleteConfirm(null);
  };

  const openOptionsModal = (field: ApiFieldConfig) => {
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
    setOptionsDraft((current) => current.map((option, optionIndex) => (optionIndex === index ? { ...option, [key]: value } : option)));
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
        toast.success(`Options for "${result.data.fieldName}" saved successfully.`);
        closeOptionsModal();
      } else {
        setOptionsError(result.message);
      }
    })();
  };

  const renderFieldCell = (
    row: ApiFieldConfig,
    view: ReactNode,
    edit: ReactNode
  ) => (editingFieldId === row.id ? edit : view);

  const columns: Column<ApiFieldConfig>[] = [
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
          <span className="text-slate-700 dark:text-slate-200">{row.required ? "Yes" : "No"}</span>,
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
          <span className="text-slate-700 dark:text-slate-200">{row.displayArrayMapping ? "Yes" : "No"}</span>,
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
        const optionCount =
          editingFieldId === row.id && editDraft ? editDraft.options.length : row.options.length;

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

  return (
    <div className="space-y-6">
      {verticalId ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
          Managing fields for vertical: <span className="font-semibold">{verticalName ?? verticalId}</span>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          Please open Fields Configuration from the Vertical page for a specific vertical.
        </div>
      )}

      <PageSection
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <PrimaryButton
              type="button"
              disabled={!verticalId || !isOrderDirty || isSavingOrder || Boolean(editingFieldId)}
              onClick={() => void saveFieldOrder()}
            >
              {isSavingOrder ? "Saving..." : "Save Order"}
            </PrimaryButton>
            <PrimaryButton
              type="button"
              disabled={!verticalId || Boolean(editingFieldId)}
              onClick={openCreateModal}
            >
              <Plus size={15} />
              <span>Add Field</span>
            </PrimaryButton>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => void handleImportFile(event)}
            />
            <PrimaryButton
              type="button"
              disabled={!verticalId || isImporting}
              onClick={() => fileInputRef.current?.click()}
              className="bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              <Upload size={15} />
              <span>{isImporting ? "Importing..." : "Upload JSON"}</span>
            </PrimaryButton>
            <Link
              href="/verticals"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              Back to Vertical List
            </Link>
          </div>
        }
      >
        <div className="mb-4 space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Click <span className="font-medium">Add Field</span> to create a new field, or{" "}
            <span className="font-medium">Edit</span> on a row to update it directly in the grid. Drag the handle on the left to
            reorder fields, then click <span className="font-medium">Save Order</span> to persist the new order. Use checkboxes to select fields and delete them in bulk. Click Options to view or edit option values.
            Upload JSON accepts a lead sample object: every key in the file becomes a field using the exact key name (for example{" "}
            <span className="font-mono text-xs">fname</span>, <span className="font-mono text-xs">apikey</span>).
          </p>

          {selectedFieldIds.length > 0 ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/70">
              <span className="text-sm text-slate-700 dark:text-slate-200">
                {selectedFieldIds.length} field(s) selected
              </span>
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

          <FormError error={importError} />
          <FormError error={actionError} />
        </div>

        <ListTableContainer
          isInitialLoad={Boolean(verticalId) && isInitialLoad}
          isRefreshing={isRefreshing}
          loadingMessage="Loading fields"
        >
          <DataTable<ApiFieldConfig>
            columns={columns}
            rows={rows}
            emptyMessage="No fields configured yet. Add a field or upload a JSON file to get started."
            selectedRowIds={selectedFieldIds}
            onToggleRow={handleToggleRow}
            onToggleAllRows={handleToggleAllRows}
            rowReorder={{
              onReorder: handleReorderFields,
              disabled: Boolean(editingFieldId) || isTableLoading,
            }}
          />
        </ListTableContainer>
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
        description="Create a new field for this vertical."
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
        <FormError error={createErrors.form} />
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <FieldLabel htmlFor="create-field-name" label="Field Name" />
            <FormError error={createErrors.fieldName} />
            <Input
              id="create-field-name"
              value={createDraft.fieldName}
              invalid={Boolean(createErrors.fieldName)}
              onChange={(event) => updateCreateDraft({ fieldName: event.target.value })}
              placeholder="first_name"
            />
          </div>

          <div>
            <FieldLabel htmlFor="create-description" label="Description" />
            <FormError error={createErrors.description} />
            <Input
              id="create-description"
              value={createDraft.description}
              invalid={Boolean(createErrors.description)}
              onChange={(event) => updateCreateDraft({ description: event.target.value })}
              placeholder="First Name"
            />
          </div>

          <div>
            <FieldLabel htmlFor="create-data-type" label="Data Type" />
            <select
              id="create-data-type"
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
            <FieldLabel htmlFor="create-required" label="Required" />
            <select
              id="create-required"
              value={createDraft.required ? "yes" : "no"}
              onChange={(event) => updateCreateDraft({ required: event.target.value === "yes" })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25"
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>

          <div>
            <FieldLabel htmlFor="create-display-array" label="Display Array Mapping" />
            <select
              id="create-display-array"
              value={createDraft.displayArrayMapping ? "yes" : "no"}
              onChange={(event) => updateCreateDraft({ displayArrayMapping: event.target.value === "yes" })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25"
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>

          <div>
            <FieldLabel htmlFor="create-data-type-filter" label="Data Type Filter" />
            <select
              id="create-data-type-filter"
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

          {createDraft.type.trim().toLowerCase() === "email" ? (
            <>
              <div>
                <FieldLabel htmlFor="create-email-duplicate-mode" label="Email Duplicate Rule" />
                <select
                  id="create-email-duplicate-mode"
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
                  <FieldLabel htmlFor="create-email-duplicate-days" label="Duplicate Window (days)" />
                  <FormError error={createErrors.emailDuplicateDays} />
                  <Input
                    id="create-email-duplicate-days"
                    type="number"
                    min={1}
                    value={createDraft.emailDuplicateDays}
                    invalid={Boolean(createErrors.emailDuplicateDays)}
                    onChange={(event) => updateCreateDraft({ emailDuplicateDays: event.target.value })}
                    placeholder="30"
                  />
                </div>
              ) : null}
            </>
          ) : null}
        </div>
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
