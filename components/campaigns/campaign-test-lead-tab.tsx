"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, FlaskConical, ScrollText } from "lucide-react";
import { PrimaryButton } from "@/components/ui/form-controls";
import { ContentAreaLoading } from "@/components/ui/content-area-loading";
import { PageTabBar } from "@/components/ui/page-tab-bar";
import { IdBadge } from "@/components/ui/id-badge";
import { Modal } from "@/components/ui/modal";
import { ScrollableTableShell } from "@/components/ui/scrollable-table-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { useSystemSettings } from "@/components/settings/system-settings-context";
import { TestLeadFieldControl } from "@/components/test-lead/test-lead-field-control";
import type { StatusBadgeVariant } from "@/lib/status-badge";
import { toast } from "@/lib/toast";
import type { CampaignTestLeadLogRecord } from "@/lib/campaign-test-lead-log";
import {
  buildEmptyTestLeadForm,
  buildRandomTestLeadForm,
  buildTestLeadPayload,
  chunkTestLeadFields,
  type MappingTestLeadField,
  validateTestLeadForm,
} from "@/lib/mapping-test-lead";
import { cn } from "@/lib/utils";
import { formatDateTimeDisplay } from "@/lib/date-range";

type TestLeadView = "form" | "log";
type LogDetailTab = "response" | "request" | "lead";

const testLeadViewTabs = [
  { id: "form" as const, label: "Form", icon: ClipboardList },
  { id: "log" as const, label: "Log", icon: ScrollText },
];

type CampaignTestLeadTabProps = {
  campaignId: string;
  productLabel: string;
  integrationLabel: string;
};

function formatLogTimestamp(iso: string, timeZone: string) {
  const full = formatDateTimeDisplay(iso, timeZone);
  const [date, time] = full.split(" ");
  return {
    date: date ?? "-",
    time: time ?? "",
    full,
  };
}

function formatHttpStatusLine(status: number) {
  if (status >= 200 && status < 300) return `HTTP/1.1 ${status} OK`;
  if (status === 0) return "HTTP/1.1 0 Error";
  return `HTTP/1.1 ${status} Error`;
}

function formatResponseHttpHeaders(status: number, headers: Record<string, string>, body: string) {
  const lines = [formatHttpStatusLine(status)];

  for (const [key, value] of Object.entries(headers)) {
    lines.push(`${key}: ${value}`);
  }

  if (!lines.some((line) => line.toLowerCase().startsWith("content-length:"))) {
    lines.push(`Content-Length: ${body.length}`);
  }

  return lines.join("\n");
}

function formatRequestBodyForDisplay(body: Record<string, unknown>, headers: Record<string, string>) {
  const contentType = Object.entries(headers).find(([key]) => key.toLowerCase() === "content-type")?.[1] ?? "";

  if (contentType.toLowerCase().includes("form-urlencoded")) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(body)) {
      params.set(key, value === undefined || value === null ? "" : String(value));
    }
    return params.toString();
  }

  return JSON.stringify(body, null, 2);
}

