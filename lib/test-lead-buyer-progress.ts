import type { BuyerPostAttemptSnapshot } from "@/lib/buyer-post-request";
import type { PingTreeCampaignType } from "@/lib/ping-tree";
import type { MappingTestLeadLogRecord } from "@/lib/mapping-test-lead-log-shared";

export type BuyerPostQueueState = "processing" | "waiting" | "done";

export type BuyerPostAttemptView = BuyerPostAttemptSnapshot & {
  queueState?: BuyerPostQueueState;
  queueOrder?: number;
  processingStartedAt?: string;
};

export type PendingBuyerPostCampaign = {
  campaignId: string;
  campaignName: string;
  buyerId: string;
  buyerCompany: string;
  pingTreeType: PingTreeCampaignType;
  campaignOrder: number;
  queueOrder: number;
  logId: string;
};

function isPingTreeCampaignType(value: unknown): value is PingTreeCampaignType {
  return value === "Redirect" || value === "Silent";
}

function rowPingTreeType(row: { pingTreeType?: PingTreeCampaignType }) {
  return isPingTreeCampaignType(row.pingTreeType) ? row.pingTreeType : null;
}

function queueRowKey(row: { pingTreeType?: PingTreeCampaignType; campaignId: string }) {
  if (!isPingTreeCampaignType(row.pingTreeType)) {
    return row.campaignId;
  }

  return `${row.pingTreeType}:${row.campaignId}`;
}

function findQueueRowForAttempt(
  attempt: { pingTreeType?: PingTreeCampaignType; campaignId: string; campaignOrder?: number },
  queue: BuyerPostAttemptView[]
) {
  const candidates = queue.filter((row) => row.campaignId === attempt.campaignId);
  if (candidates.length === 0) {
    return null;
  }

  if (isPingTreeCampaignType(attempt.pingTreeType)) {
    const exact = candidates.find((row) => row.pingTreeType === attempt.pingTreeType);
    if (exact) {
      return exact;
    }
  }

  if (attempt.campaignOrder != null) {
    const byOrder = candidates.find((row) => row.campaignOrder === attempt.campaignOrder);
    if (byOrder) {
      return byOrder;
    }
  }

  return candidates.length === 1 ? candidates[0] : null;
}

function resolveAttemptPingTreeType(
  attempt: { pingTreeType?: PingTreeCampaignType; campaignId: string; campaignOrder?: number },
  queue: BuyerPostAttemptView[]
): PingTreeCampaignType | null {
  const queueRow = findQueueRowForAttempt(attempt, queue);
  if (queueRow?.pingTreeType) {
    return queueRow.pingTreeType;
  }

  if (isPingTreeCampaignType(attempt.pingTreeType)) {
    return attempt.pingTreeType;
  }

  return null;
}

export function campaignQueueKey(
  attempt: { pingTreeType?: PingTreeCampaignType; campaignId: string; campaignOrder?: number },
  queue: BuyerPostAttemptView[] = []
) {
  const queueRow = findQueueRowForAttempt(attempt, queue);
  if (queueRow) {
    return queueRowKey(queueRow);
  }

  const pingTreeType = resolveAttemptPingTreeType(attempt, queue);
  if (!pingTreeType) {
    return attempt.campaignId;
  }

  return `${pingTreeType}:${attempt.campaignId}`;
}

function markRowProcessing(row: BuyerPostAttemptView, startedAt = new Date().toISOString()): BuyerPostAttemptView {
  return {
    ...row,
    queueState: "processing",
    processingStartedAt: row.processingStartedAt ?? startedAt,
    postedAt: undefined,
  };
}

function markRowQueueSkipped(row: BuyerPostAttemptView): BuyerPostAttemptView {
  return {
    ...row,
    queueState: "done",
    buyerStatus: "Skipped",
    postedToBuyer: false,
    postedAt: undefined,
  };
}

export function sortBuyerPostAttemptViews(attempts: BuyerPostAttemptView[]) {
  return [...attempts].sort((left, right) => {
    if (left.queueOrder != null && right.queueOrder != null) {
      return left.queueOrder - right.queueOrder;
    }

    const leftTypeOrder = left.pingTreeType === "Silent" ? 1 : 0;
    const rightTypeOrder = right.pingTreeType === "Silent" ? 1 : 0;
    if (leftTypeOrder !== rightTypeOrder) return leftTypeOrder - rightTypeOrder;
    return (left.campaignOrder ?? 0) - (right.campaignOrder ?? 0);
  });
}

