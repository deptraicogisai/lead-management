"use client";

import { useEffect, useState } from "react";
import {
  CAMPAIGN_TEST_MOCK_STATUS_OPTIONS,
  DEFAULT_CAMPAIGN_TEST_MOCK,
  sanitizeCampaignTestMock,
  type CampaignTestMockResponse,
} from "@/lib/campaign-test-mock";
import type { PingTreeCampaignCard } from "@/lib/ping-tree";
import { CancelButton, FieldLabel, Input, PrimaryButton, Select } from "@/components/ui/form-controls";
import { Modal } from "@/components/ui/modal";

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

  useEffect(() => {
    if (!open || !card) return;

    const nextForm = sanitizeCampaignTestMock(card.testMock ?? DEFAULT_CAMPAIGN_TEST_MOCK);
    setForm(nextForm);
    setReasonsText(formatReasons(nextForm.reasons));
  }, [card, open]);

  if (!open || !card) {
    return null;
  }

  const isAccept = form.status === "Accept";

  const handleSave = async () => {
    const nextMock = sanitizeCampaignTestMock({
      ...form,
      reasons: isAccept ? form.reasons : parseReasons(reasonsText),
    });
    await onSave(card.id, nextMock);
  };

  return (
    <Modal
      open={open}
      title="Test Lead Mock Response"
      description={`Campaign #${card.displayId}: ${card.name}. Min price $${card.minPrice.toFixed(2)}.`}
      onClose={onClose}
      panelClassName="max-w-lg"
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
      <div className="space-y-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Timeout delays the mock response before returning the result.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <FieldLabel htmlFor="campaign-test-mock-status" label="Status" />
            <Select
              id="campaign-test-mock-status"
              value={form.status}
              onChange={(event) => {
                const status = event.target.value as CampaignTestMockResponse["status"];
                setForm((current) =>
                  sanitizeCampaignTestMock({
                    ...current,
                    status,
                  })
                );
              }}
            >
              {CAMPAIGN_TEST_MOCK_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status === "Accept" ? "Sold" : status}
                </option>
              ))}
            </Select>
          </div>

          <div className="min-w-0">
            <FieldLabel htmlFor="campaign-test-mock-timeout" label="Timeout (s)" />
            <Input
              id="campaign-test-mock-timeout"
              type="number"
              min="0"
              step="1"
              value={form.timeoutSeconds ?? ""}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  timeoutSeconds: event.target.value === "" ? null : Number(event.target.value),
                }))
              }
              placeholder="0"
            />
          </div>
        </div>

        {isAccept ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <FieldLabel htmlFor="campaign-test-mock-price" label="Price" />
              <Input
                id="campaign-test-mock-price"
                type="number"
                min="0"
                step="0.01"
                value={form.price ?? ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    price: event.target.value === "" ? null : Number(event.target.value),
                  }))
                }
              />
            </div>

            <div className="min-w-0 sm:col-span-2">
              <FieldLabel htmlFor="campaign-test-mock-redirect-url" label="Direct URL" />
              <Input
                id="campaign-test-mock-redirect-url"
                value={form.redirectUrl}
                onChange={(event) => setForm((current) => ({ ...current, redirectUrl: event.target.value }))}
                placeholder="https://example.com/landing"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Returned as <code className="text-[11px]">redirect_url</code> in the buyer JSON response.
              </p>
            </div>
          </div>
        ) : (
          <div className="min-w-0">
            <FieldLabel htmlFor="campaign-test-mock-reasons" label="Reasons" />
            <textarea
              id="campaign-test-mock-reasons"
              value={reasonsText}
              onChange={(event) => setReasonsText(event.target.value)}
              rows={4}
              spellCheck={false}
              placeholder="Buyer declined the lead."
              className="mt-1 w-full min-w-0 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">One reason per line.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
