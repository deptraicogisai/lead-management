"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Check, Copy, ExternalLink, FileText, Filter, Link2, MessageSquareText, ScrollText, TreePine, VolumeX } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useBreadcrumbLabel } from "@/components/layout/breadcrumb-context";
import { BuyerHttpLogSidebar } from "@/components/logs/buyer-http-log-sidebar";
import { PageTabBar } from "@/components/ui/page-tab-bar";
import { SectionLoading } from "@/components/ui/loading-indicator";
import { PageSection } from "@/components/ui/state";
import { ScrollableTableShell } from "@/components/ui/scrollable-table-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { useSystemSettings } from "@/components/settings/system-settings-context";
import { resolveBuyerHttpExchangeFromLog } from "@/lib/buyer-http-log";
import type {
  LeadDetailFilterLogRow,
  LeadDetailFilterProcessingKey,
  LeadDetailRecord,
  LeadDetailTab,
} from "@/lib/lead-detail";
import { formatRedirectClickDateLabel } from "@/lib/lead-detail";
import { cn } from "@/lib/utils";
import { formatDateDisplay, formatDateTimeDisplay } from "@/lib/date-range";

function formatFilterLogDateCell(row: LeadDetailFilterLogRow, timeZone: string) {
  if (row.date) {
    return formatDateDisplay(row.date, timeZone);
  }

  const trimmed = row.dateLabel.trim();
  if (!trimmed || trimmed === "—") {
    return trimmed;
  }

  const slashDate = trimmed.match(/^(\d{2}\/\d{2}\/\d{4})/);
  return slashDate ? slashDate[1] : trimmed;
}

const DETAIL_TABS = [
  { id: "lead-body" as const, label: "Lead body", icon: FileText },
  { id: "redirect" as const, label: "Redirect", icon: Link2 },
  { id: "filter-log" as const, label: "Filter log", icon: Filter },
];

function filterProcessingTabIcon(key: string): LucideIcon {
  if (key === "Silent") return VolumeX;
  if (key === "Exit Page" || key === "Exit Offer List") return ExternalLink;
  return TreePine;
}

const FILTER_LOG_COLGROUP = (
  <colgroup>
    <col className="w-[12%]" />
    <col className="w-[11%]" />
    <col className="w-[12%]" />
    <col className="w-[9%]" />
    <col className="w-[9%]" />
    <col className="w-[11%]" />
    <col className="w-[6%]" />
    <col className="w-[8%]" />
    <col className="w-[10%]" />
    <col className="w-[12%]" />
  </colgroup>
);

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-2 border-b border-slate-200 py-2.5 text-sm last:border-b-0 dark:border-slate-700">
      <dt className="font-medium text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="min-w-0 break-words text-slate-800 dark:text-slate-100">{children}</dd>
    </div>
  );
}

function CopyableValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <span className="inline-flex max-w-full items-center gap-1.5">
      <span className="truncate font-mono text-xs sm:text-sm">{value}</span>
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
        title="Copy"
      >
        {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
      </button>
    </span>
  );
}

