"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import {
  CODE_THEME_BY_LANGUAGE,
  buildDocumentationOutline,
  buildDocumentationCodeSnippets,
  buildErrorRows,
  buildExampleRequest,
  buildOverviewParagraphs,
  describeFieldCondition,
  getFieldsWithConditions,
  getCodeTokenClassName,
  LEAD_RESPONSE_STATUS_DEFINITIONS,
  prettyType,
  tokenizeCode,
  tokenizeJson,
  type CodeLanguage,
  type DocumentationErrorRow,
  type DocumentationField,
} from "@/lib/api-documentation-content";
import { PageSection, Spinner } from "@/components/ui/state";
import { cn } from "@/lib/utils";

type DocumentContentResponse = {
  sellerId: string;
  verticalId: string;
  verticalName: string;
  endpointUrl: string;
  apiKey: string;
  method: string;
  sellerName: string;
  baseUrl: string;
  fields: DocumentationField[];
};

function FieldConditionDisplay({ field }: { field: DocumentationField }) {
  const ignoreValues = field.ignoreValues ?? [];

  if (field.type.trim().toLowerCase() === "email" && field.emailDuplicateRule) {
    const label =
      field.emailDuplicateRule.mode === "forever"
        ? "Unique Forever"
        : `Unique ${field.emailDuplicateRule.days} Day(s)`;

    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
          Email Rule
        </span>
        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
          {label}
        </span>
      </div>
    );
  }

  if (ignoreValues.length > 0) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {ignoreValues.map((value) => (
            <span
              key={`${field.id}-${value}`}
              className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700"
            >
              {value}
            </span>
          ))}
        </div>
        <p className="text-xs text-slate-500">Ignored values</p>
      </div>
    );
  }

  return <span className="text-slate-400">-</span>;
}

function CollapsibleCodeSnippet({
  title,
  language,
  code,
  defaultExpanded = false,
}: {
  title: string;
  language: CodeLanguage;
  code: string;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const theme = CODE_THEME_BY_LANGUAGE[language];
  const tokens = language === "json" ? tokenizeJson(code) : tokenizeCode(code, language);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        className={cn("flex w-full items-center justify-between px-4 py-2.5 text-sm font-semibold transition", theme.headerClassName)}
      >
        <span>{title}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform duration-200", expanded && "rotate-180")} />
      </button>
      {expanded ? (
        <pre className={cn("overflow-auto border-t border-slate-200 p-4 text-xs leading-6 dark:border-slate-700", theme.bodyClassName)}>
          {tokens.map((token, index) => {
            const content: ReactNode = token.text;
            const className = getCodeTokenClassName(token.styleKey);
            return className ? (
              <span key={`${language}-${index}`} className={className}>
                {content}
              </span>
            ) : (
              <span key={`${language}-${index}`}>{content}</span>
            );
          })}
        </pre>
      ) : null}
    </div>
  );
}

function DocumentSectionHeading({ label }: { label: string }) {
  return <h2 className="text-xl font-semibold text-slate-900">{label}</h2>;
}

function DocumentSubsectionHeading({ label }: { label: string }) {
  return <h3 className="font-medium text-slate-900">{label}</h3>;
}