function formatHeaderBlock(headers: Record<string, string>) {
  return Object.entries(headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}

function resolveBuyerStatusForBadge(buyerStatus: string) {
  const normalized = buyerStatus.trim().toLowerCase();

  if (normalized === "accept") {
    return { status: "accept", label: "Accept" };
  }
  if (normalized === "reject") {
    return { status: "reject", label: "Reject" };
  }
  if (normalized === "price reject" || normalized === "price conflict") {
    return { status: "reject", label: buyerStatus.trim() };
  }
  if (normalized === "error") {
    return { status: "error", label: "Error" };
  }
  if (normalized === "timeout") {
    return { status: "error", label: "Timeout" };
  }

  return { status: "error", label: buyerStatus.trim() || "Error" };
}

function BuyerStatusBadge({
  buyerStatus,
  variant = "outline",
}: {
  buyerStatus: string;
  variant?: StatusBadgeVariant;
}) {
  const badge = resolveBuyerStatusForBadge(buyerStatus);

  return <StatusBadge status={badge.status} label={badge.label} variant={variant} />;
}

function LogDetailTabs({
  activeTab,
  onChange,
}: {
  activeTab: LogDetailTab;
  onChange: (tab: LogDetailTab) => void;
}) {
  const tabs: Array<{ id: LogDetailTab; label: string }> = [
    { id: "response", label: "Response" },
    { id: "request", label: "Request" },
    { id: "lead", label: "Lead" },
  ];

  return (
    <div className="flex flex-wrap gap-4 border-b border-slate-200 dark:border-slate-700">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "border-b-2 px-1 pb-2 text-sm font-medium transition",
            activeTab === tab.id
              ? "border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function ResponseDetailPanel({ log }: { log: CampaignTestLeadLogRecord }) {
  const response = log.buyerResponse;
  const responseBody = response?.body ?? "";
  const responseHeaders = response?.headers ?? {};
  const normalizedStatusCode = log.statusCode.trim().toLowerCase();
  const shouldHideRawStatusCode = normalizedStatusCode === "true" || normalizedStatusCode === "false";
  const statusCodeLabel = shouldHideRawStatusCode ? "-" : log.statusCode || "-";

  return (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Response Received From Buyer</h3>

      <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-medium">Status:</span> {statusCodeLabel}
          <BuyerStatusBadge buyerStatus={log.buyerStatus} />
        </p>
        <p>
          <span className="font-medium">Message:</span> {log.message || "-"}
        </p>
        <p>
          <span className="font-medium">Processing Time:</span> {log.processingTimeSeconds}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Response HTTP Header:</p>
        <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
          {formatResponseHttpHeaders(response?.httpStatus ?? 0, responseHeaders, responseBody)}
        </pre>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Response String:</p>
        <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
          {responseBody || "-"}
        </pre>
      </div>
    </div>
  );
}

function RequestDetailPanel({ log }: { log: CampaignTestLeadLogRecord }) {
  const { timeZone } = useSystemSettings();
  const request = log.buyerRequest;
  const timestamp = formatLogTimestamp(log.submittedAt, timeZone).full;

  return (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Request Sent To Buyer</h3>

      <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
        <p>
          <span className="font-medium">Request URL:</span> {request?.url || "-"}
        </p>
        <p>
          <span className="font-medium">Request Timestamp:</span> {timestamp}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Request HTTP Header:</p>
        <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
          {request ? formatHeaderBlock(request.headers) : "-"}
        </pre>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Data sent to buyer:</p>
        <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
          {request ? formatRequestBodyForDisplay(request.body, request.headers) : "-"}
        </pre>
      </div>

      <p className="text-sm text-slate-700 dark:text-slate-200">
        <span className="font-medium">Request HTTP Method:</span> {request?.method || "POST"}
      </p>
    </div>
  );
}

function LeadDetailPanel({ log }: { log: CampaignTestLeadLogRecord }) {
  const entries = Object.entries(log.leadData);

  return (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Lead Data</h3>

      {entries.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-300">No lead data recorded.</p>
      ) : (
        <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
          {entries.map(([key, value]) => (
            <p key={key}>
              <span className="font-semibold">{key}</span>: {value === undefined || value === null ? "" : String(value)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function resolveLogDisplayId(log: CampaignTestLeadLogRecord, index: number, total: number) {
  return log.displayId > 0 ? log.displayId : total - index;
}

function TestLeadLogDetailModal({
  log,
  open,
  onClose,
}: {
  log: CampaignTestLeadLogRecord | null;
  open: boolean;
  onClose: () => void;
}) {
  const [detailTab, setDetailTab] = useState<LogDetailTab>("response");

  useEffect(() => {
    if (open) {
      setDetailTab("response");
    }
  }, [open, log?.id]);

  if (!log) {
    return null;
  }

  const displayId = log.displayId > 0 ? log.displayId : "-";

  return (
    <Modal
      open={open}
      title={`Test Lead Log #${displayId}`}
      onClose={onClose}
      panelClassName="max-w-4xl"
    >
      <LogDetailTabs activeTab={detailTab} onChange={setDetailTab} />

      <div className="mt-5">
        {detailTab === "response" ? <ResponseDetailPanel log={log} /> : null}
        {detailTab === "request" ? <RequestDetailPanel log={log} /> : null}
        {detailTab === "lead" ? <LeadDetailPanel log={log} /> : null}
      </div>
    </Modal>
  );
}

function TestLeadLogHistory({
  logs,
  onOpenLog,
}: {
  logs: CampaignTestLeadLogRecord[];
  onOpenLog: (logId: string) => void;
}) {
  const { timeZone } = useSystemSettings();
  if (logs.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-300">
        No test lead logs yet. Send a test lead from the Form tab.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Test Lead Logs</h3>
      <ScrollableTableShell
        rowCount={logs.length}
        thead={
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <th className="px-4 py-3 font-semibold">ID</th>
            <th className="px-4 py-3 font-semibold">Submitted</th>
            <th className="px-4 py-3 font-semibold">URL</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">Message</th>
            <th className="px-4 py-3 font-semibold">Time (s)</th>
          </tr>
        }
      >
        <tbody>
          {logs.map((log, index) => {
            const timestamp = formatLogTimestamp(log.submittedAt, timeZone);
            const displayId = resolveLogDisplayId(log, index, logs.length);

            return (
              <tr
                key={log.id}
                className="border-t border-slate-100 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
              >
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onOpenLog(log.id)}
                    className="group inline-flex"
                    aria-label={`Open test lead log ${displayId}`}
                  >
                    <IdBadge id={displayId} interactive />
                  </button>
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  {timestamp.date} {timestamp.time}
                </td>
                <td className="max-w-[220px] px-4 py-3">
                  <span
                    className="block truncate font-mono text-xs text-slate-600 dark:text-slate-300"
                    title={log.buyerRequest?.url || undefined}
                  >
                    {log.buyerRequest?.url?.trim() || "-"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <BuyerStatusBadge buyerStatus={log.buyerStatus} />
                </td>
                <td className="max-w-xs truncate px-4 py-3 text-slate-600 dark:text-slate-300">
                  {log.message || "-"}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{log.processingTimeSeconds}</td>
              </tr>
            );
          })}
        </tbody>
      </ScrollableTableShell>
    </div>
  );
}

export function CampaignTestLeadTab({ campaignId, productLabel, integrationLabel }: CampaignTestLeadTabProps) {
  const [activeView, setActiveView] = useState<TestLeadView>("form");
  const [fields, setFields] = useState<MappingTestLeadField[]>([]);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [logs, setLogs] = useState<CampaignTestLeadLogRecord[]>([]);
  const [detailModalLogId, setDetailModalLogId] = useState<string | null>(null);
  const [integrationConfigured, setIntegrationConfigured] = useState(false);
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClearingLogs, setIsClearingLogs] = useState(false);

  const fieldSections = useMemo(() => chunkTestLeadFields(fields), [fields]);
  const detailModalLog = logs.find((log) => log.id === detailModalLogId) ?? null;

  const loadContext = useCallback(async () => {
    setIsLoadingContext(true);

    try {
      const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/test-lead`);
      const result = (await response.json().catch(() => null)) as
        | {
            fields?: MappingTestLeadField[];
            integrationConfigured?: boolean;
            logs?: CampaignTestLeadLogRecord[];
          }
        | { message?: string }
        | null;

      if (!response.ok) {
        toast.error((result as { message?: string } | null)?.message ?? "Failed to load test lead settings.");
        return;
      }

      const nextFields = (result as { fields?: MappingTestLeadField[] }).fields ?? [];
      setFields(nextFields);
      setIntegrationConfigured(Boolean((result as { integrationConfigured?: boolean }).integrationConfigured));
      setFormValues((current) => (Object.keys(current).length > 0 ? current : buildEmptyTestLeadForm(nextFields)));

      const nextLogs = (result as { logs?: CampaignTestLeadLogRecord[] }).logs ?? [];
      setLogs(nextLogs);
    } finally {
      setIsLoadingContext(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const updateFieldValue = (fieldName: string, value: string) => {
    setFormValues((current) => ({ ...current, [fieldName]: value }));
    setFormErrors((current) => {
      if (!current[fieldName]) return current;
      const next = { ...current };
      delete next[fieldName];
      return next;
    });
  };

  const handlePrefill = () => {
    setFormValues(buildRandomTestLeadForm(fields));
    setFormErrors({});
  };

  const handleReset = () => {
    setFormValues(buildEmptyTestLeadForm(fields));
    setFormErrors({});
  };

  const handleSubmit = async () => {
    const validationErrors = validateTestLeadForm(fields, formValues);
    setFormErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      toast.error("Please fix the highlighted fields before sending the test lead.");
      return;
    }

    if (!integrationConfigured) {
      toast.error("Configure an integration on this campaign before sending a test lead.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/test-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: buildTestLeadPayload(fields, formValues),
        }),
      });

      const result = (await response.json().catch(() => null)) as
        | { message?: string; log?: CampaignTestLeadLogRecord }
        | null;

      if (!response.ok) {
        toast.error(result?.message ?? "Failed to send test lead.");
        if (result?.log) {
          setLogs((current) => [result.log!, ...current.filter((log) => log.id !== result.log!.id)]);
          setDetailModalLogId(result.log.id);
          setActiveView("log");
        }
        return;
      }

      toast.success(result?.message ?? "Test lead sent to buyer.");
      if (result?.log) {
        setLogs((current) => [result.log!, ...current.filter((log) => log.id !== result.log!.id)]);
        setDetailModalLogId(result.log.id);
        setActiveView("log");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearLogs = async () => {
    setIsClearingLogs(true);

    try {
      const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/test-lead`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { message?: string } | null;
        toast.error(result?.message ?? "Failed to clear logs.");
        return;
      }

      setLogs([]);
      setDetailModalLogId(null);
      toast.success("Logs cleared.");
    } finally {
      setIsClearingLogs(false);
    }
  };

  if (isLoadingContext) {
    return <ContentAreaLoading message="Loading test lead..." />;
  }

  return (
    <div className="mt-6 space-y-6">
      <TestLeadLogDetailModal
        log={detailModalLog}
        open={Boolean(detailModalLog)}
        onClose={() => setDetailModalLogId(null)}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTabBar tabs={testLeadViewTabs} activeTabId={activeView} onTabChange={setActiveView} />

        {activeView === "log" ? (
          <button
            type="button"
            disabled={isClearingLogs || logs.length === 0}
            onClick={() => void handleClearLogs()}
            className={cn(
              "rounded-xl border px-4 py-2 text-sm font-medium transition",
              logs.length === 0 || isClearingLogs
                ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-500"
                : "border-red-300 bg-white text-red-700 hover:bg-red-50 dark:border-red-500/40 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-500/10"
            )}
          >
            {isClearingLogs ? "Clearing..." : "Clear logs"}
          </button>
        ) : null}
      </div>

      {activeView === "form" ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
            <button
              type="button"
              onClick={handlePrefill}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              Prefill a Mix Of Sold Leads
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <FlaskConical size={16} />
              Campaign Test Lead
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Product: <span className="font-medium">{productLabel}</span>
              {integrationLabel ? (
                <>
                  {" "}
                  | Integration: <span className="font-medium">{integrationLabel}</span>
                </>
              ) : null}
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Fields are loaded from the campaign product vertical. On send, only request mapping fields from the
              integration are posted to the buyer URL configured on this campaign.
            </p>
            {!integrationConfigured ? (
              <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                Configure an integration on the Integration tab before sending a test lead.
              </p>
            ) : null}
          </div>

          {fields.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-300">
              No fields configured for this product vertical yet.
            </div>
          ) : (
            fieldSections.map((sectionFields, sectionIndex) => (
              <section
                key={`campaign-test-lead-section-${sectionIndex}`}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <h3 className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-100">{sectionIndex + 1}</h3>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {sectionFields.map((field) => (
                    <TestLeadFieldControl
                      key={field.fieldName}
                      field={field}
                      value={formValues[field.fieldName] ?? ""}
                      onChange={(value) => updateFieldValue(field.fieldName, value)}
                      error={formErrors[field.fieldName]}
                    />
                  ))}
                </div>
              </section>
            ))
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
            <PrimaryButton
              type="button"
              disabled={isSubmitting || fields.length === 0 || !integrationConfigured}
              onClick={() => void handleSubmit()}
              className="bg-emerald-800 hover:bg-emerald-700"
            >
              {isSubmitting ? "Sending..." : "Send lead"}
            </PrimaryButton>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              Reset to defaults
            </button>
          </div>
        </div>
      ) : (
        <TestLeadLogHistory logs={logs} onOpenLog={setDetailModalLogId} />
      )}
    </div>
  );
}
