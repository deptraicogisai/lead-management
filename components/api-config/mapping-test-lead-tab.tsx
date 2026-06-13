"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Checkbox, FieldLabel, Input, PrimaryButton, Select } from "@/components/ui/form-controls";
import { FilterTagBadges } from "@/components/ui/filter-tag-input";
import { Spinner } from "@/components/ui/state";
import { getCodeTokenClassName, tokenizeJson } from "@/lib/api-documentation-content";
import type { MappingTestLeadLogRecord } from "@/lib/mapping-test-lead-log";
import type { TestLeadIntakeRuleGroup, TestLeadValidationCheck } from "@/lib/mapping-test-lead-intake";
import {
  buildEmptyTestLeadForm,
  buildRandomTestLeadForm,
  buildTestLeadPayload,
  chunkTestLeadFields,
  formatTestLeadOptionLabel,
  formatTestLeadOptionSelectValue,
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

function getFieldInputType(field: MappingTestLeadField) {
  const normalizedType = field.type.trim().toLowerCase();
  const normalizedFormat = field.format?.trim().toLowerCase() ?? "";

  if (normalizedType === "email" || normalizedFormat === "email") return "email";
  if (normalizedType === "date") return "date";
  if (normalizedType === "number" || normalizedType === "numeric" || normalizedType === "numberic") return "number";
  return "text";
}

function TestLeadFieldControl({
  field,
  value,
  onChange,
  allowedTokens,
}: {
  field: MappingTestLeadField;
  value: string;
  onChange: (value: string) => void;
  allowedTokens?: string[];
}) {
  const inputId = `test-lead-${field.fieldName}`;
  const label = field.description?.trim() || field.fieldName;
  const normalizedType = field.type.trim().toLowerCase();

  if (field.options.length > 0) {
    return (
      <div>
        <FieldLabel htmlFor={inputId} label={label} required={field.required} />
        <Select id={inputId} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select {label}</option>
          {field.options.map((option) => {
            const optionValue = formatTestLeadOptionSelectValue(option, field);
            return (
              <option key={`${field.fieldName}-${optionValue}-${option.label}`} value={optionValue}>
                {formatTestLeadOptionLabel(option, field)}
              </option>
            );
          })}
        </Select>
      </div>
    );
  }

  if (normalizedType === "boolean") {
    return (
      <div>
        <FieldLabel htmlFor={inputId} label={label} required={field.required} />
        <Select id={inputId} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select {label}</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </Select>
      </div>
    );
  }

  return (
    <div>
      <FieldLabel htmlFor={inputId} label={label} required={field.required} />
      {allowedTokens && allowedTokens.length > 0 ? (
        <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
          Must contain one of:
        </p>
      ) : null}
      {allowedTokens && allowedTokens.length > 0 ? <FilterTagBadges values={allowedTokens} className="mb-2" /> : null}
      <Input
        id={inputId}
        type={getFieldInputType(field)}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.fieldName}
      />
    </div>
  );
}

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
}: {
  intakeRules: TestLeadIntakeRuleGroup[];
  timezone?: string;
}) {
  const activeGroups = intakeRules.filter((group) => group.rules.length > 0);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Intake Rules Checked</h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        Test lead validates field configuration, duplicates, filters, and schedule before posting.
        {timezone ? ` Timezone: ${timezone}.` : null}
      </p>

      {activeGroups.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No duplicate, filter, or schedule rules are configured.</p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
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

function ValidationChecksPanel({ checks }: { checks: TestLeadValidationCheck[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Validation Results</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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

function TestLeadLogDetail({ log, endpointUrl }: { log: MappingTestLeadLogRecord; endpointUrl: string }) {
  const isSuccess = log.status >= 200 && log.status < 300;

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "rounded-2xl border p-4 text-sm",
          isSuccess
            ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10"
            : "border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10"
        )}
      >
        <p className="font-medium text-slate-800 dark:text-slate-100">
          Submitted: {formatLogTimestamp(log.submittedAt).full}
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-slate-700 dark:text-slate-200">
          <span>HTTP Status:</span>
          <span
            className={cn(
              "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold text-white",
              isSuccess ? "bg-emerald-700 dark:bg-emerald-600" : "bg-red-700 dark:bg-red-600"
            )}
          >
            {log.status}
          </span>
          <span>{isSuccess ? "Success" : "Failed"}</span>
          <span className="text-slate-500 dark:text-slate-400">
            {log.saveLead ? (log.leadSaved ? "Save lead" : "Save lead requested") : "Validation only"}
          </span>
        </p>
      </div>

      <ValidationChecksPanel checks={log.validationChecks} />

      <JsonLogPanel
        title="Request"
        tone="request"
        data={{
          method: "POST",
          url: log.endpointUrl || endpointUrl,
          body: log.requestBody,
        }}
      />

      <JsonLogPanel
        title="Response"
        tone={isSuccess ? "success" : "error"}
        data={log.responseBody}
      />
    </div>
  );
}

export function MappingTestLeadTab({ sellerId, mappingId, apiName, fields }: MappingTestLeadTabProps) {
  const [activeView, setActiveView] = useState<TestLeadView>("form");
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [saveLead, setSaveLead] = useState(false);
  const [endpointUrl, setEndpointUrl] = useState("/api/lead");
  const [timezone, setTimezone] = useState("");
  const [intakeRules, setIntakeRules] = useState<TestLeadIntakeRuleGroup[]>([]);
  const [multiSelectFilters, setMultiSelectFilters] = useState<Record<string, string[]>>({});
  const [logs, setLogs] = useState<MappingTestLeadLogRecord[]>([]);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const updateFieldValue = (fieldName: string, value: string) => {
    setFormValues((current) => ({ ...current, [fieldName]: value }));
  };

  const handlePrefill = () => {
    setFormValues(buildRandomTestLeadForm(fields, multiSelectFilters));
    toast.success("Form prefilled with random sample values.");
  };

  const handleReset = () => {
    setFormValues(buildEmptyTestLeadForm(fields));
  };

  const handleSubmit = async () => {
    const requestBody = buildTestLeadPayload(fields, formValues);

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/sellers/${encodeURIComponent(sellerId)}/verticals/mappings/${encodeURIComponent(mappingId)}/test-lead`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: requestBody, saveLead }),
        }
      );

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
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingContext) {
    return (
      <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
        <Spinner />
        <span>Loading test lead form...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
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

        {activeView === "form" ? (
          <div className="flex shrink-0 flex-nowrap items-center gap-3">
            <button
              type="button"
              onClick={handlePrefill}
              className="shrink-0 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              Prefill Sample Values
            </button>
            <Checkbox
              id="test-lead-save-lead"
              checked={saveLead}
              onChange={setSaveLead}
              label="Save lead"
              className="w-auto shrink-0 whitespace-nowrap"
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
              Validate against duplicates, filters, and schedule. Enable save only when you want this test lead stored.
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