export default function ApiDocumentPreviewPage() {
  const params = useParams<{ mappingId: string }>();
  const searchParams = useSearchParams();
  const mappingId = params?.mappingId ?? "";
  const sellerId = searchParams.get("sellerId") ?? "";
  const sellerName = searchParams.get("sellerName");
  const verticalName = searchParams.get("verticalName");
  const [documentContent, setDocumentContent] = useState<DocumentContentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(mappingId));
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const downloadUrl = mappingId ? `/api/vertical-mappings/${encodeURIComponent(mappingId)}/document?download=1` : "";
  const backUrl = `/api-config?sellerId=${encodeURIComponent(sellerId)}&sellerName=${encodeURIComponent(sellerName ?? "")}`;

  useEffect(() => {
    if (!mappingId) return;

    const fetchDocumentContent = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/vertical-mappings/${encodeURIComponent(mappingId)}/document-content`);
        const payload = (await response.json()) as DocumentContentResponse | { message?: string };

        if (!response.ok) {
          setError("message" in payload && payload.message ? payload.message : "Unable to load document content.");
          return;
        }

        setDocumentContent(payload as DocumentContentResponse);
      } catch {
        setError("Unable to load document content.");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchDocumentContent();
  }, [mappingId]);

  const exampleRequest = useMemo(
    () => (documentContent ? buildExampleRequest(documentContent.fields) : {}),
    [documentContent]
  );
  const overviewParagraphs = useMemo(
    () => (documentContent ? buildOverviewParagraphs(documentContent.verticalName) : []),
    [documentContent]
  );

  const codeSnippets = useMemo(
    () => (documentContent ? buildDocumentationCodeSnippets(documentContent, exampleRequest) : []),
    [documentContent, exampleRequest]
  );
  const errorRows: DocumentationErrorRow[] = documentContent ? buildErrorRows(documentContent.fields) : [];
  const conditionedFields = documentContent ? getFieldsWithConditions(documentContent.fields) : [];
  const outline = useMemo(
    () => buildDocumentationOutline(conditionedFields.length > 0),
    [conditionedFields.length]
  );

  const handleDownload = async () => {
    if (!downloadUrl) return;

    setIsDownloading(true);
    setDownloadError(null);

    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Failed to download API documentation.");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const fileNameMatch = disposition.match(/filename="([^"]+)"/);
      anchor.href = objectUrl;
      anchor.download = fileNameMatch?.[1] ?? "api-documentation.pdf";
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (downloadFailure) {
      setDownloadError(
        downloadFailure instanceof Error ? downloadFailure.message : "Failed to download API documentation."
      );
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        Viewing API document for seller <span className="font-semibold">{sellerName ?? "selected seller"}</span> and
        vertical <span className="font-semibold">{verticalName ?? "selected vertical"}</span>.
      </div>

      <PageSection
        title="API Documentation"
        actions={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void handleDownload()}
              disabled={!mappingId || isDownloading}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {isDownloading ? "Downloading..." : "Download"}
            </button>
            <Link
              href={backUrl}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Back to API Configuration
            </Link>
          </div>
        }
      >
        {downloadError ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {downloadError}
          </div>
        ) : null}
        {!mappingId ? (
          <div className="rounded-xl border border-dashed border-red-300 bg-red-50 p-10 text-center text-red-700">
            Missing mapping id.
          </div>
        ) : isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-dashed border-red-300 bg-red-50 p-10 text-center text-red-700">
            {error}
          </div>
        ) : documentContent ? (
          <div className="space-y-8 text-sm text-slate-700">
            <section className="space-y-3">
              <DocumentSectionHeading label={outline.overview.label} />
              {overviewParagraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>

            <section className="space-y-3">
              <DocumentSectionHeading label={outline.endpointInformation.label} />
              <div className="grid gap-2">
                <div>
                  <span className="font-medium text-slate-900">HTTP Method:</span> {documentContent.method}
                </div>
                <div>
                  <span className="font-medium text-slate-900">Base URL:</span>{" "}
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{documentContent.baseUrl}</code>
                </div>
                <div>
                  <span className="font-medium text-slate-900">Endpoint URL:</span>{" "}
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{documentContent.endpointUrl}</code>
                </div>
                <div>
                  <span className="font-medium text-slate-900">API Key:</span>{" "}
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{documentContent.apiKey}</code>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <DocumentSectionHeading label={outline.requestBody.label} />
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full border-separate border-spacing-0 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">Parameter</th>
                      <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">Type</th>
                      <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">Required</th>
                      <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">Description</th>
                      <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">Condition</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documentContent.fields.map((field, index) => (
                      <tr key={field.id} className={index % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                        <td className="border-b border-slate-100 px-4 py-3 font-mono text-xs text-slate-700">{field.fieldName}</td>
                        <td className="border-b border-slate-100 px-4 py-3">{prettyType(field.type)}</td>
                        <td className="border-b border-slate-100 px-4 py-3">{field.required ? "Yes" : "No"}</td>
                        <td className="border-b border-slate-100 px-4 py-3">{field.description}</td>
                        <td className="border-b border-slate-100 px-4 py-3">
                          <FieldConditionDisplay field={field} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {outline.fieldConditions ? (
              <section className="space-y-3">
                <DocumentSectionHeading label={outline.fieldConditions.label} />
                <div className="space-y-2">
                  {conditionedFields.map((field) => (
                    <div key={field.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex flex-col gap-2">
                        <p className="font-mono text-xs text-slate-700">{field.fieldName}</p>
                        <FieldConditionDisplay field={field} />
                        <p className="text-sm text-slate-600">{describeFieldCondition(field)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="space-y-3">
              <DocumentSectionHeading label={outline.exampleJsonRequest.label} />
              <CollapsibleCodeSnippet
                title="JSON"
                language="json"
                code={JSON.stringify(exampleRequest, null, 2)}
              />
            </section>

            <section className="space-y-3">
              <DocumentSectionHeading label={outline.codeSnippets.label} />
              <p className="text-slate-600">Click a language to expand or collapse the sample request code.</p>
              <div className="space-y-2">
                {codeSnippets.map((snippet) => (
                  <CollapsibleCodeSnippet
                    key={snippet.id}
                    title={snippet.title}
                    language={snippet.language}
                    code={snippet.code}
                  />
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <DocumentSectionHeading label={outline.responseStatus.label} />
              <p className="text-slate-600">
                The API returns a JSON body with a numeric <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">status</code>{" "}
                field indicating the lead processing result.
              </p>

              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full border-separate border-spacing-0 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                      <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">Name</th>
                      <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {LEAD_RESPONSE_STATUS_DEFINITIONS.map((definition, index) => (
                      <tr key={definition.statusCode} className={index % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                        <td className="border-b border-slate-100 px-4 py-3 font-mono text-xs">{definition.statusCode}</td>
                        <td className="border-b border-slate-100 px-4 py-3 font-medium text-slate-900">{definition.title}</td>
                        <td className="border-b border-slate-100 px-4 py-3">{definition.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-2">
                {outline.responseStatusItems.map((item) => (
                  <div key={item.number} className="space-y-2">
                    <DocumentSubsectionHeading label={item.label} />
                    <p className="text-slate-600">{item.definition.description}</p>
                    <CollapsibleCodeSnippet
                      title={`${item.label} — JSON Response`}
                      language="json"
                      code={JSON.stringify(item.definition.example, null, 2)}
                    />
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <DocumentSectionHeading label={outline.errorResponses.label} />
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full border-separate border-spacing-0 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">HTTP Status</th>
                      <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">Scenario</th>
                      <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">Example Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errorRows.map((row, index) => (
                      <tr key={row.status} className={index % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                        <td className="border-b border-slate-100 px-4 py-3 font-medium text-slate-900">{row.status}</td>
                        <td className="border-b border-slate-100 px-4 py-3">{row.scenario}</td>
                        <td className="border-b border-slate-100 px-4 py-3">
                          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">{row.message}</code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-500">
            Unable to load document preview.
          </div>
        )}
      </PageSection>
    </div>
  );
}
