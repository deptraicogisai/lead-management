"use client";

import { useMemo } from "react";
import { CopyableValue } from "@/components/ui/copy-button";
import { Spinner } from "@/components/ui/state";
import type { PhonexaProductDocument, PhonexaProductField } from "@/lib/phonexa-products";
import { cn } from "@/lib/utils";

function HtmlText({ value }: { value: string }) {
  return (
    <span
      className="leading-6 [&_strong]:font-semibold"
      dangerouslySetInnerHTML={{ __html: value }}
    />
  );
}

function RequiredBadge({ value }: { value: string }) {
  const isRequired = value.toUpperCase() === "YES";

  return (
    <span
      className={cn(
        "inline-flex rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
        isRequired ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
      )}
    >
      {value}
    </span>
  );
}

function FieldTable({
  title,
  fields,
}: {
  title: string;
  fields: PhonexaProductField[];
}) {
  if (fields.length === 0) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/80">
            <tr>
              <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                Field Name
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                Required
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                Description
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                Format
              </th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => (
              <tr
                key={`${field.fieldName}-${index}`}
                className={index % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/70 dark:bg-slate-800/40"}
              >
                <td className="border-b border-slate-100 px-4 py-3 font-mono text-xs text-slate-800 dark:border-slate-800 dark:text-slate-100">
                  {field.fieldName}
                </td>
                <td className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                  <RequiredBadge value={field.required} />
                </td>
                <td className="border-b border-slate-100 px-4 py-3 text-slate-700 dark:border-slate-800 dark:text-slate-200">
                  <HtmlText value={field.description} />
                </td>
                <td className="border-b border-slate-100 px-4 py-3 text-slate-700 dark:border-slate-800 dark:text-slate-200">
                  {field.format ? <HtmlText value={field.format} /> : <span className="text-slate-400">-</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ProductDocViewer({
  document,
  isLoading,
  error,
}: {
  document: PhonexaProductDocument | null;
  isLoading: boolean;
  error: string | null;
}) {
  const requestLinks = useMemo(() => {
    if (!document?.requestLinks) return [];
    return Object.entries(document.requestLinks);
  }, [document]);

  if (isLoading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-dashed border-red-300 bg-red-50 p-10 text-center text-red-700">
        {error}
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-500">
        Select a product from the sidebar to view API documentation.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{document.name}</h2>
        <p className="text-sm text-slate-500">
          {document.category} · Product ID {document.productId}
          {document.fromCache ? " · Loaded from database" : " · Synced from Phonexa API"}
        </p>
      </div>

      {document.postingUrl ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-100">
          <span className="font-semibold">Posting Url:</span>{" "}
          <CopyableValue value={document.postingUrl} copyLabel="Copy posting URL" />
        </div>
      ) : null}

      <FieldTable title="API Fields" fields={document.fields} />
      <FieldTable title="Ping Fields" fields={document.pingData} />
      <FieldTable title="Ping Post Fields" fields={document.pingpostData} />

      {requestLinks.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Request Links</h3>
          <div className="space-y-2 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            {requestLinks.map(([label, url]) => (
              <div key={label} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="min-w-24 font-medium capitalize text-slate-900 dark:text-slate-100">{label}:</span>
                <CopyableValue value={url} copyLabel={`Copy ${label} URL`} />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
