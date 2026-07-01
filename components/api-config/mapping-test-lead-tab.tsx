"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TestLeadFieldControl } from "@/components/test-lead/test-lead-field-control";
import { Checkbox, Input, PrimaryButton, Select } from "@/components/ui/form-controls";
import { InlineLoading, SectionLoading } from "@/components/ui/loading-indicator";
import { getCodeTokenClassName, tokenizeJson } from "@/lib/api-documentation-content";
import { formatLeadRejectResponseBody, formatBuyerPostResponseBody } from "@/lib/mapping-lead-validation";
import {
  buildSystemBuyerValidationStep,
  resolveBuyerLogSnapshot,
  resolveBuyerResponseSnapshot,
  resolvePrimaryCampaignValidationChecks,
  resolvePublisherLogSnapshot,
  type MappingTestLeadLogRecord,
} from "@/lib/mapping-test-lead-log-shared";
import type { BuyerPostAttemptSnapshot } from "@/lib/buyer-post-request";
import {
  advanceBuyerPostQueueAfterAttempt,
  buildDraftTestLeadLog,
  ensureBuyerPostQueueRowProcessing,
  mergeBuyerPostQueueWithResults,
  sortBuyerPostAttemptViews,
  type BuyerPostAttemptView,
  type BuyerPostQueueState,
} from "@/lib/test-lead-buyer-progress";
import type { PingTreeCampaignType } from "@/lib/ping-tree";
import { Modal } from "@/components/ui/modal";
import type { TestLeadIntakeRuleGroup, TestLeadValidationCheck } from "@/lib/mapping-test-lead-intake";
import {
  resolveStepResult,
  type BuyerPostTraceStep,
  type BuyerPostValidationCheck,
} from "@/lib/buyer-post-trace";
import {
  buildEmptyTestLeadForm,
  buildRandomTestLeadForm,
  buildTestLeadPayload,
  chunkTestLeadFields,
  type MappingTestLeadField,
} from "@/lib/mapping-test-lead";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type TestLeadView = "form" | "log";

type MappingTestLeadTabProps = {
  sellerId: string;
  mappingId: string;
  apiName?: string | null;
  fields: MappingTestLeadField[];
};

type LogPanelTone = "request" | "success" | "error";

const LOG_PANEL_TONES: Record<
  LogPanelTone,
  { header: string; border: string; body: string; label: string }
> = {
  request: {
    header: "bg-sky-700 text-white dark:bg-sky-600",
    border: "border-sky-200 dark:border-sky-500/40",
    body: "bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-slate-100",
    label: "Request",
  },
  success: {
    header: "bg-emerald-700 text-white dark:bg-emerald-600",
    border: "border-emerald-200 dark:border-emerald-500/40",
    body: "bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-slate-100",
    label: "Response",
  },
  error: {
    header: "bg-red-700 text-white dark:bg-red-600",
    border: "border-red-200 dark:border-red-500/40",
    body: "bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-slate-100",
    label: "Response",
  },
};

function JsonLogPanel({ title, data, tone }: { title: string; data: unknown; tone: LogPanelTone }) {
  const code = JSON.stringify(data, null, 2);
  const tokens = tokenizeJson(code);
  const styles = LOG_PANEL_TONES[tone];

  return (
    <div className={cn("overflow-hidden rounded-2xl border shadow-sm", styles.border)}>
      <div className={cn("px-4 py-2.5 text-sm font-semibold", styles.header)}>{title}</div>
      <pre className={cn("overflow-x-auto p-4 text-xs leading-6", styles.body)}>
        {tokens.map((token, index) => {
          const className = getCodeTokenClassName(token.styleKey);
          return className ? (
            <span key={`${title}-${index}`} className={className}>
              {token.text}
            </span>
          ) : (
            <span key={`${title}-${index}`}>{token.text}</span>
          );
        })}
      </pre>
    </div>
  );
}