function buildQueuedPlaceholderAttempt(
  pending: PendingBuyerPostCampaign,
  queueState: BuyerPostQueueState
): BuyerPostAttemptView {
  const startedAt = queueState === "processing" ? new Date().toISOString() : undefined;

  return {
    campaignId: pending.campaignId,
    campaignName: pending.campaignName,
    buyerId: pending.buyerId,
    buyerCompany: pending.buyerCompany,
    buyerStatus: "Reject",
    publisherLead: {},
    systemLead: {},
    mappedValues: {},
    requestMappingData: {},
    campaignValidationChecks: [],
    postedToBuyer: false,
    request: null,
    response: { httpStatus: 0, headers: {}, body: "" },
    logId: pending.logId,
    pingTreeType: pending.pingTreeType,
    campaignOrder: pending.campaignOrder,
    queueOrder: pending.queueOrder,
    queueState,
    processingStartedAt: startedAt,
  };
}

export function buildInitialBuyerPostQueue(
  pending: PendingBuyerPostCampaign[],
  _submittedAt: string
): BuyerPostAttemptView[] {
  const firstRedirectId = pending.find((campaign) => campaign.pingTreeType === "Redirect")?.campaignId;
  const silentStartedAt = new Date().toISOString();

  return pending.map((campaign) => {
    if (campaign.pingTreeType === "Silent") {
      return {
        ...buildQueuedPlaceholderAttempt(
          {
            ...campaign,
            queueOrder: campaign.queueOrder,
            logId: String(campaign.queueOrder + 1).padStart(3, "0"),
          },
          "processing"
        ),
        processingStartedAt: silentStartedAt,
      };
    }

    const isFirstRedirect =
      campaign.pingTreeType === "Redirect" && campaign.campaignId === firstRedirectId;

    return buildQueuedPlaceholderAttempt(
      {
        ...campaign,
        queueOrder: campaign.queueOrder,
        logId: String(campaign.queueOrder + 1).padStart(3, "0"),
      },
      isFirstRedirect ? "processing" : "waiting"
    );
  });
}

export function ensureBuyerPostQueueRowProcessing(
  queue: BuyerPostAttemptView[],
  campaignId: string,
  pingTreeType: PingTreeCampaignType
): BuyerPostAttemptView[] {
  return sortBuyerPostAttemptViews(
    queue.map((row) => {
      if (row.campaignId !== campaignId || row.pingTreeType !== pingTreeType) {
        return row;
      }

      return markRowProcessing(row);
    })
  );
}

function resolveCompletedPostedAt(
  completed: BuyerPostAttemptSnapshot,
  row?: BuyerPostAttemptView
) {
  if (completed.postedToBuyer === false) {
    return undefined;
  }

  return completed.postedAt ?? row?.processingStartedAt ?? new Date().toISOString();
}

export function advanceBuyerPostQueueAfterAttempt(
  queue: BuyerPostAttemptView[],
  completed: BuyerPostAttemptSnapshot
): BuyerPostAttemptView[] {
  const sortedQueue = sortBuyerPostAttemptViews(queue);
  const matchedRow = findQueueRowForAttempt(completed, sortedQueue);
  const completedType = matchedRow?.pingTreeType ?? resolveAttemptPingTreeType(completed, sortedQueue);
  const completedKey = matchedRow ? queueRowKey(matchedRow) : campaignQueueKey(completed, sortedQueue);

  let updated = sortedQueue.map((row) => {
    if (queueRowKey(row) !== completedKey) {
      return row;
    }

    return {
      ...completed,
      pingTreeType: row.pingTreeType ?? completedType ?? completed.pingTreeType,
      queueState: "done" as const,
      queueOrder: row.queueOrder,
      processingStartedAt: undefined,
      postedAt: resolveCompletedPostedAt(completed, row),
    };
  });

  if (!updated.some((row) => queueRowKey(row) === completedKey)) {
    updated = sortBuyerPostAttemptViews([
      ...updated,
      {
        ...completed,
        pingTreeType: completedType ?? completed.pingTreeType,
        queueState: "done" as const,
        postedAt: resolveCompletedPostedAt(completed),
      },
    ]);
  }

  if (!completedType) {
    return updated;
  }

  if (completed.buyerStatus === "Accept" && completedType === "Redirect") {
    updated = updated.map((row) => {
      if (row.pingTreeType === "Silent") {
        return row;
      }

      if (row.pingTreeType !== "Redirect" || queueRowKey(row) === completedKey) {
        return row;
      }

      if (row.queueState === "waiting" || row.queueState === "processing") {
        return markRowQueueSkipped(row);
      }

      return row;
    });
  }

  // Silent campaigns post in parallel — no sequential queue advancement.
  if (completedType === "Silent") {
    return updated;
  }

  const typeRows = updated
    .filter((row) => rowPingTreeType(row) === completedType)
    .sort((left, right) => (left.campaignOrder ?? 0) - (right.campaignOrder ?? 0));

  const completedTypeIndex = typeRows.findIndex((row) => queueRowKey(row) === completedKey);
  const nextWaitingInType = typeRows.find(
    (row, index) => index > completedTypeIndex && row.queueState === "waiting"
  );

  if (!nextWaitingInType) {
    return updated.map((row) => {
      if (rowPingTreeType(row) !== completedType) {
        return row;
      }

      if (row.queueState === "processing" && queueRowKey(row) !== completedKey) {
        return { ...row, queueState: "done" as const, processingStartedAt: undefined };
      }

      return row;
    });
  }

  const nextKey = queueRowKey(nextWaitingInType);

  return updated.map((row) => {
    if (queueRowKey(row) === nextKey) {
      return markRowProcessing(row);
    }

    if (rowPingTreeType(row) === completedType && row.queueState === "processing") {
      return { ...row, queueState: "waiting" as const, processingStartedAt: undefined, postedAt: undefined };
    }

    return row;
  });
}

