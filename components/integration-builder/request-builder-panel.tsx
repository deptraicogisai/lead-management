"use client";

import { ChevronDown, Plus, Trash2, Upload } from "lucide-react";
import { TwigTemplateInput } from "@/components/integration-builder/twig-template-input";
import { MappingSectionCard } from "@/components/integration-builder/mapping-section-card";
import { DualSaveBar, shouldUseDualSaveBar } from "@/components/ui/dual-save-bar";
import { Input, PrimaryButton } from "@/components/ui/form-controls";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type RequestBuilderHeaderRow = {
  id: string;
  key: string;
  value: string;
};

export type RequestBuilderDataRow = {
  id: string;
  name: string;
  type: string;
  value: string;
};

type TwigInputProps = {
  leadFieldNames: string[];
  integrationConfigFields: Array<{ variableName: string; label: string }>;
  arrayMappingSlugs: Array<{ slug: string; fieldName: string }>;
};

type RequestBuilderPanelProps = {
  title: string;
  badge?: string;
  description?: string;
  tone?: "default" | "post" | "ping";
  defaultOpen?: boolean;
  requestUrl: string;
  methodType: string;
  dataType: string;
  payloadType: string;
  headers: RequestBuilderHeaderRow[];
  dataRows: RequestBuilderDataRow[];
  showHeaders: boolean;
  showData: boolean;
  urlPlaceholder?: string;
  isSavingHeaders: boolean;
  isSavingData: boolean;
  canSave: boolean;
  twigInputProps: TwigInputProps;
  onRequestUrlChange: (value: string) => void;
  onMethodTypeChange: (value: string) => void;
  onDataTypeChange: (value: string) => void;
  onPayloadTypeChange: (value: string) => void;
  onToggleHeaders: () => void;
  onToggleData: () => void;
  onUpdateHeader: (id: string, key: keyof RequestBuilderHeaderRow, value: string) => void;
  onAddHeader: () => void;
  onRemoveHeader: (id: string) => void;
  onSaveHeaders: () => void;
  onUpdateDataRow: (id: string, key: keyof RequestBuilderDataRow, value: string) => void;
  onAddDataRow: () => void;
  onRemoveDataRow: (id: string) => void;
  onSaveData: () => void;
  onOpenSampleImport: () => void;
};

