"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, PartyPopper, Server, UserRound } from "lucide-react";
import { JsonLogPanel, type JsonLogPanelTone } from "@/components/logs/json-log-panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

export type LeadGetLogHopId =
  | "publisher-request"
  | "buyer-request"
  | "buyer-response"
  | "publisher-response";

export type LeadGetLogCampaignStep = {
  id: string;
  order: number;
  campaignLabel: string;
  buyerLabel: string;
  processingKey: string;
  processingLabel: string;
  pingTreeLabel: string;
  silentPostingMode: string;
  status: string;
  hasDelivery: boolean;
  wasPosted: boolean;
  campaignDisabled: boolean;
  message: string;
  requestBody: unknown;
  responseBody: unknown;
  responseTone: JsonLogPanelTone;
};

type LeadGetLogHop = {
  id: LeadGetLogHopId;
  step: number;
  from: FlowActor;
  to: FlowActor;
  kind: "request" | "response";
  title: string;
  description: string;
  emptyMessage: string;
  tone: JsonLogPanelTone;
};

type LeadGetLogFlowProps = {
  publisherRequest: unknown;
  publisherResponse: unknown;
  campaigns: LeadGetLogCampaignStep[];
  apiType?: "Redirect" | "Silent";
  /** Lead-level outcome status (Sold, Reject, …). */
  leadStatus?: string;
};

type FlowActor = "Publisher" | "System" | "Buyer";

const ACTORS = [
  { id: "Publisher" as const, label: "Publisher", icon: UserRound },
  { id: "System" as const, label: "System", icon: Server },
  { id: "Buyer" as const, label: "Buyer", icon: UserRound },
];

function hopMatchesEdge(
  hop: LeadGetLogHop | null,
  left: FlowActor,
  right: FlowActor,
  kind: "request" | "response"
) {
  if (!hop || hop.kind !== kind) return false;
  if (kind === "request") return hop.from === left && hop.to === right;
  return hop.from === right && hop.to === left;
}

function edgeHopStep(left: FlowActor, kind: "request" | "response") {
  if (left === "Publisher") {
    return kind === "request" ? 1 : 4;
  }
  // System ↔ Buyer
  return kind === "request" ? 2 : 3;
}

function EdgeStepBadge({
  step,
  kind,
  active,
  skipped,
}: {
  step: number;
  kind: "request" | "response";
  active: boolean;
  skipped: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-[11px] font-extrabold tabular-nums leading-none",
        skipped
          ? "bg-slate-200 text-slate-600 ring-1 ring-slate-300/80 dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-500"
          : active
            ? "bg-white text-slate-900 shadow-sm ring-1 ring-black/10"
            : kind === "request"
              ? "bg-sky-700 text-white ring-1 ring-sky-800/30 dark:bg-sky-400 dark:text-slate-950 dark:ring-sky-200/40"
              : "bg-emerald-700 text-white ring-1 ring-emerald-800/30 dark:bg-emerald-400 dark:text-slate-950 dark:ring-emerald-200/40"
      )}
      aria-label={`Step ${step}`}
    >
      {step}
    </span>
  );
}

function pickDefaultCampaignId(campaigns: LeadGetLogCampaignStep[]) {
  return (
    campaigns.find((campaign) => campaign.wasPosted && campaign.status === "Accept")?.id ??
    campaigns.find((campaign) => campaign.wasPosted)?.id ??
    campaigns[0]?.id ??
    ""
  );
}

