"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildCampaignTestMockBuyerResponse,
  buildCampaignTestMockPingBuyerResponse,
  CAMPAIGN_TEST_MOCK_STATUS_OPTIONS,
  DEFAULT_CAMPAIGN_TEST_MOCK,
  DEFAULT_CAMPAIGN_TEST_PING_MOCK,
  sanitizeCampaignTestMock,
  type CampaignTestMockPhaseConfig,
  type CampaignTestMockResponse,
} from "@/lib/campaign-test-mock";
import type { PingTreeCampaignCard } from "@/lib/ping-tree";
import { CancelButton, FieldLabel, Input, PrimaryButton, Select } from "@/components/ui/form-controls";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

type CampaignTestMockModalProps = {
  open: boolean;
  card: PingTreeCampaignCard | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (campaignId: string, mock: CampaignTestMockResponse) => Promise<void>;
  onClear: (campaignId: string) => Promise<void>;
};

function formatReasons(reasons: string[]) {
  return reasons.join("\n");
}

function parseReasons(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function PhaseMockFields({
  idPrefix,
  form,
  reasonsText,
  onFormChange,
  onReasonsChange,
  showPriceAndRedirect,
  acceptLabel = "Sold",
}: {
  idPrefix: string;
  form: CampaignTestMockPhaseConfig;
  reasonsText: string;
  onFormChange: (next: CampaignTestMockPhaseConfig) => void;
  onReasonsChange: (value: string) => void;
  showPriceAndRedirect: boolean;
  /** Display label for Accept — Post uses "Sold"; Ping uses "Accept". */
  acceptLabel?: "Sold" | "Accept";
}) {
  const isAccept = form.status === "Accept";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <FieldLabel htmlFor={`${idPrefix}-status`} label="Status" />
          <Select
            id={`${idPrefix}-status`}
            value={form.status}
            onChange={(event) => {
              const status = event.target.value as CampaignTestMockPhaseConfig["status"];
              onFormChange({
                ...form,
                status,
                price: status === "Accept" ? form.price : null,
                redirectUrl: status === "Accept" ? form.redirectUrl : "",
              });
            }}
          >
            {CAMPAIGN_TEST_MOCK_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status === "Accept" ? acceptLabel : status}
              </option>
            ))}
          </Select>
        </div>

        <div className="min-w-0">
          <FieldLabel htmlFor={`${idPrefix}-timeout`} label="Timeout (s)" />
          <Input
            id={`${idPrefix}-timeout`}
            type="number"
            min="0"
            step="1"
            value={form.timeoutSeconds ?? ""}
            onChange={(event) =>
              onFormChange({
                ...form,
                timeoutSeconds: event.target.value === "" ? null : Number(event.target.value),
              })
            }
            placeholder="0"
          />
        </div>
      </div>

      {isAccept && showPriceAndRedirect ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <FieldLabel htmlFor={`${idPrefix}-price`} label="Price" />
            <Input
              id={`${idPrefix}-price`}
              type="number"
              min="0"
              step="0.01"
              value={form.price ?? ""}
              onChange={(event) =>
                onFormChange({
                  ...form,
                  price: event.target.value === "" ? null : Number(event.target.value),
                })
              }
            />
          </div>

          <div className="min-w-0 sm:col-span-2">
            <FieldLabel htmlFor={`${idPrefix}-redirect-url`} label="Direct URL" />
            <Input
              id={`${idPrefix}-redirect-url`}
              value={form.redirectUrl}
              onChange={(event) => onFormChange({ ...form, redirectUrl: event.target.value })}
              placeholder="https://example.com/landing"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Returned as <code className="text-[11px]">redirect_url</code> in the buyer JSON response.
            </p>
          </div>
        </div>
      ) : null}

      {!isAccept ? (
        <div className="min-w-0">
          <FieldLabel htmlFor={`${idPrefix}-reasons`} label="Reasons" />
          <textarea
            id={`${idPrefix}-reasons`}
            value={reasonsText}
            onChange={(event) => onReasonsChange(event.target.value)}
            rows={4}
            spellCheck={false}
            placeholder="Buyer declined the lead."
            className="mt-1 w-full min-w-0 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">One reason per line.</p>
        </div>
      ) : null}
    </div>
  );
}