function Collapsible({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out motion-reduce:transition-none",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      )}
      aria-hidden={!open}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          className={cn(
            "transition-[transform,opacity] duration-300 ease-in-out motion-reduce:transition-none",
            open ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function Toggle({ open, label, onToggle }: { open: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="inline-flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
    >
      <ChevronDown
        size={15}
        className={cn(
          "shrink-0 text-slate-500 transition-transform duration-300 ease-out dark:text-slate-400",
          open ? "rotate-0" : "-rotate-90"
        )}
      />
      <span>
        {label}
        <span className="ml-1.5 text-xs font-medium text-slate-400 dark:text-slate-500">
          ({open ? "Hide" : "Show"})
        </span>
      </span>
    </button>
  );
}

export function RequestBuilderPanel({
  title,
  badge,
  description,
  tone = "default",
  defaultOpen = true,
  requestUrl,
  methodType,
  dataType,
  payloadType,
  headers,
  dataRows,
  showHeaders,
  showData,
  urlPlaceholder = "config.url or static value",
  isSavingHeaders,
  isSavingData,
  canSave,
  twigInputProps,
  onRequestUrlChange,
  onMethodTypeChange,
  onDataTypeChange,
  onPayloadTypeChange,
  onToggleHeaders,
  onToggleData,
  onUpdateHeader,
  onAddHeader,
  onRemoveHeader,
  onSaveHeaders,
  onUpdateDataRow,
  onAddDataRow,
  onRemoveDataRow,
  onSaveData,
  onOpenSampleImport,
}: RequestBuilderPanelProps) {
  return (
    <MappingSectionCard
      title={title}
      badge={badge}
      description={description}
      tone={tone}
      defaultOpen={defaultOpen}
    >
      <div className="space-y-6 p-5">
        <div className="grid gap-4 md:max-w-3xl md:grid-cols-2 xl:grid-cols-3">
          <div className="md:col-span-2 xl:col-span-1">
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Request-Url
            </label>
            <TwigTemplateInput
              value={requestUrl}
              onChange={onRequestUrlChange}
              placeholder={urlPlaceholder}
              {...twigInputProps}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Method Type
            </label>
            <DropdownSelect
              value={methodType}
              options={["POST", "PUT", "PATCH", "GET"].map((method) => ({
                value: method,
                label: method,
              }))}
              onChange={onMethodTypeChange}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Data Type
            </label>
            <DropdownSelect
              value={dataType}
              options={["JSON", "FORM-DATA", "XML"].map((type) => ({
                value: type,
                label: type,
              }))}
              onChange={onDataTypeChange}
            />
          </div>
        </div>

        <div className="space-y-4">
          <Toggle open={showHeaders} label="Headers" onToggle={onToggleHeaders} />
          <Collapsible open={showHeaders}>
            <DualSaveBar
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50"
              dual={shouldUseDualSaveBar(headers.length)}
              renderActions={() => (
                <PrimaryButton
                  type="button"
                  disabled={isSavingHeaders || !canSave}
                  onClick={onSaveHeaders}
                  className="bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                >
                  {isSavingHeaders ? "Saving..." : "Save Headers"}
                </PrimaryButton>
              )}
            >
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_48px]">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Key
                  </p>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Value
                  </p>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {" "}
                  </p>
                </div>

                {headers.map((row) => (
                  <div key={row.id} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_48px]">
                    <TwigTemplateInput
                      value={row.key}
                      onChange={(nextValue) => onUpdateHeader(row.id, "key", nextValue)}
                      {...twigInputProps}
                    />
                    <TwigTemplateInput
                      value={row.value}
                      onChange={(nextValue) => onUpdateHeader(row.id, "value", nextValue)}
                      {...twigInputProps}
                    />
                    <button
                      type="button"
                      onClick={() => onRemoveHeader(row.id)}
                      className="flex h-11 items-center justify-center rounded-xl border border-red-200 text-red-500 transition hover:bg-red-50 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200 dark:hover:bg-red-500/20"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={onAddHeader}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-700 bg-emerald-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                >
                  <Plus size={15} />
                  <span>Add new</span>
                </button>
              </div>
            </DualSaveBar>
          </Collapsible>
        </div>

        <div className="space-y-4">
          <Toggle open={showData} label="Data" onToggle={onToggleData} />
          <Collapsible open={showData}>
            <DualSaveBar
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50"
              dual={shouldUseDualSaveBar(dataRows.length)}
              renderActions={() => (
                <PrimaryButton
                  type="button"
                  disabled={isSavingData || !canSave}
                  onClick={onSaveData}
                  className="bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                >
                  {isSavingData ? "Saving..." : "Save Data"}
                </PrimaryButton>
              )}
            >
              <div className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  <span className="font-medium text-slate-700 dark:text-slate-200">Field Name</span> is
                  the buyer field key sent in the request body.
                  <span className="font-medium text-slate-700 dark:text-slate-200"> Value</span> accepts
                  plain text or Twig templates — e.g.{" "}
                  <code className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-700">{`{{ lead.field_name }}`}</code>
                  .
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={onOpenSampleImport}
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-700 bg-emerald-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                  >
                    <Upload size={15} />
                    <span>Import by Sample</span>
                  </button>

                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Type</label>
                    <DropdownSelect
                      value={payloadType}
                      options={[
                        { value: "Object", label: "Object" },
                        { value: "Array", label: "Array" },
                      ]}
                      onChange={onPayloadTypeChange}
                      className="min-w-44"
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-[minmax(0,1.1fr)_180px_minmax(0,1fr)_48px]">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Field Name
                  </p>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Type
                  </p>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Value
                  </p>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {" "}
                  </p>
                </div>

                {dataRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
                    No data records yet. Click `Add new` or use `Import by Sample` to generate rows.
                  </div>
                ) : (
                  dataRows.map((row) => (
                    <div
                      key={row.id}
                      className="grid gap-3 md:grid-cols-[minmax(0,1.1fr)_180px_minmax(0,1fr)_48px]"
                    >
                      <Input
                        value={row.name}
                        onChange={(event) => onUpdateDataRow(row.id, "name", event.target.value)}
                        placeholder="buyer_field_name"
                      />
                      <DropdownSelect
                        value={row.type}
                        options={["String", "Number", "Boolean", "Object", "Array", "Null"].map(
                          (type) => ({ value: type, label: type })
                        )}
                        onChange={(type) => onUpdateDataRow(row.id, "type", type)}
                      />
                      <TwigTemplateInput
                        value={row.value}
                        onChange={(nextValue) => onUpdateDataRow(row.id, "value", nextValue)}
                        {...twigInputProps}
                      />
                      <button
                        type="button"
                        onClick={() => onRemoveDataRow(row.id)}
                        className="flex h-11 items-center justify-center rounded-xl border border-red-200 text-red-500 transition hover:bg-red-50 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200 dark:hover:bg-red-500/20"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}

                <button
                  type="button"
                  onClick={onAddDataRow}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-700 bg-emerald-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                >
                  <Plus size={15} />
                  <span>Add new</span>
                </button>
              </div>
            </DualSaveBar>
          </Collapsible>
        </div>
      </div>
    </MappingSectionCard>
  );
}