function IntakeRulesPanel({
  intakeRules,
  timezone,
  title = "Intake Rules Checked",
  description = "Test lead validates field configuration, duplicates, filters, and schedule before posting.",
}: {
  intakeRules: Array<{ category: string; rules: string[] }>;
  timezone?: string;
  title?: string;
  description?: string;
}) {
  const activeGroups = intakeRules.filter((group) => group.rules.length > 0);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        {description}
        {timezone ? ` Timezone: ${timezone}.` : null}
      </p>

      {activeGroups.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          No duplicate, filter, schedule, or PL/DNPL rules are configured.
        </p>
      ) : (
        <div
          className={cn(
            "mt-4 grid gap-3 md:grid-cols-2",
            activeGroups.length >= 4 ? "xl:grid-cols-4" : "xl:grid-cols-3"
          )}
        >
          {activeGroups.map((group) => (
            <div
              key={group.category}
              className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {group.category}
              </p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
                {group.rules.map((rule) => (
                  <li key={`${group.category}-${rule}`}>{rule}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function traceStepStatusClass(status: BuyerPostTraceStep["status"]) {
  switch (status) {
    case "pass":
      return "bg-emerald-700 text-white dark:bg-emerald-600";
    case "fail":
      return "bg-red-700 text-white dark:bg-red-600";
    case "skip":
      return "bg-slate-500 text-white dark:bg-slate-400";
    case "info":
      return "bg-blue-700 text-white dark:bg-blue-600";
    default:
      return "bg-amber-700 text-white dark:bg-amber-600";
  }
}

function BuyerValidationChecksGrid({
  checks,
  className,
}: {
  checks: BuyerPostValidationCheck[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-3 md:grid-cols-2",
        checks.length >= 4 ? "xl:grid-cols-4" : "xl:grid-cols-3",
        className
      )}
    >
      {checks.map((check) => (
        <div
          key={check.category}
          className={cn(
            "rounded-xl border p-3",
            check.passed
              ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10"
              : "border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{check.category}</p>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-semibold",
                check.passed
                  ? "bg-emerald-700 text-white dark:bg-emerald-600"
                  : "bg-red-700 text-white dark:bg-red-600"
              )}
            >
              {check.passed ? "Pass" : "Fail"}
            </span>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
            {check.messages.map((message) => (
              <li key={`${check.category}-${message}`}>{message}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function StepResultPanel({ step }: { step: BuyerPostTraceStep }) {
  const result = resolveStepResult(step);

  return (
    <div
      className={cn(
        "mt-3 rounded-xl border px-3 py-2.5 text-sm",
        result.success
          ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100"
          : "border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100"
      )}
    >
      <p className="font-semibold">{result.success ? "Success" : "Error"}</p>
      {result.message ? <p className="mt-1 text-slate-700 dark:text-slate-200">{result.message}</p> : null}
      {result.error ? <p className="mt-1">{result.error}</p> : null}
    </div>
  );
}

function BuyerPostTraceStepCard({ step, index }: { step: BuyerPostTraceStep; index: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {index + 1}. {step.label}
        </p>
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase", traceStepStatusClass(step.status))}>
          {step.status}
        </span>
      </div>
      {step.summary ? <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{step.summary}</p> : null}
      {step.validationChecks && step.validationChecks.length > 0 ? (
        <BuyerValidationChecksGrid checks={step.validationChecks} className="mt-3" />
      ) : null}
      <StepResultPanel step={step} />
    </div>
  );
}

function buildFallbackSubmissionTrace(log: MappingTestLeadLogRecord): BuyerPostTraceStep[] {
  return [
    {
      key: "publisher-intake-validation",
      label: "Publisher → System",
      status: log.validationPassed ? "pass" : "fail",
      summary: log.validationPassed
        ? "Publisher intake validation passed (fields, duplicates, filters, schedule)."
        : "Publisher intake validation failed.",
      validationChecks: log.validationChecks.map((check) => ({
        category: check.category,
        passed: check.passed,
        messages: check.messages,
      })),
      result: log.validationPassed
        ? { success: true, message: "Publisher intake validation passed." }
        : {
            success: false,
            error: log.validationChecks
              .filter((check) => !check.passed)
              .flatMap((check) => check.messages)
              .join(" | ") || "Publisher intake validation failed.",
          },
    },
  ];
}

function SubmissionTracePanel({ log }: { log: MappingTestLeadLogRecord }) {
  const submissionTrace = buildFallbackSubmissionTrace(log);

  if (submissionTrace.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Submission Trace</h3>
      {submissionTrace.map((step, index) => (
        <div key={`${step.key}-${index}`} className="space-y-3">
          <BuyerPostTraceStepCard step={step} index={index} />
        </div>
      ))}
    </div>
  );
}

const LOG_HISTORY_PAGE_SIZE = 10;

type LogResultFilter = "all" | "pass" | "fail";

function isLogHttpSuccess(log: MappingTestLeadLogRecord) {
  return log.status >= 200 && log.status < 300;
}

function getLogModeLabel(log: MappingTestLeadLogRecord) {
  if (!log.saveLead) return "Validate only";
  if (log.postToBuyer) return log.leadSaved ? "Save + post to buyer" : "Post to buyer requested";
  return log.leadSaved ? "Save lead" : "Save requested";
}

function padLogDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function formatLogTimestamp(iso: string) {
  const date = new Date(iso);
  const day = padLogDatePart(date.getDate());
  const month = padLogDatePart(date.getMonth() + 1);
  const year = date.getFullYear();
  const hours = padLogDatePart(date.getHours());
  const minutes = padLogDatePart(date.getMinutes());
  const seconds = padLogDatePart(date.getSeconds());

  return {
    date: `${day}/${month}/${year}`,
    time: `${hours}:${minutes}:${seconds}`,
    full: `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`,
  };
}

function TestLeadLogHistory({
  logs,
  selectedLogId,
  onSelect,
}: {
  logs: MappingTestLeadLogRecord[];
  selectedLogId: string | null;
  onSelect: (logId: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [resultFilter, setResultFilter] = useState<LogResultFilter>("all");
  const [page, setPage] = useState(1);

  const filteredLogs = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const filtered = logs.filter((log) => {
      if (resultFilter === "pass" && !log.validationPassed) return false;
      if (resultFilter === "fail" && log.validationPassed) return false;

      if (!normalizedQuery) return true;

      const timestamp = formatLogTimestamp(log.submittedAt);
      const searchable = [
        timestamp.date,
        timestamp.time,
        String(log.status),
        getLogModeLabel(log),
        log.validationPassed ? "pass" : "fail",
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedQuery);
    });

    return filtered.sort((left, right) => {
      const leftTime = new Date(left.submittedAt).getTime();
      const rightTime = new Date(right.submittedAt).getTime();
      return rightTime - leftTime;
    });
  }, [logs, resultFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / LOG_HISTORY_PAGE_SIZE));
  const currentPage = filteredLogs.length > 0 ? Math.min(page, totalPages) : 1;

  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * LOG_HISTORY_PAGE_SIZE;
    return filteredLogs.slice(startIndex, startIndex + LOG_HISTORY_PAGE_SIZE);
  }, [currentPage, filteredLogs]);

  useEffect(() => {
    setPage(1);
  }, [resultFilter, searchQuery]);

  useEffect(() => {
    if (filteredLogs.length === 0) return;
    if (!filteredLogs.some((log) => log.id === selectedLogId)) {
      onSelect(filteredLogs[0].id);
    }
  }, [filteredLogs, onSelect, selectedLogId]);

  if (logs.length === 0) {
    return null;
  }

  const startItem = filteredLogs.length > 0 ? (currentPage - 1) * LOG_HISTORY_PAGE_SIZE + 1 : 0;
  const endItem = filteredLogs.length > 0 ? Math.min(currentPage * LOG_HISTORY_PAGE_SIZE, filteredLogs.length) : 0;

  return (
    <div className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="border-b border-slate-200 p-4 dark:border-slate-700">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Saved Logs</h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {logs.length}
          </span>
        </div>

        <div className="mt-3 space-y-2">
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search date, status, mode..."
            aria-label="Search saved logs"
          />

          <Select
            value={resultFilter}
            onChange={(event) => setResultFilter(event.target.value as LogResultFilter)}
            aria-label="Filter by validation result"
          >
            <option value="all">All results</option>
            <option value="pass">Passed</option>
            <option value="fail">Failed</option>
          </Select>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400">
          <span>Submitted</span>
          <span>HTTP</span>
          <span>Mode</span>
        </div>

        {paginatedLogs.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">No logs match your filters.</p>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-700">
            {paginatedLogs.map((log) => {
              const isSelected = log.id === selectedLogId;
              const isSuccess = isLogHttpSuccess(log);
              const timestamp = formatLogTimestamp(log.submittedAt);

              return (
                <li key={log.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(log.id)}
                    className={cn(
                      "grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 px-3 py-2.5 text-left text-sm transition",
                      isSelected
                        ? "border-l-2 border-emerald-600 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-500/10"
                        : "border-l-2 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/70"
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-800 dark:text-slate-100">{timestamp.date}</span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">{timestamp.time}</span>
                      <span
                        className={cn(
                          "mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          log.validationPassed
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
                            : "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300"
                        )}
                      >
                        {log.validationPassed ? "Pass" : "Fail"}
                      </span>
                    </span>

                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-semibold text-white",
                        isSuccess ? "bg-emerald-700 dark:bg-emerald-600" : "bg-red-700 dark:bg-red-600"
                      )}
                    >
                      {log.status}
                    </span>

                    <span className="max-w-[88px] truncate text-xs text-slate-600 dark:text-slate-300">{getLogModeLabel(log)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
        <span>
          {filteredLogs.length > 0 ? (
            <>
              {startItem}-{endItem} of {filteredLogs.length}
            </>
          ) : (
            "0 logs"
          )}
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={filteredLogs.length === 0 || currentPage <= 1}
            aria-label="Previous page"
            className="inline-flex rounded-lg border border-slate-300 p-1.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="min-w-[3rem] text-center">
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            disabled={filteredLogs.length === 0 || currentPage >= totalPages}
            aria-label="Next page"
            className="inline-flex rounded-lg border border-slate-300 p-1.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function FlowSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      {children}
    </section>
  );
}

function PublisherSystemFlow({ log, endpointUrl }: { log: MappingTestLeadLogRecord; endpointUrl: string }) {
  const publisherSnapshot = resolvePublisherLogSnapshot(log);
  const publisherSuccess = publisherSnapshot.passed;

  return (
    <FlowSection
      title="Publisher → System"
      description="Publisher sends the lead to the system. Response reflects publisher validation only (fields, duplicate, filter, schedule)."
    >
      <JsonLogPanel
        title="Publisher Request"
        tone="request"
        data={{
          method: "POST",
          url: log.endpointUrl || endpointUrl,
          body: log.requestBody,
        }}
      />

      <JsonLogPanel
        title="Publisher Response"
        tone={publisherSuccess ? "success" : "error"}
        data={{
          httpStatus: publisherSnapshot.status,
          body: publisherSnapshot.responseBody,
        }}
      />
    </FlowSection>
  );
}

function buyerStatusBadgeClass(status: string, queueState?: BuyerPostQueueState) {
  if (queueState === "processing") return "bg-sky-600 animate-pulse dark:bg-sky-500";
  if (queueState === "waiting") return "bg-slate-400 dark:bg-slate-600";
  if (status === "Accept") return "bg-emerald-700 dark:bg-emerald-600";
  if (status === "Skipped") return "bg-slate-500";
  if (status === "Timeout" || status === "Error") return "bg-amber-700 dark:bg-amber-600";
  if (status === "Price Reject" || status === "Price Conflict") return "bg-orange-700 dark:bg-orange-600";
  return "bg-red-700 dark:bg-red-600";
}

function resolveBuyerAttemptLogId(attempt: BuyerPostAttemptSnapshot, index: number) {
  return attempt.logId?.trim() || String(index + 1).padStart(3, "0");
}

function formatBuyerAttemptPostedDate(attempt: BuyerPostAttemptSnapshot, fallbackIso: string) {
  const iso = attempt.postedAt ?? fallbackIso;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function buildCompactBuyerAttemptResponse(attempt: BuyerPostAttemptSnapshot) {
  const displayKeys = [
    "status",
    "status_text",
    "price",
    "redirectUrl",
    "redirect_url",
    "reject_sign",
    "reject_reason",
    "error_reason",
    "reason",
    "reasons",
  ] as const;

  const raw = attempt.response.body?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const compact = displayKeys.reduce<Record<string, unknown>>((result, key) => {
        const value = parsed[key];
        if (value !== undefined && value !== null && value !== "") {
          result[key] = value;
        }
        return result;
      }, {});

      if (Object.keys(compact).length > 0) {
        return compact;
      }
    } catch {
      // Fall back to normalized snapshot fields below.
    }
  }

  return formatBuyerPostResponseBody({
    buyerStatus: attempt.buyerStatus,
    price: attempt.price,
    redirectUrl: attempt.redirectUrl,
    rejectReason: attempt.rejectReason,
    errorReason: attempt.errorReason,
  });
}

function SystemBuyerAttemptModal({
  attempt,
  fallbackPostedAt,
  open,
  onClose,
}: {
  attempt: BuyerPostAttemptSnapshot | null;
  fallbackPostedAt: string;
  open: boolean;
  onClose: () => void;
}) {
  if (!attempt) return null;

  const responseSuccess = attempt.buyerStatus === "Accept";
  const responseBody = buildCompactBuyerAttemptResponse(attempt);
  const validationChecks = attempt.campaignValidationChecks ?? [];
  const showValidationChecks =
    validationChecks.length > 0 &&
    (attempt.buyerStatus === "Skipped" || attempt.postedToBuyer === false);
  const requestMappingData =
    attempt.requestMappingData && Object.keys(attempt.requestMappingData).length > 0
      ? attempt.requestMappingData
      : attempt.request?.body ?? {};
  const hasRequestMappingData = Object.keys(requestMappingData).length > 0;
  const hasMappedValues = Object.keys(attempt.mappedValues).length > 0;

  return (
    <Modal
      open={open}
      title={`Buyer Post Log ${resolveBuyerAttemptLogId(attempt, (attempt.campaignOrder ?? 1) - 1)}`}
      description={`${attempt.campaignName} | ${attempt.buyerCompany} | ${attempt.pingTreeType ?? "Redirect"} | ${formatBuyerAttemptPostedDate(attempt, fallbackPostedAt)}`}
      onClose={onClose}
      panelClassName="max-w-4xl"
    >
      <div className="space-y-4">
        {showValidationChecks ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Campaign Validation</p>
            <BuyerValidationChecksGrid checks={validationChecks} />
          </div>
        ) : null}

        {hasRequestMappingData ? (
          <JsonLogPanel title="Request Mapping Data" tone="request" data={requestMappingData} />
        ) : null}

        {hasMappedValues ? (
          <JsonLogPanel title="Array Mapping Values" tone="request" data={attempt.mappedValues} />
        ) : null}

        <JsonLogPanel
          title="Buyer Response"
          tone={responseSuccess ? "success" : "error"}
          data={responseBody}
        />
      </div>
    </Modal>
  );
}

function resolveBuyerAttemptSkipSummary(attempt: BuyerPostAttemptView) {
  if (attempt.queueState === "processing" || attempt.queueState === "waiting") return null;
  if (attempt.buyerStatus !== "Skipped") return null;

  const failedChecks = (attempt.campaignValidationChecks ?? []).filter((check) => !check.passed);
  if (failedChecks.length > 0) {
    return failedChecks.flatMap((check) => check.messages).join(" | ");
  }

  return attempt.errorReason?.trim() || null;
}

function resolveBuyerAttemptDisplayStatus(attempt: BuyerPostAttemptView) {
  if (attempt.queueState === "processing") return "Processing...";
  if (attempt.queueState === "waiting") return "Waiting...";
  if (attempt.buyerStatus === "Accept") return "Sold";
  return attempt.buyerStatus;
}

function isBuyerAttemptPending(attempt: BuyerPostAttemptView) {
  return attempt.queueState === "processing" || attempt.queueState === "waiting";
}

function formatBuyerAttemptPostedDateForGrid(attempt: BuyerPostAttemptView) {
  if (attempt.queueState === "waiting") return "";

  if (attempt.queueState === "processing") {
    if (!attempt.processingStartedAt) return "";
    return formatBuyerAttemptPostedDate({ ...attempt, postedAt: attempt.processingStartedAt }, "");
  }

  if (attempt.postedAt) {
    return formatBuyerAttemptPostedDate(attempt, "");
  }

  return "";
}

function resolveBuyerAttemptGridLogId(index: number) {
  return String(index + 1).padStart(3, "0");
}

function SystemBuyerAttemptsGrid({
  attempts,
  submittedAt,
  onViewLog,
}: {
  attempts: BuyerPostAttemptView[];
  submittedAt: string;
  onViewLog: (attempt: BuyerPostAttemptSnapshot) => void;
}) {
  if (attempts.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">
        No buyer post attempts were recorded.
      </p>
    );
  }

  const sortedAttempts = sortBuyerPostAttemptViews(attempts);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr>
              {["Log ID", "Campaign", "Campaign Type", "Buyer", "Status", "Posted Date", "Action"].map((heading) => (
                <th
                  key={heading}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-900">
            {sortedAttempts.map((attempt, index) => {
              const skipSummary = resolveBuyerAttemptSkipSummary(attempt);

              return (
              <tr key={`${attempt.campaignId}-${index}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-200">
                  {resolveBuyerAttemptGridLogId(index)}
                </td>
                <td className="px-4 py-3 text-slate-800 dark:text-slate-100">{attempt.campaignName}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{attempt.pingTreeType ?? "Redirect"}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{attempt.buyerCompany}</td>
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    <span
                      title={skipSummary ?? undefined}
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold text-white",
                        buyerStatusBadgeClass(attempt.buyerStatus, attempt.queueState)
                      )}
                    >
                      {resolveBuyerAttemptDisplayStatus(attempt)}
                    </span>
                    {skipSummary ? (
                      <p className="max-w-xs text-xs text-slate-500 dark:text-slate-400">{skipSummary}</p>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  {formatBuyerAttemptPostedDateForGrid(attempt)}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    disabled={isBuyerAttemptPending(attempt)}
                    onClick={() => onViewLog(attempt)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    View log
                  </button>
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SystemBuyerFlow({ log }: { log: MappingTestLeadLogRecord }) {
  const [selectedAttempt, setSelectedAttempt] = useState<BuyerPostAttemptSnapshot | null>(null);
  const buyerSnapshot = resolveBuyerLogSnapshot(log);
  const attempts = (log.buyerPostAttempts ?? []) as BuyerPostAttemptView[];
  const campaignValidationStep = buildSystemBuyerValidationStep({
    checks: resolvePrimaryCampaignValidationChecks(log),
    buyerPostHint: log.buyerPostHint,
  });
  const buyerRejectBody = buyerSnapshot.rejectResponseBody ?? resolveBuyerResponseSnapshot(log).responseBody;

  if (!buyerSnapshot.enabled) {
    return null;
  }

  return (
    <FlowSection
      title="System → Buyer"
      description="Redirect and Silent post in parallel. Within each campaign type, campaigns post in ping tree order. Redirect stops after the first Accept; Silent continues through all active campaigns."
    >
      {buyerSnapshot.skipped ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
          Skipped because publisher validation failed.
        </div>
      ) : (
        <>
          <BuyerPostTraceStepCard step={campaignValidationStep} index={0} />

          {log.postToBuyer && attempts.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 dark:border-slate-700 dark:bg-slate-900/60">
              <InlineLoading message="Preparing buyer posts..." />
            </div>
          ) : !buyerSnapshot.postedToBuyer && attempts.length === 0 ? (
            <JsonLogPanel title="Buyer Response" tone="error" data={formatLeadRejectResponseBody(buyerRejectBody)} />
          ) : (
            <SystemBuyerAttemptsGrid
              attempts={attempts}
              submittedAt={log.submittedAt}
              onViewLog={setSelectedAttempt}
            />
          )}

          <SystemBuyerAttemptModal
            attempt={selectedAttempt}
            fallbackPostedAt={log.submittedAt}
            open={Boolean(selectedAttempt)}
            onClose={() => setSelectedAttempt(null)}
          />
        </>
      )}
    </FlowSection>
  );
}

function TestLeadLogDetail({ log, endpointUrl }: { log: MappingTestLeadLogRecord; endpointUrl: string }) {
  const publisherSnapshot = resolvePublisherLogSnapshot(log);
  const buyerSnapshot = resolveBuyerLogSnapshot(log);
  const publisherSuccess = publisherSnapshot.passed;

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "rounded-2xl border p-4 text-sm",
          publisherSuccess
            ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10"
            : "border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10"
        )}
      >
        <p className="font-medium text-slate-800 dark:text-slate-100">
          Submitted: {formatLogTimestamp(log.submittedAt).full}
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-slate-700 dark:text-slate-200">
          <span>Publisher:</span>
          <span
            className={cn(
              "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold text-white",
              publisherSuccess ? "bg-emerald-700 dark:bg-emerald-600" : "bg-red-700 dark:bg-red-600"
            )}
          >
            {publisherSnapshot.status}
          </span>
          <span>{publisherSuccess ? "Accepted" : "Rejected"}</span>
          {buyerSnapshot.enabled ? (
            <>
              <span className="text-slate-400">|</span>
              <span>Buyer:</span>
              <span
                className={cn(
                  "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold text-white",
                  buyerSnapshot.skipped
                    ? "bg-slate-500"
                    : buyerSnapshot.passed
                      ? "bg-emerald-700 dark:bg-emerald-600"
                      : "bg-red-700 dark:bg-red-600"
                )}
              >
                {buyerSnapshot.skipped ? "Skipped" : buyerSnapshot.passed ? "Accept" : "Reject"}
              </span>
            </>
          ) : null}
          <span className="text-slate-500 dark:text-slate-400">{getLogModeLabel(log)}</span>
        </p>
      </div>

      <SubmissionTracePanel log={log} />

      <PublisherSystemFlow log={log} endpointUrl={endpointUrl} />
      <SystemBuyerFlow log={log} />
    </div>
  );
}

export function MappingTestLeadTab({ sellerId, mappingId, apiName, fields }: MappingTestLeadTabProps) {
  const [activeView, setActiveView] = useState<TestLeadView>("form");
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [saveLead, setSaveLead] = useState(false);
  const [postToBuyer, setPostToBuyer] = useState(false);
  const [endpointUrl, setEndpointUrl] = useState("/api/lead");
  const [timezone, setTimezone] = useState("");
  const [intakeRules, setIntakeRules] = useState<TestLeadIntakeRuleGroup[]>([]);
  const [multiSelectFilters, setMultiSelectFilters] = useState<Record<string, string[]>>({});
  const [logs, setLogs] = useState<MappingTestLeadLogRecord[]>([]);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClearingLogs, setIsClearingLogs] = useState(false);
  const buyerPostQueueRef = useRef<BuyerPostAttemptView[]>([]);

  const fieldSections = useMemo(() => chunkTestLeadFields(fields), [fields]);
  const selectedLog = logs.find((log) => log.id === selectedLogId) ?? logs[0] ?? null;

  const loadContext = useCallback(async () => {
    if (!sellerId || !mappingId) return;

    setIsLoadingContext(true);
    try {
      const response = await fetch(
        `/api/sellers/${encodeURIComponent(sellerId)}/verticals/mappings/${encodeURIComponent(mappingId)}/test-lead`
      );
      const result = (await response.json().catch(() => null)) as
        | {
            endpointUrl?: string;
            intakeRules?: TestLeadIntakeRuleGroup[];
            multiSelectFilters?: Record<string, string[]>;
            timezone?: string;
            logs?: MappingTestLeadLogRecord[];
          }
        | { message?: string }
        | null;

      if (!response.ok) {
        toast.error((result as { message?: string } | null)?.message ?? "Failed to load test lead settings.");
        return;
      }

      setEndpointUrl((result as { endpointUrl?: string }).endpointUrl ?? "/api/lead");
      setIntakeRules((result as { intakeRules?: TestLeadIntakeRuleGroup[] }).intakeRules ?? []);
      setMultiSelectFilters((result as { multiSelectFilters?: Record<string, string[]> }).multiSelectFilters ?? {});
      setTimezone((result as { timezone?: string }).timezone ?? "");
      const nextLogs = (result as { logs?: MappingTestLeadLogRecord[] }).logs ?? [];
      setLogs(nextLogs);
      setSelectedLogId((current) => current ?? nextLogs[0]?.id ?? null);
    } finally {
      setIsLoadingContext(false);
    }
  }, [mappingId, sellerId]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  useEffect(() => {
    setFormValues(buildRandomTestLeadForm(fields, multiSelectFilters));
  }, [fields, multiSelectFilters]);

  useEffect(() => {
    if (!saveLead) {
      setPostToBuyer(false);
    }
  }, [saveLead]);

  const updateFieldValue = (fieldName: string, value: string) => {
    setFormValues((current) => ({ ...current, [fieldName]: value }));
  };

  const handlePrefill = () => {
    setFormValues(buildRandomTestLeadForm(fields, multiSelectFilters));
  };

  const handleReset = () => {
    setFormValues(buildEmptyTestLeadForm(fields));
  };

  const handleSubmit = async () => {
    const requestBody = buildTestLeadPayload(fields, formValues);
    const useBuyerStream = postToBuyer && saveLead;
    const submittedAt = new Date().toISOString();
    const draftLogId = useBuyerStream ? `pending-${Date.now()}` : null;

    setIsSubmitting(true);
    buyerPostQueueRef.current = [];

    if (useBuyerStream && draftLogId) {
      const draftLog = buildDraftTestLeadLog({
        submittedAt,
        endpointUrl,
        requestBody,
        saveLead,
        postToBuyer,
        validationPassed: true,
        validationChecks: [],
        pendingAttempts: [],
      });
      draftLog.id = draftLogId;

      setLogs((current) => [draftLog, ...current]);
      setSelectedLogId(draftLogId);
      setActiveView("log");
    }

    try {
      const response = await fetch(
        `/api/sellers/${encodeURIComponent(sellerId)}/verticals/mappings/${encodeURIComponent(mappingId)}/test-lead`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payload: requestBody,
            saveLead,
            postToBuyer,
          }),
        }
      );

      if (useBuyerStream && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;

            const event = JSON.parse(line) as
              | { type: "started"; attempts: BuyerPostAttemptView[] }
              | {
                  type: "processing";
                  campaignId: string;
                  pingTreeType: PingTreeCampaignType;
                  campaignOrder: number;
                }
              | { type: "attempt"; attempt: BuyerPostAttemptSnapshot }
              | {
                  type: "complete";
                  log: MappingTestLeadLogRecord;
                  passed?: boolean;
                  message?: string;
                }
              | { type: "error"; message?: string };

            if (event.type === "started" && draftLogId) {
              buyerPostQueueRef.current = sortBuyerPostAttemptViews(event.attempts);
              setLogs((current) =>
                current.map((log) =>
                  log.id === draftLogId
                    ? { ...log, buyerPostAttempts: buyerPostQueueRef.current }
                    : log
                )
              );
              continue;
            }

            if (event.type === "processing" && draftLogId) {
              buyerPostQueueRef.current = ensureBuyerPostQueueRowProcessing(
                buyerPostQueueRef.current,
                event.campaignId,
                event.pingTreeType
              );
              setLogs((current) =>
                current.map((log) =>
                  log.id === draftLogId
                    ? { ...log, buyerPostAttempts: buyerPostQueueRef.current }
                    : log
                )
              );
              continue;
            }

            if (event.type === "attempt" && draftLogId) {
              buyerPostQueueRef.current = advanceBuyerPostQueueAfterAttempt(
                buyerPostQueueRef.current,
                event.attempt
              );
              setLogs((current) =>
                current.map((log) =>
                  log.id === draftLogId
                    ? {
                        ...log,
                        buyerPostAttempts: buyerPostQueueRef.current,
                      }
                    : log
                )
              );
              continue;
            }

            if (event.type === "complete" && event.log) {
              const mergedAttempts = mergeBuyerPostQueueWithResults(
                buyerPostQueueRef.current,
                (event.log.buyerPostAttempts ?? []) as BuyerPostAttemptSnapshot[]
              );
              buyerPostQueueRef.current = [];
              setLogs((current) => [
                { ...event.log, buyerPostAttempts: mergedAttempts },
                ...current.filter((log) => log.id !== draftLogId && log.id !== event.log.id),
              ]);
              setSelectedLogId(event.log.id);
              setActiveView("log");
              continue;
            }

            if (event.type === "error") {
              toast.error(event.message ?? "Failed to submit test lead.");
              buyerPostQueueRef.current = [];
              if (draftLogId) {
                setLogs((current) => current.filter((log) => log.id !== draftLogId));
                setSelectedLogId((current) => (current === draftLogId ? null : current));
              }
            }
          }
        }

        return;
      }

      const result = (await response.json().catch(() => null)) as
        | {
            passed?: boolean;
            checks?: TestLeadValidationCheck[];
            log?: MappingTestLeadLogRecord;
            responseBody?: unknown;
            message?: string;
            leadSaved?: boolean;
            saveLead?: boolean;
          }
        | null;

      if (!result?.log) {
        toast.error(result?.message ?? "Failed to submit test lead.");
        return;
      }

      setLogs((current) => [result.log!, ...current.filter((log) => log.id !== result.log!.id)]);
      setSelectedLogId(result.log.id);
      setActiveView("log");
    } catch {
      toast.error("Failed to submit test lead.");
      buyerPostQueueRef.current = [];
      if (draftLogId) {
        setLogs((current) => current.filter((log) => log.id !== draftLogId));
        setSelectedLogId((current) => (current === draftLogId ? null : current));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearLogs = async () => {
    if (isClearingLogs) return;
    if (!window.confirm("Clear all test lead logs for this mapping?")) return;

    setIsClearingLogs(true);
    try {
      const response = await fetch(
        `/api/sellers/${encodeURIComponent(sellerId)}/verticals/mappings/${encodeURIComponent(mappingId)}/test-lead`,
        { method: "DELETE" }
      );
      const result = (await response.json().catch(() => null)) as { message?: string; deletedCount?: number } | null;
      if (!response.ok) {
        toast.error(result?.message ?? "Failed to clear logs.");
        return;
      }
      setLogs([]);
      setSelectedLogId(null);
      toast.success(`Cleared ${result?.deletedCount ?? 0} log(s).`);
    } catch {
      toast.error("Failed to clear logs.");
    } finally {
      setIsClearingLogs(false);
    }
  };

  if (isLoadingContext) {
    return <SectionLoading message="Loading test lead form..." />;
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
            {(
              [
                { id: "form" as const, label: "Form" },
                { id: "log" as const, label: "Log" },
              ] as const
            ).map((view) => (
              <button
                key={view.id}
                type="button"
                onClick={() => setActiveView(view.id)}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition",
                  activeView === view.id
                    ? "bg-emerald-800 text-white dark:bg-emerald-600"
                    : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                )}
              >
                {view.label}
              </button>
            ))}
          </div>

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
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
            <button
              type="button"
              onClick={handlePrefill}
              className="shrink-0 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              Prefill Sample Values
            </button>
            <div className="hidden h-6 w-px bg-slate-200 dark:bg-slate-700 sm:block" aria-hidden />
            <Checkbox
              id="test-lead-save-lead"
              checked={saveLead}
              onChange={setSaveLead}
              label="Save lead"
              className="w-auto shrink-0"
            />
            <Checkbox
              id="test-lead-post-to-buyer"
              checked={postToBuyer}
              onChange={setPostToBuyer}
              label="Post to buyer"
              disabled={!saveLead}
              className="w-auto shrink-0"
            />
          </div>
        ) : null}
      </div>

      {activeView === "form" ? (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              API: {apiName ?? "Selected API"}
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Validate against duplicates, filters, and schedule. Enable save to store the lead. Use post to buyer to run ping tree delivery against the mock buyer API.
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Endpoint: <span className="font-mono">{endpointUrl}</span>
            </p>
          </div>

          <IntakeRulesPanel intakeRules={intakeRules} timezone={timezone} />

          {fields.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-300">
              No fields configured yet. Add fields in the Fields tab before testing lead intake.
            </div>
          ) : (
            fieldSections.map((sectionFields, sectionIndex) => (
              <section
                key={`test-lead-section-${sectionIndex}`}
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
                      allowedTokens={multiSelectFilters[field.fieldName]}
                    />
                  ))}
                </div>
              </section>
            ))
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
            <PrimaryButton type="button" disabled={isSubmitting || fields.length === 0} onClick={() => void handleSubmit()}>
              {isSubmitting ? "Running test..." : "Send lead"}
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
      ) : selectedLog ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)] xl:items-start">
          <TestLeadLogHistory logs={logs} selectedLogId={selectedLog.id} onSelect={setSelectedLogId} />
          <TestLeadLogDetail log={selectedLog} endpointUrl={endpointUrl} />
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-300">
          No submissions yet. Send a test lead from the Form tab to see saved logs here.
        </div>
      )}
    </div>
  );
}