function FilterLogMessageCell({ message }: { message: string }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const trimmed = message.trim();
  const hasMessage = Boolean(trimmed) && trimmed !== "—";

  const updatePosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const popoverWidth = 280;
    const gap = 8;
    // Anchor to top-right of the icon.
    const preferredLeft = rect.right - popoverWidth;
    const left = Math.min(
      Math.max(12, preferredLeft),
      window.innerWidth - popoverWidth - 12
    );
    setPosition({
      top: Math.max(12, rect.top - gap),
      left,
    });
  }, []);

  useEffect(() => {
    if (!open) return;

    updatePosition();

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const handleReposition = () => updatePosition();

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open, updatePosition]);

  if (!hasMessage) {
    return <span className="text-slate-400 dark:text-slate-500">—</span>;
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-full transition",
          open
            ? "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300"
            : "text-sky-600 hover:bg-sky-50 hover:text-sky-700 dark:text-sky-400 dark:hover:bg-sky-500/15 dark:hover:text-sky-300"
        )}
        title="View message"
        aria-label="View message"
        aria-expanded={open}
      >
        <MessageSquareText size={16} strokeWidth={1.75} />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              style={{ top: position.top, left: position.left }}
              className="fixed z-[120] w-[280px] -translate-y-full rounded-xl border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-700 shadow-xl dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            >
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Reason
              </p>
              <p className="break-words">{trimmed}</p>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function FilterLogDetailRow({
  row,
  onOpenLog,
}: {
  row: LeadDetailFilterLogRow;
  onOpenLog: (row: LeadDetailFilterLogRow) => void;
}) {
  const { timeZone } = useSystemSettings();
  const statusNormalized = row.status.trim().toLowerCase();
  const showMessageIcon =
    statusNormalized.includes("reject") ||
    statusNormalized === "skipped" ||
    statusNormalized === "disabled";

  return (
    <tr
      className={cn(
        "border-t border-slate-200 dark:border-slate-700",
        row.campaignDisabled
          ? "bg-slate-100/90 text-slate-500 dark:bg-slate-800/70 dark:text-slate-400"
          : statusNormalized === "accept"
            ? "bg-emerald-50/70 dark:bg-emerald-500/10"
            : undefined
      )}
    >
      <td className="whitespace-nowrap px-4 py-2.5 align-middle tabular-nums text-slate-700 dark:text-slate-200">
        {formatFilterLogDateCell(row, timeZone)}
      </td>
      <td className="w-[11rem] max-w-[11rem] px-4 py-2.5 align-middle text-slate-800 dark:text-slate-100">
        <span className="line-clamp-2 break-words" title={row.buyerLabel}>
          {row.buyerLabel}
        </span>
      </td>
      <td className="w-[12rem] max-w-[12rem] px-4 py-2.5 align-middle">
        {row.campaignId ? (
          <Link
            href={`/campaigns/${encodeURIComponent(row.campaignId)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "line-clamp-2 break-words font-medium hover:underline",
              row.campaignDisabled
                ? "text-slate-500 dark:text-slate-400"
                : "text-blue-700 dark:text-blue-300"
            )}
            title={row.campaignLabel}
          >
            {row.campaignLabel}
          </Link>
        ) : (
          <span className="line-clamp-2 break-words" title={row.campaignLabel}>
            {row.campaignLabel}
          </span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 align-middle tabular-nums text-slate-700 dark:text-slate-200">
        {row.postPrice}
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 align-middle tabular-nums text-slate-700 dark:text-slate-200">
        {row.soldPrice}
      </td>
      <td className="px-4 py-2.5 align-middle">
        <span className="relative inline-flex max-w-full items-start pt-2.5 pr-2">
          {row.status.trim() && row.status.trim() !== "—" ? (
            <StatusBadge status={row.status} />
          ) : (
            <span className="text-slate-400 dark:text-slate-500">—</span>
          )}
          {row.offeredPriceLabel ? (
            <span className="absolute right-0 top-0 rounded border border-amber-200 bg-amber-50 px-1 py-px text-[11px] font-semibold leading-none text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
              {row.offeredPriceLabel}
            </span>
          ) : null}
        </span>
      </td>
      <td className="px-4 py-2.5 align-middle text-center">
        {showMessageIcon ? (
          <FilterLogMessageCell message={row.message} />
        ) : (
          <span className="text-slate-400 dark:text-slate-500">—</span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 align-middle tabular-nums text-slate-700 dark:text-slate-200">
        {row.timeLabel}
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 align-middle text-slate-400 dark:text-slate-500">—</td>
      <td className="whitespace-nowrap px-4 py-2.5 align-middle">
        {row.hasDelivery ? (
          <button
            type="button"
            onClick={() => onOpenLog(row)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-600 bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            <ScrollText size={12} className="shrink-0" />
            Log
          </button>
        ) : (
          <span className="text-slate-400 dark:text-slate-500">—</span>
        )}
      </td>
    </tr>
  );
}

export function LeadDetailPage() {
  const { timeZone } = useSystemSettings();
  const params = useParams<{ id: string }>();
  const leadIdParam = typeof params?.id === "string" ? params.id : "";
  const [lead, setLead] = useState<LeadDetailRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<LeadDetailTab>("lead-body");
  const [filterProcessingKey, setFilterProcessingKey] = useState<LeadDetailFilterProcessingKey>("");
  const [logRow, setLogRow] = useState<LeadDetailFilterLogRow | null>(null);
  const [postedExpanded, setPostedExpanded] = useState(true);
  const filterMainScrollRef = useRef<HTMLDivElement>(null);
  const filterTopScrollRef = useRef<HTMLDivElement>(null);
  const filterHeaderShiftRef = useRef<HTMLDivElement>(null);
  const filterTopSpacerRef = useRef<HTMLDivElement>(null);
  const filterBodyInnerRef = useRef<HTMLDivElement>(null);
  const [filterHasHOverflow, setFilterHasHOverflow] = useState(false);
  const [filterContentWidth, setFilterContentWidth] = useState(0);

  useBreadcrumbLabel(lead ? lead.publicLeadId : "Lead Detail");

  const filterSections = lead?.filterProcessing ?? [];
  const availableFilterTabs = useMemo(
    () =>
      filterSections.map((section) => ({
        id: section.key,
        label: section.label,
        icon: filterProcessingTabIcon(section.key),
      })),
    [filterSections]
  );
  const activeFilterSection =
    filterSections.find((section) => section.key === filterProcessingKey) ?? filterSections[0] ?? null;

  // Header clips + translateX; top bar sits under header; top/bottom sync by ratio.
  useLayoutEffect(() => {
    if (activeTab !== "filter-log") return;

    const main = filterMainScrollRef.current;
    const top = filterTopScrollRef.current;
    const headerShift = filterHeaderShiftRef.current;
    const spacer = filterTopSpacerRef.current;
    const bodyInner = filterBodyInnerRef.current;
    if (!main || !top || !headerShift || !spacer || !bodyInner) return;

    let syncing = false;
    let unlockFrame: number | null = null;
    let lastRatio = 0;

    const maxScroll = (node: HTMLElement) => Math.max(0, node.scrollWidth - node.clientWidth);

    const applyHeader = (mainLeft: number) => {
      headerShift.style.transform = `translate3d(${-Math.max(0, mainLeft)}px, 0, 0)`;
    };

    const applyRatio = (ratio: number, source?: HTMLElement) => {
      const clamped = Math.min(1, Math.max(0, ratio));
      lastRatio = clamped;
      for (const node of [main, top]) {
        if (node === source) continue;
        const next = clamped * maxScroll(node);
        if (Math.abs(node.scrollLeft - next) > 0.5) node.scrollLeft = next;
      }
      applyHeader(clamped * maxScroll(main));
    };

    const measure = () => {
      const previousRatio = lastRatio;
      headerShift.style.transform = "translate3d(0, 0, 0)";

      const width = Math.ceil(
        Math.max(bodyInner.scrollWidth, headerShift.scrollWidth, main.clientWidth)
      );
      bodyInner.style.width = `${width}px`;
      bodyInner.style.minWidth = `${width}px`;
      headerShift.style.width = `${width}px`;
      headerShift.style.minWidth = `${width}px`;
      spacer.style.width = `${width}px`;
      spacer.style.minWidth = `${width}px`;
      setFilterContentWidth(width);

      const overflow = width > main.clientWidth + 1;
      top.style.height = overflow ? "14px" : "0px";
      top.style.borderBottomWidth = overflow ? "1px" : "0px";
      top.style.opacity = overflow ? "1" : "0";
      top.style.pointerEvents = overflow ? "auto" : "none";
      setFilterHasHOverflow(overflow);

      syncing = true;
      applyRatio(previousRatio);
      requestAnimationFrame(() => {
        syncing = false;
      });
    };

    const syncFrom = (source: HTMLElement) => {
      if (syncing) return;
      syncing = true;
      const max = maxScroll(source);
      applyRatio(max > 0 ? source.scrollLeft / max : 0, source);
      if (unlockFrame != null) cancelAnimationFrame(unlockFrame);
      unlockFrame = requestAnimationFrame(() => {
        unlockFrame = requestAnimationFrame(() => {
          syncing = false;
          unlockFrame = null;
        });
      });
    };

    const onMainScroll = () => syncFrom(main);
    const onTopScroll = () => syncFrom(top);

    measure();
    main.addEventListener("scroll", onMainScroll, { passive: true });
    top.addEventListener("scroll", onTopScroll, { passive: true });

    const observer = new ResizeObserver(() => measure());
    observer.observe(main);
    observer.observe(top);
    observer.observe(bodyInner);
    observer.observe(headerShift);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);

    return () => {
      main.removeEventListener("scroll", onMainScroll);
      top.removeEventListener("scroll", onTopScroll);
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      if (unlockFrame != null) cancelAnimationFrame(unlockFrame);
    };
  }, [
    activeTab,
    postedExpanded,
    activeFilterSection?.key,
    lead?.id,
    activeFilterSection?.rows?.length,
    activeFilterSection?.postedRows?.length,
  ]);
  useEffect(() => {
    if (!lead) return;
    const sections = lead.filterProcessing ?? [];
    if (sections.length === 0) return;
    if (!sections.some((section) => section.key === filterProcessingKey)) {
      setFilterProcessingKey(sections[0].key);
    }
  }, [lead, filterProcessingKey]);

  const loadLead = useCallback(async () => {
    if (!leadIdParam) return;
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/leads/${encodeURIComponent(leadIdParam)}`);
      const data = (await response.json().catch(() => null)) as LeadDetailRecord | { message?: string } | null;
      if (!response.ok) {
        setLead(null);
        setError((data as { message?: string } | null)?.message ?? "Failed to load lead.");
        return;
      }
      setLead(data as LeadDetailRecord);
    } catch {
      setLead(null);
      setError("Failed to load lead.");
    } finally {
      setIsLoading(false);
    }
  }, [leadIdParam]);

  useEffect(() => {
    void loadLead();
  }, [loadLead]);

  if (isLoading) {
    return <SectionLoading message="Loading lead detail..." />;
  }

  if (error || !lead) {
    return (
      <PageSection title="Lead Detail">
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
          {error || "Lead not found."}
        </div>
        <div className="mt-4">
          <Link href="/reports/publisher/lead-details" className="text-sm font-medium text-blue-700 hover:underline dark:text-blue-300">
            Back to Publisher Lead Details
          </Link>
        </div>
      </PageSection>
    );
  }

  return (
    <>
    <PageSection title={`Lead ${lead.publicLeadId}`}>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="flex min-h-[min(72vh,44rem)] flex-col lg:grid lg:min-h-[640px] lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="border-b border-slate-200 bg-slate-50/80 lg:border-b-0 lg:border-r dark:border-slate-700 dark:bg-slate-900/60">
            <div className="sticky top-0 p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Lead Info</h2>
              <dl>
                <InfoRow label="Public Lead ID">
                  <CopyableValue value={lead.publicLeadId} />
                </InfoRow>
                <InfoRow label="ID">{lead.sequenceId}</InfoRow>
                <InfoRow label="Date">
                  {formatDateTimeDisplay(lead.postedAt, timeZone)}
                </InfoRow>
                <InfoRow label="Product">{lead.productLabel}</InfoRow>
                <InfoRow label="Status">
                  <StatusBadge status={lead.statusLabel} />
                </InfoRow>
                <InfoRow label="Redirect">{lead.redirectLabel || "—"}</InfoRow>
                <InfoRow label="Publisher">{lead.publisherLabel}</InfoRow>
                <InfoRow label="Publisher Channel">{lead.publisherChannel}</InfoRow>
                <InfoRow label="Publisher Source">{lead.publisherSource}</InfoRow>
                <InfoRow label="Method">{lead.method}</InfoRow>
                <InfoRow label="Buyer">{lead.buyerLabel || "—"}</InfoRow>
                <InfoRow label="ADM">
                  <span className="tabular-nums">{lead.adm}</span>
                </InfoRow>
                <InfoRow label="TTL">
                  <span className="tabular-nums">{lead.ttl}</span>
                </InfoRow>
              </dl>
            </div>
          </aside>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-slate-200 p-4 dark:border-slate-700">
              <PageTabBar tabs={DETAIL_TABS} activeTabId={activeTab} onTabChange={setActiveTab} />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 md:p-6">
              {activeTab === "lead-body" ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Lead body</h3>
                  <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs font-extrabold text-slate-700 dark:bg-slate-800 dark:text-slate-100">
                        <tr>
                          <th className="px-4 py-3">Field</th>
                          <th className="px-4 py-3">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lead.fields.length === 0 ? (
                          <tr>
                            <td colSpan={2} className="px-4 py-8 text-center text-slate-500">
                              No lead fields available.
                            </td>
                          </tr>
                        ) : (
                          lead.fields.map((row) => (
                            <tr key={row.field} className="border-t border-slate-200 dark:border-slate-700">
                              <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-200">{row.field}</td>
                              <td className="px-4 py-2.5 break-all text-slate-800 dark:text-slate-100">{row.value || "—"}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {activeTab === "redirect" ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Redirect</h3>
                  <ScrollableTableShell
                    rowCount={(lead.redirects ?? []).length}
                    className="rounded-xl shadow-none"
                    tableClassName="min-w-max"
                    thead={
                      <tr className="text-left text-xs font-extrabold text-slate-700 dark:text-slate-100">
                        <th className="whitespace-nowrap px-4 py-3">Date</th>
                        <th className="whitespace-nowrap px-4 py-3">Click Date</th>
                        <th className="whitespace-nowrap px-4 py-3">Campaign</th>
                        <th className="whitespace-nowrap px-4 py-3">Client IP</th>
                        <th className="whitespace-nowrap px-4 py-3">Status</th>
                        <th className="min-w-[14rem] px-4 py-3">Redirect url</th>
                        <th className="min-w-[10rem] px-4 py-3">Referrer</th>
                        <th className="min-w-[14rem] px-4 py-3">User Agent</th>
                      </tr>
                    }
                  >
                    <tbody>
                      {(lead.redirects ?? []).length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                            No redirect records for this lead.
                          </td>
                        </tr>
                      ) : (
                        (lead.redirects ?? []).map((row, index) => (
                          <tr
                            key={`${row.redirectUrl}-${row.clickDate}-${index}`}
                            className="border-t border-slate-200 align-top dark:border-slate-700"
                          >
                            <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-700 dark:text-slate-200">
                              {formatDateTimeDisplay(row.date, timeZone)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-700 dark:text-slate-200">
                              {row.clickDate
                                ? formatRedirectClickDateLabel(row.clickDate, row.date, timeZone)
                                : "—"}
                            </td>
                            <td className="px-4 py-3">
                              {row.campaignId ? (
                                <Link
                                  href={`/campaigns/${encodeURIComponent(row.campaignId)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium text-blue-700 hover:underline dark:text-blue-300"
                                >
                                  {row.campaignName}
                                </Link>
                              ) : (
                                <span className="text-slate-700 dark:text-slate-200">{row.campaignName}</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-200">
                              {row.clientIp}
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={row.status} />
                            </td>
                            <td className="px-4 py-3">
                              {row.redirectUrl ? (
                                <div className="space-y-2">
                                  <p className="break-all text-slate-800 dark:text-slate-100">{row.redirectUrl}</p>
                                  <a
                                    href={row.redirectUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-400 dark:hover:bg-blue-900/40 dark:hover:text-blue-300"
                                  >
                                    <ExternalLink size={12} />
                                    Open URL
                                  </a>
                                </div>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {row.referrer ? (
                                <div className="space-y-2">
                                  <p className="break-all text-slate-800 dark:text-slate-100">{row.referrerLabel}</p>
                                  <a
                                    href={row.referrer.includes("://") ? row.referrer : `https://${row.referrer}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-400 dark:hover:bg-blue-900/40 dark:hover:text-blue-300"
                                  >
                                    <ExternalLink size={12} />
                                    Open URL
                                  </a>
                                </div>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-4 py-3 break-all text-slate-700 dark:text-slate-200">{row.userAgent}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </ScrollableTableShell>
                </div>
              ) : null}

              {activeTab === "filter-log" ? (
                <div className="space-y-4">
                  {availableFilterTabs.length > 0 ? (
                    <PageTabBar
                      tabs={availableFilterTabs}
                      activeTabId={activeFilterSection?.key ?? availableFilterTabs[0].id}
                      onTabChange={(key) => {
                        setFilterProcessingKey(key);
                        setPostedExpanded(true);
                      }}
                    />
                  ) : null}

                  {activeFilterSection ? (
                    <div className="space-y-3">
                      {(() => {
                        const treeValue = activeFilterSection.pingTreeLabel.replace(/^Ping Tree:\s*/i, "");
                        const match = treeValue.match(/^(.*?)(\s*\[\d+\])\s*$/);
                        const title = match?.[1]?.trim() || treeValue;
                        const index = match?.[2]?.trim() || "";
                        return (
                          <p className="text-lg font-semibold tracking-tight text-slate-800 dark:text-slate-100">
                            <span className="font-medium text-slate-500 dark:text-slate-400">Ping Tree:</span>{" "}
                            <span>{title}</span>
                            {index ? (
                              <span className="ml-1.5 font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                                {index}
                              </span>
                            ) : null}
                          </p>
                        );
                      })()}

                      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                        {/* Sticky header band: clipped + translated with body scroll */}
                        <div className="overflow-hidden">
                          <div
                            ref={filterHeaderShiftRef}
                            className="will-change-transform"
                            style={{
                              width: filterContentWidth > 0 ? filterContentWidth : undefined,
                              minWidth: "64rem",
                            }}
                          >
                            <table className="w-full table-fixed text-sm">
                              {FILTER_LOG_COLGROUP}
                              <thead className="bg-slate-50 text-left text-xs font-extrabold normal-case tracking-normal text-slate-700 dark:bg-slate-800 dark:text-slate-100">
                                <tr>
                                  <th className="whitespace-nowrap px-4 py-3">Date</th>
                                  <th className="px-4 py-3">Buyer</th>
                                  <th className="px-4 py-3">Campaign</th>
                                  <th className="whitespace-nowrap px-4 py-3">Post price</th>
                                  <th className="whitespace-nowrap px-4 py-3">Sold price</th>
                                  <th className="whitespace-nowrap px-4 py-3">Status</th>
                                  <th className="px-4 py-3">Message</th>
                                  <th className="whitespace-nowrap px-4 py-3">Time</th>
                                  <th className="whitespace-nowrap px-4 py-3">Pre-ping time</th>
                                  <th className="whitespace-nowrap px-4 py-3">Log</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="border-t border-amber-200/80 bg-amber-50/80 dark:border-amber-500/20 dark:bg-amber-500/10">
                                  <td className="px-4 py-2.5 align-middle">
                                    <span className="inline-flex whitespace-nowrap items-center rounded-md border border-emerald-700 bg-transparent px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-500 dark:text-emerald-300">
                                      Campaigns: {activeFilterSection.campaignCount}
                                    </span>
                                  </td>
                                  <td colSpan={8} className="px-4 py-2.5" />
                                  <td className="whitespace-nowrap px-4 py-2.5 align-middle">
                                    <button
                                      type="button"
                                      onClick={() => setPostedExpanded((current) => !current)}
                                      aria-expanded={postedExpanded}
                                      className={cn(
                                        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded border bg-white px-2 py-1 text-xs font-medium tabular-nums transition-colors hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-900/30",
                                        postedExpanded
                                          ? "border-emerald-700 text-emerald-800 dark:border-emerald-400 dark:text-emerald-300"
                                          : "border-emerald-600 text-emerald-700 dark:border-emerald-500 dark:text-emerald-300"
                                      )}
                                    >
                                      <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[2px] border border-current text-[10px] font-bold leading-none transition-transform duration-200">
                                        {postedExpanded ? "−" : "+"}
                                      </span>
                                      <span>Posted : {activeFilterSection.postedCount}</span>
                                    </button>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Top H-scrollbar under header */}
                        <div
                          ref={filterTopScrollRef}
                          className="table-scroll-top shrink-0 overflow-x-auto overflow-y-hidden overscroll-x-contain border-b border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
                          style={{ height: 0, borderBottomWidth: 0, opacity: 0 }}
                          aria-hidden={!filterHasHOverflow}
                        >
                          <div
                            ref={filterTopSpacerRef}
                            style={{
                              width: filterContentWidth > 0 ? filterContentWidth : "64rem",
                              minWidth: "64rem",
                              height: 1,
                            }}
                          />
                        </div>

                        <div
                          className={cn(
                            "grid transition-[grid-template-rows] duration-300 ease-out",
                            postedExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                          )}
                        >
                          <div className="min-h-0 overflow-hidden">
                            <div
                              ref={filterMainScrollRef}
                              className={cn(
                                "table-scroll-thin overflow-x-auto overscroll-x-contain border-t border-slate-200 transition-opacity duration-300 ease-out dark:border-slate-700",
                                postedExpanded ? "opacity-100" : "opacity-0"
                              )}
                            >
                              <div
                                ref={filterBodyInnerRef}
                                style={{
                                  width: filterContentWidth > 0 ? filterContentWidth : undefined,
                                  minWidth: "64rem",
                                }}
                              >
                                <table className="w-full table-fixed text-sm">
                                  {FILTER_LOG_COLGROUP}
                                  <tbody>
                                    {(activeFilterSection.rows ?? activeFilterSection.postedRows).length > 0 ? (
                                      (activeFilterSection.rows ?? activeFilterSection.postedRows).map((row) => (
                                        <FilterLogDetailRow
                                          key={`filter-${row.id}`}
                                          row={row}
                                          onOpenLog={setLogRow}
                                        />
                                      ))
                                    ) : (
                                      <tr>
                                        <td
                                          colSpan={10}
                                          className="px-4 py-6 text-center text-slate-500 dark:text-slate-400"
                                        >
                                          No campaigns in this processing tree.
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300">
                      This lead was not posted to any processing tab.
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </PageSection>

    <BuyerHttpLogSidebar
      open={Boolean(logRow)}
      onClose={() => setLogRow(null)}
      title={logRow ? `Buyer Post Log — ${lead.publicLeadId}` : "Buyer Post Log"}
      subtitle={
        logRow
          ? `${logRow.campaignLabel} | ${activeFilterSection?.label ?? "Processing"} | ${logRow.buyerLabel}`
          : undefined
      }
      postedAt={
        logRow?.date
          ? formatDateTimeDisplay(logRow.date, timeZone)
          : logRow?.dateLabel && logRow.dateLabel !== "—"
            ? formatDateTimeDisplay(logRow.dateLabel, timeZone)
            : undefined
      }
      buyerStatus={logRow?.status}
      httpStatus={logRow?.httpStatus}
      postLeadUrl={logRow?.postLeadUrl}
      log={
        logRow
          ? resolveBuyerHttpExchangeFromLog({
              requestPayload: logRow.requestPayload,
              responseBody: logRow.responseBody,
              responseHeaders: logRow.responseHeaders,
              httpStatus: logRow.httpStatus,
              errorMessage: logRow.errorReason || logRow.rejectReason,
            })
          : { request: null, response: null }
      }
    />
    </>
  );
}