export function mergeBuyerPostQueueWithResults(
  queue: BuyerPostAttemptView[],
  finalAttempts: BuyerPostAttemptSnapshot[]
): BuyerPostAttemptView[] {
  if (queue.length === 0) {
    return sortBuyerPostAttemptViews(
      finalAttempts.map((attempt) => ({ ...attempt, queueState: "done" as const }))
    );
  }

  const finalByKey = new Map(
    finalAttempts.map((attempt) => [campaignQueueKey(attempt, queue), attempt])
  );

  const merged = queue.map((row) => {
    const final = finalByKey.get(queueRowKey(row));
    if (!final) {
      if (row.queueState === "waiting") {
        return markRowQueueSkipped({
          ...row,
          buyerStatus: "Skipped",
          errorReason: "Campaign was not posted.",
        });
      }

      return row;
    }

    return {
      ...final,
      pingTreeType: row.pingTreeType ?? resolveAttemptPingTreeType(final, queue) ?? final.pingTreeType,
      queueState: "done" as const,
      queueOrder: row.queueOrder,
      processingStartedAt: undefined,
      postedAt: resolveCompletedPostedAt(final, row),
    };
  });

  for (const final of finalAttempts) {
    const key = campaignQueueKey(final, queue);
    if (!merged.some((row) => queueRowKey(row) === key)) {
      merged.push({
        ...final,
        queueState: "done" as const,
      });
    }
  }

  return sortBuyerPostAttemptViews(merged);
}

export function buildDraftTestLeadLog(params: {
  submittedAt: string;
  endpointUrl: string;
  requestBody: Record<string, unknown>;
  saveLead: boolean;
  postToBuyer: boolean;
  validationPassed: boolean;
  validationChecks: MappingTestLeadLogRecord["validationChecks"];
  pendingAttempts: BuyerPostAttemptView[];
}): MappingTestLeadLogRecord {
  return {
    id: `pending-${Date.now()}`,
    submittedAt: params.submittedAt,
    saveLead: params.saveLead,
    postToBuyer: params.postToBuyer,
    leadSaved: params.saveLead,
    endpointUrl: params.endpointUrl,
    requestBody: params.requestBody,
    buyerPostAttempts: params.pendingAttempts,
    postedBuyerRequest: null,
    postedBuyerResponse: null,
    publisherStatus: params.validationPassed ? 200 : 400,
    publisherResponse: params.validationPassed
      ? {
          status: 1,
          status_text: "Accepted",
          message: "Lead passed publisher validation. Posting to buyers...",
        }
      : {
          status: 2,
          status_text: "reject",
          reasons: [],
        },
    status: params.validationPassed ? 200 : 400,
    responseBody: params.validationPassed
      ? {
          status: 1,
          status_text: "Accepted",
          message: "Lead passed publisher validation. Posting to buyers...",
        }
      : {
          status: 2,
          status_text: "reject",
          reasons: [],
        },
    validationChecks: params.validationChecks,
    validationPassed: params.validationPassed,
    buyerPostHint: null,
    buyerStatus: null,
    buyerResponse: null,
  };
}

export function buildPendingLogId(pending: PendingBuyerPostCampaign) {
  return `${pending.pingTreeType}:${pending.campaignId}`;
}