export function CampaignTestMockModal({
  open,
  card,
  isSaving,
  onClose,
  onSave,
  onClear,
}: CampaignTestMockModalProps) {
  const [form, setForm] = useState<CampaignTestMockResponse>({ ...DEFAULT_CAMPAIGN_TEST_MOCK });
  const [reasonsText, setReasonsText] = useState(formatReasons(DEFAULT_CAMPAIGN_TEST_MOCK.reasons));
  const [pingReasonsText, setPingReasonsText] = useState(
    formatReasons(DEFAULT_CAMPAIGN_TEST_PING_MOCK.reasons)
  );

  const isPingPost = card?.integrationPostModel === "Ping Post";

  useEffect(() => {
    if (!open || !card) return;

    const nextForm = sanitizeCampaignTestMock(card.testMock ?? DEFAULT_CAMPAIGN_TEST_MOCK);
    const withPing =
      card.integrationPostModel === "Ping Post"
        ? {
            ...nextForm,
            ping: nextForm.ping ?? { ...DEFAULT_CAMPAIGN_TEST_PING_MOCK },
          }
        : { ...nextForm, ping: null };

    setForm(withPing);
    setReasonsText(formatReasons(withPing.reasons));
    setPingReasonsText(formatReasons(withPing.ping?.reasons ?? DEFAULT_CAMPAIGN_TEST_PING_MOCK.reasons));
  }, [card, open]);

  const previewMock = useMemo(() => {
    const post = sanitizeCampaignTestMock({
      ...form,
      reasons: form.status === "Accept" ? form.reasons : parseReasons(reasonsText),
      ping: null,
    });

    if (!isPingPost || !form.ping) {
      return { ...post, ping: null };
    }

    const ping = {
      ...form.ping,
      reasons:
        form.ping.status === "Accept" ? form.ping.reasons : parseReasons(pingReasonsText),
    };

    return sanitizeCampaignTestMock({
      ...post,
      ping,
    });
  }, [form, isPingPost, pingReasonsText, reasonsText]);

  const previewPostJson = useMemo(
    () => JSON.stringify(buildCampaignTestMockBuyerResponse(previewMock), null, 2),
    [previewMock]
  );

  const previewPingJson = useMemo(() => {
    if (!previewMock.ping) return "";
    return JSON.stringify(buildCampaignTestMockPingBuyerResponse(previewMock.ping), null, 2);
  }, [previewMock.ping]);

  if (!open || !card) {
    return null;
  }

  const handleSave = async () => {
    await onSave(card.id, previewMock);
  };

  return (
    <Modal
      open={open}
      title="Test Lead Mock Response"
      description={`Campaign #${card.displayId}: ${card.name}. Min price $${card.minPrice.toFixed(2)}.${
        isPingPost ? " Integration: Ping Post." : ""
      }`}
      onClose={onClose}
      panelClassName="max-w-xl"
      actions={
        <>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void onClear(card.id)}
            className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50 sm:text-sm dark:text-red-400"
          >
            Clear mock
          </button>
          <CancelButton type="button" disabled={isSaving} onClick={onClose} />
          <PrimaryButton type="button" disabled={isSaving} onClick={() => void handleSave()}>
            {isSaving ? "Saving..." : "Save mock"}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-5">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Timeout delays the mock response before returning the result.
        </p>

        {isPingPost && form.ping ? (
          <section
            className={cn(
              "space-y-3 rounded-2xl border border-sky-200 bg-sky-50/60 p-4 dark:border-sky-500/30 dark:bg-sky-500/10"
            )}
          >
            <div>
              <p className="text-sm font-semibold text-sky-900 dark:text-sky-100">Ping mock</p>
              <p className="mt-0.5 text-xs text-sky-800/80 dark:text-sky-200/80">
                Response used for the Ping request. Reject / timeout / error skips the Post.
              </p>
            </div>
            <PhaseMockFields
              idPrefix="campaign-test-mock-ping"
              form={form.ping}
              reasonsText={pingReasonsText}
              showPriceAndRedirect={false}
              acceptLabel="Accept"
              onFormChange={(ping) => setForm((current) => ({ ...current, ping }))}
              onReasonsChange={setPingReasonsText}
            />
            <div className="min-w-0">
              <FieldLabel label="Ping buyer response JSON" />
              <pre className="mt-1 max-h-40 overflow-auto rounded-xl border border-slate-200 bg-slate-950 px-3 py-3 text-xs leading-5 text-sky-300 dark:border-slate-700">
                {previewPingJson}
              </pre>
            </div>
          </section>
        ) : null}

        <section
          className={cn(
            "space-y-3 rounded-2xl border p-4",
            isPingPost
              ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/30 dark:bg-emerald-500/10"
              : "border-transparent bg-transparent p-0"
          )}
        >
          {isPingPost ? (
            <div>
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">Post mock</p>
              <p className="mt-0.5 text-xs text-emerald-800/80 dark:text-emerald-200/80">
                Response used for the Post request after Ping Accept.
              </p>
            </div>
          ) : null}

          <PhaseMockFields
            idPrefix="campaign-test-mock-post"
            form={form}
            reasonsText={reasonsText}
            showPriceAndRedirect
            onFormChange={(post) =>
              setForm((current) => ({
                ...post,
                ping: current.ping,
              }))
            }
            onReasonsChange={setReasonsText}
          />

          <div className="min-w-0">
            <FieldLabel label={isPingPost ? "Post buyer response JSON" : "Buyer response JSON"} />
            <pre className="mt-1 max-h-56 overflow-auto rounded-xl border border-slate-200 bg-slate-950 px-3 py-3 text-xs leading-5 text-emerald-300 dark:border-slate-700">
              {previewPostJson}
            </pre>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Preview of the mock JSON returned to the system for this config
              {previewMock.timeoutSeconds ? ` (after ${previewMock.timeoutSeconds}s delay)` : ""}.
            </p>
          </div>
        </section>
      </div>
    </Modal>
  );
}
