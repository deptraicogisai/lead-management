"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  CODE_THEME_BY_LANGUAGE,
  buildErrorRows,
  buildCSharpSnippet,
  buildExampleRequest,
  buildJavaScriptSnippet,
  buildOverviewParagraphs,
  buildPythonSnippet,
  buildSuccessResponse,
  describeFieldCondition,
  getFieldsWithConditions,
  getCodeTokenClassName,
  prettyType,
  tokenizeCode,
  tokenizeJson,
  type CodeLanguage,
  type DocumentationErrorRow,
  type DocumentationField,
} from "@/lib/api-documentation-content";
import { PageSection, Spinner } from "@/components/ui/state";

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

function CodeSnippet({
  title,
  language,
  code,
}: {
  title: string;
  language: CodeLanguage;
  code: string;
}) {
  const theme = CODE_THEME_BY_LANGUAGE[language];
  const tokens = language === "json" ? tokenizeJson(code) : tokenizeCode(code, language);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <div className={`px-4 py-2 text-sm font-semibold ${theme.headerClassName}`}>{title}</div>
      <pre className={`overflow-auto p-4 text-xs leading-6 ${theme.bodyClassName}`}>
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
    </div>
  );
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

  const pythonSnippet = documentContent ? buildPythonSnippet(documentContent, exampleRequest) : "";
  const csharpSnippet = documentContent ? buildCSharpSnippet(documentContent, exampleRequest) : "";
  const javascriptSnippet = documentContent ? buildJavaScriptSnippet(documentContent, exampleRequest) : "";
  const successResponse = buildSuccessResponse();
  const errorRows: DocumentationErrorRow[] = documentContent ? buildErrorRows(documentContent.fields) : [];
  const conditionedFields = documentContent ? getFieldsWithConditions(documentContent.fields) : [];

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
            <a
              href={downloadUrl}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Download
            </a>
            <Link
              href={backUrl}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Back to API Configuration
            </Link>
          </div>
        }
      >
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
              <h2 className="text-xl font-semibold text-slate-900">Overview</h2>
              {overviewParagraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-slate-900">Endpoint Information</h2>
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
              <h2 className="text-xl font-semibold text-slate-900">Request Body</h2>
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

            {conditionedFields.length > 0 ? (
              <section className="space-y-3">
                <h2 className="text-xl font-semibold text-slate-900">Field Conditions</h2>
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
              <h2 className="text-xl font-semibold text-slate-900">Example JSON Request</h2>
              <CodeSnippet title="JSON" language="json" code={JSON.stringify(exampleRequest, null, 2)} />
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-slate-900">Code Snippets</h2>
              <div className="space-y-4">
                <CodeSnippet title="Python" language="python" code={pythonSnippet} />
                <CodeSnippet title="C#" language="csharp" code={csharpSnippet} />
                <CodeSnippet title="JavaScript" language="javascript" code={javascriptSnippet} />
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-slate-900">Example Response</h2>
              <div>
                <h3 className="mb-2 font-medium text-slate-900">Success Response</h3>
                <CodeSnippet title="JSON" language="json" code={JSON.stringify(successResponse, null, 2)} />
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-slate-900">Error Responses</h2>
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
