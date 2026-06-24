"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { CopyButton, CopyableValue } from "@/components/ui/copy-button";
import { useParams, useSearchParams } from "next/navigation";
import {
  CODE_THEME_BY_LANGUAGE,
  buildDocumentationOutline,
  buildDocumentationCodeSnippets,
  buildErrorRows,
  buildExampleRequest,
  buildLeadResponseStatusDefinitions,
  buildOverviewParagraphs,
  formatAcceptedValues,
  getCodeTokenClassName,
  tokenizeCode,
  tokenizeJson,
  type CodeLanguage,
  type DocumentationErrorRow,
  type DocumentationField,
} from "@/lib/api-documentation-content";
import {
  buildDocumentationRequestTableRows,
  type DocumentationRequestTableRow,
} from "@/lib/api-documentation-requirements";
import type { MappingIntakeSettingsRecord } from "@/lib/mapping-intake-settings";
import type { MappingApiType } from "@/lib/mapping-api-type";
import { SectionLoading } from "@/components/ui/loading-indicator";
import { PageSection } from "@/components/ui/state";
import { cn } from "@/lib/utils";

type DocumentContentResponse = {
  sellerId: string;
  verticalId: string;
  verticalName: string;
  endpointUrl: string;
  apiKey: string;
  method: string;
  sellerName: string;
  apiType: MappingApiType;
  fields: DocumentationField[];
  intakeSettings: MappingIntakeSettingsRecord;
};

function AcceptedValuesDisplay({ field }: { field: DocumentationField }) {
  const values = (field.options ?? [])
    .map((option) => option.value?.trim() || option.label?.trim() || "")
    .filter(Boolean);

  if (values.length === 0) {
    return <span className="text-slate-400">-</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <span
          key={`${field.id}-${value}`}
          className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800"
        >
          {value}
        </span>
      ))}
    </div>
  );
}

function RequirementCell({ value }: { value: string }) {
  if (value === "-") {
    return <span className="text-slate-400">-</span>;
  }

  return (
    <div className="space-y-1 whitespace-pre-line text-slate-700">
      {value.split("\n").map((line, index) => (
        <p key={`${line}-${index}`} className="leading-6">
          {line}
        </p>
      ))}
    </div>
  );
}

function CollapsibleCodeSnippet({
  title,
  language,
  code,
  defaultExpanded = true,
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
      <div className={cn("flex w-full items-center justify-between gap-3 px-4 py-2.5 text-sm font-semibold transition", theme.headerClassName)}>
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
        >
          <span>{title}</span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform duration-200", expanded && "rotate-180")} />
        </button>
        <CopyButton text={code} label={`Copy ${title}`} className="border-transparent bg-white/80 hover:bg-white dark:bg-slate-900/60 dark:hover:bg-slate-900" />
      </div>
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

  const downloadUrl =
    sellerId && mappingId
      ? `/api/sellers/${encodeURIComponent(sellerId)}/verticals/mappings/${encodeURIComponent(mappingId)}/document?download=1`
      : "";
  const backUrl = `/api-config?sellerId=${encodeURIComponent(sellerId)}&sellerName=${encodeURIComponent(sellerName ?? "")}`;

  useEffect(() => {
    if (!mappingId || !sellerId) return;

    const fetchDocumentContent = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/sellers/${encodeURIComponent(sellerId)}/verticals/mappings/${encodeURIComponent(mappingId)}/document-content`
        );
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
  }, [mappingId, sellerId]);

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
  const requestTableRows = useMemo(
    () =>
      documentContent
        ? buildDocumentationRequestTableRows(
            documentContent.intakeSettings,
            documentContent.fields,
            formatAcceptedValues
          )
        : [],
    [documentContent]
  );
  const outline = useMemo(
    () => buildDocumentationOutline(documentContent?.apiType ?? "Redirect"),
    [documentContent?.apiType]
  );
  const responseStatusDefinitions = useMemo(
    () => buildLeadResponseStatusDefinitions(documentContent?.apiType ?? "Redirect"),
    [documentContent?.apiType]
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
        actions={
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={!mappingId || isDownloading}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {isDownloading ? "Downloading..." : "Download"}
          </button>
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
          <SectionLoading message="Loading API documentation..." minHeightClassName="min-h-[320px]" />
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
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-900">Endpoint URL:</span>
                  <CopyableValue value={documentContent.endpointUrl} copyLabel="Copy endpoint URL" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-900">API Key:</span>
                  <CopyableValue value={documentContent.apiKey} copyLabel="Copy API key" />
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
                      <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">Accepted Values</th>
                      <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">Requirement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requestTableRows.map((row: DocumentationRequestTableRow, index) => (
                      <tr key={`${row.parameter}-${index}`} className={index % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                        <td className="border-b border-slate-100 px-4 py-3 font-mono text-xs text-slate-700">{row.parameter}</td>
                        <td className="border-b border-slate-100 px-4 py-3">{row.type}</td>
                        <td className="border-b border-slate-100 px-4 py-3">{row.required}</td>
                        <td className="border-b border-slate-100 px-4 py-3">{row.description}</td>
                        <td className="border-b border-slate-100 px-4 py-3">
                          {(() => {
                            const field = documentContent.fields.find((item) => item.fieldName === row.parameter);
                            if (field && (field.options?.length ?? 0) > 0) {
                              return <AcceptedValuesDisplay field={field} />;
                            }
                            if (row.acceptedValues === "-") {
                              return <span className="text-slate-400">-</span>;
                            }
                            return row.acceptedValues;
                          })()}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3">
                          <RequirementCell value={row.requirement} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

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
                    {responseStatusDefinitions.map((definition, index) => (
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
                          <CopyableValue
                            value={row.message}
                            copyLabel="Copy example message"
                            codeClassName="text-slate-700 dark:text-slate-200"
                          />
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
