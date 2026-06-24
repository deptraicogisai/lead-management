"use client";

import { useEffect, useMemo, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { CopyableValue } from "@/components/ui/copy-button";
import { SectionLoading } from "@/components/ui/loading-indicator";
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
      <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1">
        <div className="min-w-[640px] overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
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
      </div>
    </section>
  );
}

function resolveCodeLanguage(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("php")) return "php";
  if (normalized.includes("python")) return "python";
  if (normalized.includes("java")) return "java";
  if (normalized.includes("bash") || normalized.includes("shell")) return "bash";
  if (normalized.includes("json")) return "json";
  return "text";
}

function SnippetBlock({
  title,
  value,
  language,
  formatAsJson = false,
}: {
  title: string;
  value: string | null;
  language: string;
  formatAsJson?: boolean;
}) {
  if (!value) return null;
  const normalizedValue = normalizeSnippetValue(value, formatAsJson);
  const resolvedLanguage = formatAsJson ? "json" : resolveCodeLanguage(language);

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</p>
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
        <SyntaxHighlighter
          language={resolvedLanguage}
          style={oneDark}
          customStyle={{
            margin: 0,
            borderRadius: 0,
            fontSize: "12px",
            lineHeight: 1.6,
            padding: "16px",
            background: "rgb(2, 6, 23)",
          }}
          wrapLongLines
          showLineNumbers={false}
        >
          {normalizedValue}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

function prettifyLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeSnippetValue(value: string, formatAsJson = false) {
  if (!value.trim()) return value;

  const looksLikeHtmlSnippet =
    /<(pre|code|span|br)\b/i.test(value) ||
    value.includes("&lt;") ||
    value.includes("&gt;") ||
    value.includes("&amp;");

  let normalized = value;

  if (looksLikeHtmlSnippet && typeof window !== "undefined") {
    const container = window.document.createElement("div");
    container.innerHTML = value;
    const text = container.textContent ?? container.innerText ?? "";
    normalized = text.replace(/\r\n/g, "\n").trim();
  }

  if (formatAsJson) {
    try {
      return JSON.stringify(JSON.parse(normalized), null, 2);
    } catch {
      return normalized;
    }
  }

  return normalized;
}

function mapResponseLabel(key: string, content: string) {
  const normalizedKey = key.toLowerCase();
  const normalizedContent = content.toLowerCase();

  if (normalizedKey.includes("sold") || normalizedContent.includes('"status_text": "sold"')) {
    return "Sold Lead";
  }
  if (normalizedKey.includes("reject")) {
    return "Reject Lead";
  }
  if (normalizedKey.includes("error") || normalizedContent.includes("error")) {
    return "Error";
  }
  return "";
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

  const requestExampleTabs = useMemo(() => {
    if (!document?.requestSamples) return [];

    const tabs: Array<{ id: string; label: string; content: string }> = [];
    for (const [language, variants] of Object.entries(document.requestSamples)) {
      for (const [variant, content] of Object.entries(variants)) {
        if (!content?.trim()) continue;
        const id = `${language}:${variant}`;
        const label = variant.toLowerCase() === "sample"
          ? prettifyLabel(language)
          : `${prettifyLabel(language)} ${prettifyLabel(variant)}`;
        tabs.push({ id, label, content });
      }
    }

    return tabs;
  }, [document]);

  const responseExampleTabs = useMemo(() => {
    if (!document?.responseSamples) return [];

    const rawEntries = Object.entries(document.responseSamples)
      .filter(([, content]) => Boolean(content?.trim()))
      .map(([status, content], index) => {
        const label = mapResponseLabel(status, content);
        return {
          id: status,
          label: label || ["Sold Lead", "Reject Lead", "Error"][index] || prettifyLabel(status),
          content,
        };
      });

    const preferredOrder = ["Sold Lead", "Reject Lead", "Error"];
    return rawEntries.sort((left, right) => {
      const leftOrder = preferredOrder.indexOf(left.label);
      const rightOrder = preferredOrder.indexOf(right.label);
      if (leftOrder === -1 && rightOrder === -1) return left.label.localeCompare(right.label);
      if (leftOrder === -1) return 1;
      if (rightOrder === -1) return -1;
      return leftOrder - rightOrder;
    });
  }, [document]);

  const [activeRequestTab, setActiveRequestTab] = useState("");
  const [activeResponseTab, setActiveResponseTab] = useState("");

  useEffect(() => {
    setActiveRequestTab(requestExampleTabs[0]?.id ?? "");
    setActiveResponseTab(responseExampleTabs[0]?.id ?? "");
  }, [requestExampleTabs, responseExampleTabs]);

  const activeRequestContent = requestExampleTabs.find((tab) => tab.id === activeRequestTab)?.content ?? null;
  const activeResponseContent = responseExampleTabs.find((tab) => tab.id === activeResponseTab)?.content ?? null;

  if (isLoading) {
    return <SectionLoading message="Loading documentation..." minHeightClassName="min-h-[420px]" />;
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

      {requestExampleTabs.length > 0 || responseExampleTabs.length > 0 ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-900 p-4 dark:border-slate-700">
          <h3 className="text-lg font-semibold uppercase tracking-wide text-slate-100">Request and Response Examples</h3>

          {requestExampleTabs.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-300">Request Example</p>
              <div className="flex flex-wrap gap-2">
                {requestExampleTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveRequestTab(tab.id)}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 text-xs font-medium transition",
                      activeRequestTab === tab.id
                        ? "bg-blue-600 text-white"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <SnippetBlock title="" value={activeRequestContent} language={activeRequestTab} />
            </div>
          ) : null}

          {responseExampleTabs.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-300">Response Examples</p>
              <div className="flex flex-wrap gap-2">
                {responseExampleTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveResponseTab(tab.id)}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 text-xs font-medium transition",
                      activeResponseTab === tab.id
                        ? "bg-blue-600 text-white"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <SnippetBlock title="" value={activeResponseContent} language="json" formatAsJson />
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