export function LeadGetLogFlow({
  publisherRequest,
  publisherResponse,
  campaigns,
  apiType = "Redirect",
  leadStatus = "",
}: LeadGetLogFlowProps) {
  const isSold = leadStatus.trim().toLowerCase() === "sold";
  const reachedBuyer = useMemo(
    () => campaigns.some((campaign) => campaign.wasPosted),
    [campaigns]
  );
  const [activeHopId, setActiveHopId] = useState<LeadGetLogHopId>("publisher-request");
  const [selectedCampaignId, setSelectedCampaignId] = useState(() => pickDefaultCampaignId(campaigns));

  useEffect(() => {
    if (!campaigns.some((campaign) => campaign.id === selectedCampaignId)) {
      setSelectedCampaignId(pickDefaultCampaignId(campaigns));
    }
  }, [campaigns, selectedCampaignId]);

  const selectedCampaign =
    campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? campaigns[0] ?? null;

  const campaignGroups = useMemo(() => {
    const groups: Array<{
      key: string;
      label: string;
      pingTreeLabel: string;
      silentPostingMode: string;
      campaigns: LeadGetLogCampaignStep[];
    }> = [];
    const indexByKey = new Map<string, number>();

    for (const campaign of campaigns) {
      const key = campaign.processingKey || campaign.processingLabel || "Other";
      const existing = indexByKey.get(key);
      if (existing == null) {
        indexByKey.set(key, groups.length);
        groups.push({
          key,
          label: campaign.processingLabel || key,
          pingTreeLabel: campaign.pingTreeLabel || "",
          silentPostingMode: campaign.silentPostingMode || "",
          campaigns: [campaign],
        });
      } else {
        groups[existing].campaigns.push(campaign);
      }
    }

    return groups;
  }, [campaigns]);

  const hops = useMemo<LeadGetLogHop[]>(
    () => [
      {
        id: "publisher-request",
        step: 1,
        from: "Publisher",
        to: "System",
        kind: "request",
        title: "Publisher → System",
        description: "Request the publisher sent to our system.",
        emptyMessage: "No publisher request payload was recorded.",
        tone: "request",
      },
      {
        id: "buyer-request",
        step: 2,
        from: "System",
        to: "Buyer",
        kind: "request",
        title: "System → Buyer",
        description: "Request posted to each campaign / buyer in order.",
        emptyMessage: "No buyer request was recorded for this campaign.",
        tone: "request",
      },
      {
        id: "buyer-response",
        step: 3,
        from: "Buyer",
        to: "System",
        kind: "response",
        title: "Buyer → System",
        description: "Response returned by the selected campaign / buyer.",
        emptyMessage: "No buyer response was recorded for this campaign.",
        tone: selectedCampaign?.responseTone ?? "neutral",
      },
      {
        id: "publisher-response",
        step: 4,
        from: "System",
        to: "Publisher",
        kind: "response",
        title: "System → Publisher",
        description: "Response our system returned to the publisher.",
        emptyMessage: "No publisher response was recorded.",
        tone: publisherResponse ? "success" : "neutral",
      },
    ],
    [publisherResponse, selectedCampaign?.responseTone]
  );

  const activeHop = hops.find((hop) => hop.id === activeHopId) ?? hops[0];
  const showCampaignPicker =
    activeHop.id === "buyer-request" || activeHop.id === "buyer-response";

  const activeData =
    activeHop.id === "publisher-request"
      ? publisherRequest
      : activeHop.id === "publisher-response"
        ? publisherResponse
        : activeHop.id === "buyer-request"
          ? selectedCampaign?.requestBody ?? null
          : selectedCampaign?.responseBody ?? null;

  const activeTone =
    activeHop.id === "buyer-response"
      ? selectedCampaign?.responseTone ?? "neutral"
      : activeHop.tone;

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Exchange flow</h3>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                Publisher → System → campaigns/buyers. Select a step to inspect that exchange.
              </p>
            </div>
            {!reachedBuyer ? (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                Stopped at System
              </span>
            ) : null}
          </div>
        </div>

        <div className="px-3 py-4 sm:px-5">
          <div className="hidden w-full items-stretch md:flex">
            {ACTORS.map((actor, index) => {
              const Icon = actor.icon;
              const active = activeHop.from === actor.id || activeHop.to === actor.id;
              const next = ACTORS[index + 1];
              const buyerSkipped = actor.id === "Buyer" && !reachedBuyer;
              const buyerEdgeSkipped = actor.id === "System" && next?.id === "Buyer" && !reachedBuyer;

              return (
                <div key={actor.id} className="contents">
                  <button
                    type="button"
                    onClick={() => {
                      const related = hops.find((hop) => hop.from === actor.id || hop.to === actor.id);
                      if (related) setActiveHopId(related.id);
                    }}
                    className={cn(
                      "flex min-h-[8rem] min-w-0 flex-1 flex-col items-center justify-center gap-2.5 rounded-2xl border px-4 py-5 transition",
                      buyerSkipped
                        ? "border-slate-200/80 bg-slate-50/60 dark:border-slate-700/70 dark:bg-slate-900/40"
                        : active
                          ? "border-sky-400 bg-sky-50 shadow-sm dark:border-sky-400/60 dark:bg-sky-500/15"
                          : "border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-slate-600"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-14 w-14 items-center justify-center rounded-full",
                        buyerSkipped
                          ? "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                          : active
                            ? "bg-sky-600 text-white dark:bg-sky-500"
                            : "bg-white text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300"
                      )}
                    >
                      <Icon size={26} strokeWidth={1.75} />
                    </span>
                    <span
                      className={cn(
                        "text-[15px] font-semibold tracking-tight",
                        buyerSkipped
                          ? "text-slate-400 dark:text-slate-500"
                          : active
                            ? "text-sky-800 dark:text-sky-200"
                            : "text-slate-800 dark:text-slate-100"
                      )}
                    >
                      {actor.label}
                    </span>
                    {buyerSkipped ? (
                      <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                        No post
                      </span>
                    ) : (
                      <span className="h-4" aria-hidden />
                    )}
                  </button>

                  {next ? (
                    <div className="mx-2 flex w-[6.75rem] shrink-0 flex-col justify-center gap-2 lg:mx-3 lg:w-[8rem]">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveHopId(actor.id === "Publisher" ? "publisher-request" : "buyer-request")
                        }
                        className={cn(
                          "inline-flex items-center justify-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold transition",
                          buyerEdgeSkipped
                            ? "cursor-default bg-transparent text-slate-400 line-through decoration-slate-300 dark:text-slate-500 dark:decoration-slate-600"
                            : hopMatchesEdge(activeHop, actor.id, next.id, "request")
                              ? "bg-sky-600 text-white"
                              : "bg-sky-100 text-sky-700 hover:bg-sky-200 dark:bg-sky-500/20 dark:text-sky-200 dark:hover:bg-sky-500/30"
                        )}
                      >
                        <EdgeStepBadge
                          step={edgeHopStep(actor.id, "request")}
                          kind="request"
                          active={hopMatchesEdge(activeHop, actor.id, next.id, "request")}
                          skipped={buyerEdgeSkipped}
                        />
                        Request
                        <ArrowRight size={12} />
                      </button>
                      <div
                        className={cn(
                          "mx-auto h-px w-full max-w-[3.5rem]",
                          buyerEdgeSkipped
                            ? "border-t border-dashed border-slate-300 dark:border-slate-600"
                            : "bg-slate-200 dark:bg-slate-700"
                        )}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setActiveHopId(
                            actor.id === "Publisher" ? "publisher-response" : "buyer-response"
                          )
                        }
                        className={cn(
                          "inline-flex items-center justify-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold transition",
                          buyerEdgeSkipped
                            ? "cursor-default bg-transparent text-slate-400 line-through decoration-slate-300 dark:text-slate-500 dark:decoration-slate-600"
                            : hopMatchesEdge(activeHop, actor.id, next.id, "response")
                              ? "bg-emerald-600 text-white"
                              : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-200 dark:hover:bg-emerald-500/30"
                        )}
                      >
                        <ArrowLeft size={12} />
                        Response
                        <EdgeStepBadge
                          step={edgeHopStep(actor.id, "response")}
                          kind="response"
                          active={hopMatchesEdge(activeHop, actor.id, next.id, "response")}
                          skipped={buyerEdgeSkipped}
                        />
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="space-y-3 md:hidden">
            {ACTORS.map((actor, index) => {
              const Icon = actor.icon;
              const active = activeHop.from === actor.id || activeHop.to === actor.id;
              const next = ACTORS[index + 1];
              const buyerSkipped = actor.id === "Buyer" && !reachedBuyer;
              const buyerEdgeSkipped = actor.id === "System" && next?.id === "Buyer" && !reachedBuyer;

              return (
                <div key={actor.id} className="space-y-3">
                  <div
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border px-3 py-3",
                      buyerSkipped
                        ? "border-slate-200/80 bg-slate-50/60 dark:border-slate-700/70 dark:bg-slate-900/40"
                        : active
                          ? "border-sky-400 bg-sky-50 dark:border-sky-400/60 dark:bg-sky-500/15"
                          : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full",
                        buyerSkipped
                          ? "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                          : active
                            ? "bg-sky-600 text-white"
                            : "bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300"
                      )}
                    >
                      <Icon size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block text-sm font-semibold",
                          buyerSkipped
                            ? "text-slate-400 dark:text-slate-500"
                            : "text-slate-800 dark:text-slate-100"
                        )}
                      >
                        {actor.label}
                      </span>
                    </div>
                    {buyerSkipped ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        No post
                      </span>
                    ) : null}
                  </div>

                  {next ? (
                    <div className="flex items-center justify-center gap-2 px-2">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveHopId(actor.id === "Publisher" ? "publisher-request" : "buyer-request")
                        }
                        className={cn(
                          "inline-flex flex-1 items-center justify-center gap-1 rounded-full px-2 py-1.5 text-[11px] font-semibold",
                          buyerEdgeSkipped
                            ? "bg-transparent text-slate-400 line-through decoration-slate-300 dark:text-slate-500"
                            : hopMatchesEdge(activeHop, actor.id, next.id, "request")
                              ? "bg-sky-600 text-white"
                              : "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200"
                        )}
                      >
                        <EdgeStepBadge
                          step={edgeHopStep(actor.id, "request")}
                          kind="request"
                          active={hopMatchesEdge(activeHop, actor.id, next.id, "request")}
                          skipped={buyerEdgeSkipped}
                        />
                        Request <ArrowRight size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveHopId(
                            actor.id === "Publisher" ? "publisher-response" : "buyer-response"
                          )
                        }
                        className={cn(
                          "inline-flex flex-1 items-center justify-center gap-1 rounded-full px-2 py-1.5 text-[11px] font-semibold",
                          buyerEdgeSkipped
                            ? "bg-transparent text-slate-400 line-through decoration-slate-300 dark:text-slate-500"
                            : hopMatchesEdge(activeHop, actor.id, next.id, "response")
                              ? "bg-emerald-600 text-white"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
                        )}
                      >
                        <ArrowLeft size={12} /> Response
                        <EdgeStepBadge
                          step={edgeHopStep(actor.id, "response")}
                          kind="response"
                          active={hopMatchesEdge(activeHop, actor.id, next.id, "response")}
                          skipped={buyerEdgeSkipped}
                        />
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {hops.map((hop) => {
          const selected = hop.id === activeHop.id;
          const isBuyerHop = hop.id === "buyer-request" || hop.id === "buyer-response";
          const buyerHopSkipped = isBuyerHop && !reachedBuyer;
          return (
            <button
              key={hop.id}
              type="button"
              onClick={() => setActiveHopId(hop.id)}
              className={cn(
                "rounded-2xl border px-3 py-3 text-left transition",
                buyerHopSkipped
                  ? selected
                    ? "border-slate-300 bg-slate-50 shadow-sm dark:border-slate-600 dark:bg-slate-800/70"
                    : "border-slate-200/80 bg-white/70 opacity-60 hover:opacity-80 dark:border-slate-700/80 dark:bg-slate-900/60"
                  : selected
                    ? hop.kind === "request"
                      ? "border-sky-400 bg-sky-50 shadow-sm dark:border-sky-400/50 dark:bg-sky-500/15"
                      : "border-emerald-400 bg-emerald-50 shadow-sm dark:border-emerald-400/50 dark:bg-emerald-500/15"
                    : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold",
                    buyerHopSkipped
                      ? "bg-slate-300 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                      : selected
                        ? hop.kind === "request"
                          ? "bg-sky-600 text-white"
                          : "bg-emerald-600 text-white"
                        : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                  )}
                >
                  {hop.step}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    buyerHopSkipped
                      ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                      : hop.kind === "request"
                        ? "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
                  )}
                >
                  {hop.kind}
                </span>
                {buyerHopSkipped ? (
                  <span className="ml-auto text-[10px] font-medium text-slate-400 dark:text-slate-500">
                    Skipped
                  </span>
                ) : null}
                {isSold && hop.id === "publisher-response" ? (
                  <span
                    className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                    title="Lead sold"
                  >
                    <PartyPopper size={12} className="shrink-0" />
                    Sold
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-50">{hop.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                {buyerHopSkipped
                  ? "No buyer exchange for this lead."
                  : hop.description}
              </p>
            </button>
          );
        })}
      </section>

      {showCampaignPicker ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                  Campaign processing
                </h3>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  Columns are split by processing type. Campaigns inside each type are listed top →
                  bottom.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                  API type: {apiType}
                </span>
              </div>
            </div>
          </div>

          {campaignGroups.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No campaign processing steps were recorded for this lead.
            </p>
          ) : (
            <div className="grid gap-0 divide-y divide-slate-200 dark:divide-slate-700 md:grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] md:divide-x md:divide-y-0">
              {campaignGroups.map((group) => {
                const postedCount = group.campaigns.filter((item) => item.wasPosted).length;
                const skippedCount = group.campaigns.filter(
                  (item) =>
                    !item.wasPosted &&
                    (item.status.trim().toLowerCase() === "skipped" ||
                      (!item.hasDelivery && !item.campaignDisabled))
                ).length;
                return (
                <div key={group.key} className="flex min-h-0 min-w-0 flex-col bg-white dark:bg-slate-900">
                  <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/80">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-50">{group.label}</h4>
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        {group.campaigns.length}
                      </span>
                    </div>
                    {/* Keep meta line count identical across columns so campaign rows share the same baseline. */}
                    <div className="mt-1 space-y-0.5">
                      <p
                        className="truncate text-[11px] font-medium text-slate-700 dark:text-slate-200"
                        title={group.pingTreeLabel || undefined}
                      >
                        {group.pingTreeLabel ? `Ping tree: ${group.pingTreeLabel}` : "\u00a0"}
                      </p>
                      <p
                        className={cn(
                          "truncate text-[11px]",
                          group.key === "Silent" && group.silentPostingMode
                            ? "text-slate-600 dark:text-slate-300"
                            : "invisible"
                        )}
                        aria-hidden={!(group.key === "Silent" && group.silentPostingMode)}
                        title={
                          group.key === "Silent" && group.silentPostingMode
                            ? group.silentPostingMode
                            : undefined
                        }
                      >
                        Strategy: {group.silentPostingMode || "—"}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {postedCount} posted · {skippedCount} skipped/filtered
                      </p>
                    </div>
                  </div>

                  <ol className="max-h-[min(28rem,55vh)] divide-y divide-slate-200 overflow-y-auto overscroll-contain dark:divide-slate-700">
                    {group.campaigns.map((campaign, index) => {
                      const selected = campaign.id === selectedCampaign?.id;
                      const statusNormalized = campaign.status.trim().toLowerCase();
                      const isAccept = statusNormalized === "accept" || statusNormalized === "accepted";
                      const isReject = statusNormalized.includes("reject");
                      const isSkipped =
                        !campaign.wasPosted &&
                        (statusNormalized === "skipped" ||
                          (!campaign.hasDelivery && !campaign.campaignDisabled));
                      const message =
                        campaign.message &&
                        campaign.message !== "—" &&
                        campaign.message.trim().toLowerCase() !== statusNormalized
                          ? campaign.message
                          : "";
                      const postLabel = campaign.wasPosted
                        ? "Posted"
                        : campaign.campaignDisabled
                          ? "Disabled"
                          : isSkipped
                            ? statusNormalized === "skipped"
                              ? "Skipped"
                              : "Filtered"
                            : "Not posted";
                      const postTone = campaign.wasPosted
                        ? isReject
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
                        : isSkipped
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200"
                          : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300";

                      return (
                        <li key={campaign.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedCampaignId(campaign.id)}
                            className={cn(
                              "flex w-full items-center gap-2.5 border-l-2 px-3 py-2 text-left transition",
                              selected
                                ? isAccept
                                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/15"
                                  : isReject
                                    ? "border-rose-500 bg-rose-50 dark:bg-rose-500/15"
                                    : "border-sky-500 bg-sky-50 dark:bg-sky-500/10"
                                : isAccept
                                  ? "border-emerald-300 bg-emerald-50/70 hover:bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/15"
                                  : isReject
                                    ? "border-rose-300 bg-rose-50/70 hover:bg-rose-50 dark:border-rose-500/40 dark:bg-rose-500/10 dark:hover:bg-rose-500/15"
                                    : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50"
                            )}
                          >
                            <span
                              className={cn(
                                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                                selected || isAccept || isReject
                                  ? isAccept
                                    ? "bg-emerald-600 text-white"
                                    : isReject
                                      ? "bg-rose-600 text-white"
                                      : "bg-sky-600 text-white"
                                  : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                              )}
                            >
                              {index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex min-w-0 items-center gap-1.5">
                                <p
                                  className={cn(
                                    "min-w-0 truncate text-sm font-semibold",
                                    isAccept
                                      ? "text-emerald-900 dark:text-emerald-100"
                                      : isReject
                                        ? "text-rose-900 dark:text-rose-100"
                                        : "text-slate-900 dark:text-slate-50"
                                  )}
                                >
                                  {campaign.campaignLabel}
                                </p>
                                <StatusBadge status={campaign.status} compact />
                                <span
                                  className={cn(
                                    "shrink-0 rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide",
                                    postTone
                                  )}
                                >
                                  {postLabel}
                                </span>
                              </div>
                              <p className="mt-0.5 truncate text-xs text-slate-600 dark:text-slate-300">
                                {campaign.buyerLabel || "—"}
                                {message ? (
                                  <span className="text-slate-400 dark:text-slate-500"> · {message}</span>
                                ) : null}
                              </p>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              );
              })}
            </div>
          )}
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Step {activeHop.step}: {activeHop.title}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
              activeHop.kind === "request"
                ? "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
            )}
          >
            {activeHop.kind === "request" ? <ArrowRight size={12} /> : <ArrowLeft size={12} />}
            {activeHop.from} {activeHop.kind === "request" ? "sends to" : "returns to"} {activeHop.to}
          </span>
          {showCampaignPicker && selectedCampaign ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
              {selectedCampaign.campaignLabel}
              <StatusBadge status={selectedCampaign.status} compact />
            </span>
          ) : null}
        </div>
        <JsonLogPanel
          title={activeHop.kind === "request" ? "Request" : "Response"}
          tone={activeTone}
          data={activeData}
          emptyMessage={activeHop.emptyMessage}
        />
      </section>
    </div>
  );
}
