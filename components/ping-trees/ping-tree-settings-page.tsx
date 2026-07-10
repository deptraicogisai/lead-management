"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ChevronDown,
  ChevronUp,
  Filter,
  Search,
  Settings2,
} from "lucide-react";
import { Input, PrimaryButton, ToggleSwitch, cancelButtonClassName, compactPrimaryButtonClassName } from "@/components/ui/form-controls";
import { CampaignTestMockModal } from "@/components/ping-trees/campaign-test-mock-modal";
import type { CampaignTestMockResponse } from "@/lib/campaign-test-mock";
import { LoadingOverlay } from "@/components/ui/loading-indicator";
import { ContentAreaLoading } from "@/components/ui/content-area-loading";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageSection } from "@/components/ui/state";
import { PageTabBar } from "@/components/ui/page-tab-bar";
import {
  PING_TREE_CAMPAIGN_TYPE_TABS,
  type PingTreeCampaignCard,
  type PingTreeCampaignType,
  type PingTreeRecord,
  sortInactiveCampaignsByBuyerMinPrice,
} from "@/lib/ping-tree";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type DropTarget = {
  side: "active" | "inactive";
  index: number | "end";
};

type DragSession = {
  campaignId: string;
  sourceSide: "active" | "inactive";
  pointerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  activated: boolean;
};

type DragPreviewItem =
  | { kind: "card"; card: PingTreeCampaignCard; hitIndex: number }
  | { kind: "placeholder" };

const DRAG_ACTIVATION_DISTANCE_PX = 6;
const DRAG_AUTO_SCROLL_EDGE_PX = 48;
const DRAG_AUTO_SCROLL_MAX_SPEED_PX = 18;
const DRAG_FLIP_MS = 75;

function dropTargetKey(target: DropTarget | null) {
  if (!target) return "";
  return `${target.side}:${target.index}`;
}

function toDescendingPosition(index: number, listLength: number) {
  return Math.max(1, listLength - index);
}

function descendingPositionToIndex(position: number, listLength: number) {
  const clamped = Math.max(1, Math.min(listLength, Math.round(position)));
  return listLength - clamped;
}

function resolveDescendingPosition(value: number, listLength: number) {
  if (listLength <= 0) return 1;
  return toDescendingPosition(descendingPositionToIndex(value, listLength), listLength);
}

function buildDescendingPriorities(activeIds: string[], inactiveIds: string[]) {
  return syncDescendingPriorities(inactiveIds, syncDescendingPriorities(activeIds, {}));
}

function syncDescendingPriorities(ids: string[], current: Record<string, number>) {
  const next = { ...current };
  ids.forEach((id, index) => {
    next[id] = toDescendingPosition(index, ids.length);
  });
  return next;
}

function shouldIgnoreCardDrag(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(target.closest("button, input, textarea, select, a, label, [data-no-drag]"));
}

function countByStatus(cards: PingTreeCampaignCard[]) {
  const active = cards.filter((card) => card.status === "Active").length;
  return {
    disabled: cards.length - active,
    active,
    total: cards.length,
  };
}

function formatCampaignLabel(card: PingTreeCampaignCard) {
  return `#${card.displayId}: ${card.productLabel} : ${card.buyerLabel} : ${card.name}`;
}

function CampaignNameLabel({
  card,
  variant,
}: {
  card: PingTreeCampaignCard;
  variant: "active" | "inactive";
}) {
  return (
    <p
      className={cn(
        "min-w-0 leading-snug text-blue-700 dark:text-blue-300",
        variant === "active"
          ? "text-sm font-medium"
          : "truncate text-[13px] font-normal sm:text-sm"
      )}
    >
      {formatCampaignLabel(card)}
    </p>
  );
}

function matchesSearch(card: PingTreeCampaignCard, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  return (
    card.name.toLowerCase().includes(q) ||
    card.buyerLabel.toLowerCase().includes(q) ||
    card.productLabel.toLowerCase().includes(q) ||
    String(card.displayId).includes(q) ||
    card.status.toLowerCase().includes(q)
  );
}

function readCardIndexDataset(element: HTMLElement, cardSelector: string) {
  if (cardSelector.includes("inactive")) {
    return Number.parseInt(element.dataset.pingTreeInactiveCardIndex ?? "0", 10);
  }

  return Number.parseInt(element.dataset.pingTreeCardIndex ?? "0", 10);
}

function resolveInsertIndexFromPointer(
  listElement: HTMLElement,
  pointerY: number,
  cardSelector: string
): number | "end" {
  const cardElements = Array.from(listElement.querySelectorAll<HTMLElement>(cardSelector));

  if (cardElements.length === 0) {
    return "end";
  }

  for (const element of cardElements) {
    const rect = element.getBoundingClientRect();
    const cardIndex = readCardIndexDataset(element, cardSelector);
    const midpoint = rect.top + rect.height / 2;

    if (pointerY < midpoint) {
      return cardIndex;
    }
  }

  return "end";
}

function buildDragPreviewItems(
  cards: PingTreeCampaignCard[],
  draggedId: string | null,
  insertIndex: number | "end" | null
): DragPreviewItem[] {
  const withoutDragged = draggedId ? cards.filter((card) => card.id !== draggedId) : cards;

  if (insertIndex === null) {
    return withoutDragged.map((card, hitIndex) => ({ kind: "card" as const, card, hitIndex }));
  }

  const at = insertIndex === "end" ? withoutDragged.length : Math.max(0, Math.min(insertIndex, withoutDragged.length));
  const items: DragPreviewItem[] = [];

  withoutDragged.forEach((card, hitIndex) => {
    if (hitIndex === at) {
      items.push({ kind: "placeholder" });
    }
    items.push({ kind: "card", card, hitIndex });
  });

  if (at === withoutDragged.length) {
    items.push({ kind: "placeholder" });
  }

  return items;
}

function ColumnStatsBar({ disabled, active, total }: { disabled: number; active: number; total: number }) {
  return (
    <div className="border-b border-sky-200 bg-sky-100 px-3 py-2 text-sm text-slate-700 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-slate-200">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-medium">Disabled: {disabled}</span>
        <span>Active: {active}</span>
        <span>Total: {total}</span>
      </div>
    </div>
  );
}

const greenControlClass = cn(
  compactPrimaryButtonClassName,
  "shrink-0 rounded disabled:cursor-not-allowed disabled:opacity-40"
);

const iconActionClass = cn("inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full", greenControlClass);

const arrowActionClass = cn(
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white",
  greenControlClass
);

const textActionClass = cn(
  "inline-flex h-7 shrink-0 items-center whitespace-nowrap rounded-full px-3 text-[11px] font-medium",
  greenControlClass
);

const draggingCardClassName =
  "scale-[0.985] border-dashed border-slate-300 bg-slate-50/80 opacity-45 shadow-none dark:border-slate-600 dark:bg-slate-800/40";

const highlightedCardClassName =
  "border-emerald-400 bg-emerald-400/20 ring-2 ring-emerald-400/50 dark:border-emerald-400 dark:bg-emerald-400/25 dark:ring-emerald-400/40";

const cardActionsClass = "flex items-center justify-end gap-1";
const inactiveCardActionsClass =
  "flex items-center gap-1 overflow-x-auto border-t border-slate-100 px-2.5 py-2 dark:border-slate-800";

function autoScrollListNearEdge(listElement: HTMLElement | null, clientY: number) {
  if (!listElement) return;

  const rect = listElement.getBoundingClientRect();
  if (clientY < rect.top || clientY > rect.bottom) return;

  const distanceFromTop = clientY - rect.top;
  const distanceFromBottom = rect.bottom - clientY;

  if (distanceFromTop < DRAG_AUTO_SCROLL_EDGE_PX) {
    const intensity = 1 - distanceFromTop / DRAG_AUTO_SCROLL_EDGE_PX;
    listElement.scrollTop -= Math.ceil(DRAG_AUTO_SCROLL_MAX_SPEED_PX * intensity);
    return;
  }

  if (distanceFromBottom < DRAG_AUTO_SCROLL_EDGE_PX) {
    const intensity = 1 - distanceFromBottom / DRAG_AUTO_SCROLL_EDGE_PX;
    listElement.scrollTop += Math.ceil(DRAG_AUTO_SCROLL_MAX_SPEED_PX * intensity);
  }
}

function DropPlaceholder({ height, tone }: { height: number; tone: "active" | "inactive" }) {
  const isActive = tone === "active";

  return (
    <div
      aria-hidden
      className={cn(
        "rounded border-2 border-dashed transition-[height,background-color,border-color] duration-75",
        isActive
          ? "border-emerald-400 bg-emerald-400/20 dark:border-emerald-400 dark:bg-emerald-400/25"
          : "border-rose-400 bg-rose-400/20 dark:border-rose-400 dark:bg-rose-400/25"
      )}
      style={{ height: Math.max(height, 56) }}
    />
  );
}

function PriorityControls({
  position,
  onApplyPosition,
}: {
  position: number;
  onApplyPosition: (value: number) => number;
}) {
  const [draft, setDraft] = useState(String(position));
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setDraft(String(position));
    }
  }, [isEditing, position]);

  const apply = () => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(String(position));
      setIsEditing(false);
      return;
    }

    const resolved = onApplyPosition(Math.max(1, Math.round(parsed)));
    setDraft(String(resolved));
    setIsEditing(false);
  };

  return (
    <>
      <Input
        type="number"
        min={1}
        value={draft}
        onFocus={() => setIsEditing(true)}
        onChange={(event) => {
          setIsEditing(true);
          setDraft(event.target.value);
        }}
        onBlur={apply}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            apply();
            event.currentTarget.blur();
          }
        }}
        className={cn(
          "!box-border !h-7 !w-8 !min-w-8 !max-w-8 !shrink-0 !rounded !px-0.5 !py-0 text-center text-[11px]",
          "border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800"
        )}
      />
      <button type="button" onClick={apply} className={textActionClass}>
        Set
      </button>
    </>
  );
}

function ActiveCampaignCard({
  card,
  position,
  isDragging,
  isHighlighted,
  isGhost = false,
  canMoveUp,
  canMoveDown,
  onCardPointerDown,
  onApplyPosition,
  onRemove,
  onMoveUp,
  onMoveDown,
  onConfigureMock,
  showMockButton = false,
}: {
  card: PingTreeCampaignCard;
  position: number;
  isDragging: boolean;
  isHighlighted: boolean;
  isGhost?: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onCardPointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
  onApplyPosition: (value: number) => number;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onConfigureMock: () => void;
  showMockButton?: boolean;
}) {
  return (
    <div
      onPointerDown={isGhost ? undefined : onCardPointerDown}
      style={{ touchAction: isGhost ? undefined : "none" }}
      className={cn(
        "overflow-hidden rounded border bg-white dark:bg-slate-900",
        isGhost
          ? "cursor-grabbing border-slate-300 shadow-2xl ring-2 ring-slate-400/40 dark:border-slate-500 dark:ring-slate-300/20"
          : "cursor-grab transition-[opacity,transform,background-color,border-color,box-shadow] duration-150 ease-out active:cursor-grabbing",
        !isGhost && (isDragging ? draggingCardClassName : !isHighlighted && "border-slate-300 dark:border-slate-600"),
        !isGhost && isHighlighted && highlightedCardClassName
      )}
    >
      <div className="flex items-start justify-between gap-2 px-2.5 py-2">
        <div className="min-w-0 flex flex-1 flex-wrap items-center gap-1.5">
          <StatusBadge status={card.status} compact />
          <CampaignNameLabel card={card} variant="active" />
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5" data-no-drag>
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">${card.minPrice.toFixed(2)}</p>
          <div className={cardActionsClass}>
            <button
              type="button"
              disabled={isGhost || !canMoveUp}
              onClick={isGhost ? undefined : onMoveUp}
              title="Move up"
              className={arrowActionClass}
            >
              <ChevronUp size={16} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              disabled={isGhost || !canMoveDown}
              onClick={isGhost ? undefined : onMoveDown}
              title="Move down"
              className={arrowActionClass}
            >
              <ChevronDown size={16} strokeWidth={2.5} />
            </button>
            <button type="button" disabled={isGhost} onClick={isGhost ? undefined : onRemove} className={textActionClass}>
              Remove
            </button>
            <PriorityControls position={position} onApplyPosition={isGhost ? () => position : onApplyPosition} />
            {showMockButton ? (
              <button
                type="button"
                disabled={isGhost}
                onClick={isGhost ? undefined : onConfigureMock}
                title="Configure test lead mock response"
                className={iconActionClass}
              >
                <Settings2 size={14} />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function InactiveCampaignCard({
  card,
  position,
  canMoveToTop,
  canMoveToBottom,
  isDragging,
  isHighlighted,
  isGhost = false,
  onCardPointerDown,
  onApplyPosition,
  onMoveToTop,
  onMoveToBottom,
  onConfigureMock,
  showMockButton = false,
}: {
  card: PingTreeCampaignCard;
  position: number;
  canMoveToTop: boolean;
  canMoveToBottom: boolean;
  isDragging: boolean;
  isHighlighted: boolean;
  isGhost?: boolean;
  onCardPointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
  onApplyPosition: (value: number) => number;
  onMoveToTop: () => void;
  onMoveToBottom: () => void;
  onConfigureMock: () => void;
  showMockButton?: boolean;
}) {
  return (
    <div
      onPointerDown={isGhost ? undefined : onCardPointerDown}
      style={{ touchAction: isGhost ? undefined : "none" }}
      className={cn(
        "overflow-hidden rounded border bg-white dark:bg-slate-900",
        isGhost
          ? "cursor-grabbing border-slate-300 shadow-2xl ring-2 ring-slate-400/40 dark:border-slate-500 dark:ring-slate-300/20"
          : "cursor-grab transition-[opacity,transform,background-color,border-color,box-shadow] duration-150 ease-out active:cursor-grabbing",
        !isGhost && (isDragging ? draggingCardClassName : !isHighlighted && "border-slate-300 dark:border-slate-600"),
        !isGhost && isHighlighted && highlightedCardClassName
      )}
    >
      <div className="flex items-start justify-between gap-3 px-2.5 py-2">
        <div className="min-w-0 flex flex-1 items-center gap-1.5">
          <StatusBadge status={card.status} compact />
          <CampaignNameLabel card={card} variant="inactive" />
        </div>
        <p className="shrink-0 text-xs font-semibold text-slate-800 dark:text-slate-100">${card.minPrice.toFixed(2)}</p>
      </div>

      <div className={inactiveCardActionsClass} data-no-drag>
        <button
          type="button"
          disabled={isGhost || !canMoveToTop}
          onClick={isGhost ? undefined : onMoveToTop}
          className={textActionClass}
        >
          To the top
        </button>
        <button
          type="button"
          disabled={isGhost || !canMoveToBottom}
          onClick={isGhost ? undefined : onMoveToBottom}
          className={textActionClass}
        >
          To the bottom
        </button>
        <PriorityControls position={position} onApplyPosition={isGhost ? () => position : onApplyPosition} />
        {showMockButton ? (
          <button
            type="button"
            disabled={isGhost}
            onClick={isGhost ? undefined : onConfigureMock}
            title="Configure test lead mock response"
            className={iconActionClass}
          >
            <Settings2 size={14} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function PingTreeSettingsPage({
  initialCampaignType = "Redirect",
  configId,
}: {
  initialCampaignType?: PingTreeCampaignType;
  configId?: string;
} = {}) {
  const [activeTab, setActiveTab] = useState<PingTreeCampaignType>(initialCampaignType);
  const [trees, setTrees] = useState<PingTreeRecord[]>([]);
  const [tree, setTree] = useState<PingTreeRecord | null>(null);
  const [pingTreeList, setPingTreeList] = useState<PingTreeCampaignCard[]>([]);
  const [notInPingTree, setNotInPingTree] = useState<PingTreeCampaignCard[]>([]);
  const [priorities, setPriorities] = useState<Record<string, number>>({});
  const [activeSearch, setActiveSearch] = useState("");
  const [inactiveFilter, setInactiveFilter] = useState("");
  const [dragSession, setDragSession] = useState<DragSession | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTabRefreshing, setIsTabRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("ping-tree-test-mode") === "1";
    } catch {
      return false;
    }
  });
  const [mockModalCard, setMockModalCard] = useState<PingTreeCampaignCard | null>(null);
  const [isSavingMock, setIsSavingMock] = useState(false);
  const [highlightedCampaignId, setHighlightedCampaignId] = useState<string | null>(null);
  const [positionSyncKey, setPositionSyncKey] = useState(0);

  const pingTreeListRef = useRef(pingTreeList);
  const notInPingTreeRef = useRef(notInPingTree);
  const prioritiesRef = useRef(priorities);
  const dropTargetRef = useRef<DropTarget | null>(null);
  const dropTargetKeyRef = useRef("");
  const dragSessionRef = useRef<DragSession | null>(null);
  const dragGhostRef = useRef<HTMLDivElement | null>(null);
  const dragRafRef = useRef<number | null>(null);
  const latestPointerRef = useRef<{ x: number; y: number } | null>(null);
  const flipRectsRef = useRef<Map<string, DOMRect>>(new Map());
  const activeColumnRef = useRef<HTMLDivElement | null>(null);
  const activeListRef = useRef<HTMLDivElement | null>(null);
  const inactiveColumnRef = useRef<HTMLDivElement | null>(null);
  const inactiveListRef = useRef<HTMLDivElement | null>(null);
  const isFirstTreeLoadRef = useRef(true);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashHighlight = useCallback((campaignId: string) => {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }

    setHighlightedCampaignId(campaignId);
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedCampaignId(null);
      highlightTimeoutRef.current = null;
    }, 1600);
  }, []);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    pingTreeListRef.current = pingTreeList;
  }, [pingTreeList]);

  useEffect(() => {
    notInPingTreeRef.current = notInPingTree;
  }, [notInPingTree]);

  useEffect(() => {
    prioritiesRef.current = priorities;
  }, [priorities]);

  const activeStats = useMemo(() => countByStatus(pingTreeList), [pingTreeList]);
  const inactiveStats = useMemo(() => countByStatus(notInPingTree), [notInPingTree]);

  const filteredActiveList = useMemo(
    () => pingTreeList.filter((card) => matchesSearch(card, activeSearch)),
    [pingTreeList, activeSearch]
  );

  const filteredInactiveList = useMemo(
    () => notInPingTree.filter((card) => matchesSearch(card, inactiveFilter)),
    [notInPingTree, inactiveFilter]
  );

  const inactiveDisplayOrder = useMemo(() => {
    const groups = new Map<string, PingTreeCampaignCard[]>();

    for (const card of filteredInactiveList) {
      const key = card.buyerLabel || "Unknown";
      const bucket = groups.get(key) ?? [];
      bucket.push(card);
      groups.set(key, bucket);
    }

    return Array.from(groups.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .flatMap(([, cards]) =>
        [...cards].sort((left, right) => {
          if (left.minPrice !== right.minPrice) {
            return left.minPrice - right.minPrice;
          }

          return left.displayId - right.displayId;
        })
      );
  }, [filteredInactiveList]);

  const inactiveGroups = useMemo(() => {
    const groups = new Map<string, PingTreeCampaignCard[]>();

    for (const card of filteredInactiveList) {
      const key = card.buyerLabel || "Unknown";
      const bucket = groups.get(key) ?? [];
      bucket.push(card);
      groups.set(key, bucket);
    }

    return Array.from(groups.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([buyerLabel, cards]) => [
        buyerLabel,
        [...cards].sort((left, right) => {
          if (left.minPrice !== right.minPrice) {
            return left.minPrice - right.minPrice;
          }

          return left.displayId - right.displayId;
        }),
      ] as const);
  }, [filteredInactiveList]);

  const activePreviewItems = useMemo(() => {
    if (!dragSession?.activated) {
      return filteredActiveList.map((card) => {
        const hitIndex = pingTreeList.findIndex((item) => item.id === card.id);
        return { kind: "card" as const, card, hitIndex: Math.max(0, hitIndex) };
      });
    }

    const insertIndex = dropTarget?.side === "active" ? dropTarget.index : null;
    return buildDragPreviewItems(filteredActiveList, dragSession.campaignId, insertIndex);
  }, [dragSession, dropTarget, filteredActiveList, pingTreeList]);

  const inactivePreviewItems = useMemo(() => {
    if (!dragSession?.activated) {
      return null;
    }

    const insertIndex = dropTarget?.side === "inactive" ? dropTarget.index : null;
    return buildDragPreviewItems(inactiveDisplayOrder, dragSession.campaignId, insertIndex);
  }, [dragSession, dropTarget, inactiveDisplayOrder]);

  const setDropTargetWithRef = useCallback((target: DropTarget | null) => {
    const nextKey = dropTargetKey(target);
    if (nextKey === dropTargetKeyRef.current) return;

    dropTargetKeyRef.current = nextKey;
    setDropTarget(target);
    dropTargetRef.current = target;
  }, []);

  const applyTreeData = useCallback(
    (data: {
      tree: PingTreeRecord;
      pingTreeList: PingTreeCampaignCard[];
      notInPingTree: PingTreeCampaignCard[];
    }) => {
      setTree(data.tree);
      setPingTreeList(data.pingTreeList);
      const sortedInactive = sortInactiveCampaignsByBuyerMinPrice(data.notInPingTree);
      setNotInPingTree(sortedInactive);

      const activeIds = data.pingTreeList.map((card) => card.id);
      const inactiveIds = sortedInactive.map((card) => card.id);
      setPriorities(buildDescendingPriorities(activeIds, inactiveIds));
      setPositionSyncKey((current) => current + 1);
      setIsDirty(false);
    },
    []
  );

  const editorTreeUrl = useCallback(
    (treeId: string) =>
      configId
        ? `/api/ping-tree-configs/tree/${encodeURIComponent(treeId)}`
        : `/api/ping-trees/${encodeURIComponent(treeId)}`,
    [configId]
  );

  const loadTree = useCallback(
    async (treeId: string, options?: { withSpinner?: boolean }) => {
      const withSpinner = options?.withSpinner ?? true;
      if (withSpinner) {
        setIsLoading(true);
      } else {
        setIsTabRefreshing(true);
      }

      try {
        const response = await fetch(editorTreeUrl(treeId));
        if (!response.ok) {
          setLoadError("Failed to load ping tree campaigns. Please go back and try again.");
          return;
        }
        const data = (await response.json()) as {
          tree: PingTreeRecord;
          pingTreeList: PingTreeCampaignCard[];
          notInPingTree: PingTreeCampaignCard[];
        };
        setLoadError(null);
        applyTreeData(data);
      } catch {
        setLoadError("Failed to load ping tree campaigns. Please go back and try again.");
      } finally {
        if (withSpinner) {
          setIsLoading(false);
        } else {
          setIsTabRefreshing(false);
        }
      }
    },
    [applyTreeData, editorTreeUrl]
  );

  useEffect(() => {
    if (configId) return;
    void (async () => {
      const response = await fetch("/api/ping-trees");
      if (!response.ok) return;
      const fetchedTrees = (await response.json()) as PingTreeRecord[];
      setTrees(fetchedTrees);
    })();
  }, [configId]);

  useEffect(() => {
    if (configId) {
      const withSpinner = isFirstTreeLoadRef.current;
      isFirstTreeLoadRef.current = false;
      void loadTree(configId, { withSpinner });
      return;
    }

    const matchedTree = trees.find((item) => item.campaignType === activeTab);
    if (!matchedTree?.id) return;

    const withSpinner = isFirstTreeLoadRef.current;
    isFirstTreeLoadRef.current = false;
    void loadTree(matchedTree.id, { withSpinner });
  }, [activeTab, loadTree, trees, configId]);

  const handleTabChange = (tab: PingTreeCampaignType) => {
    if (tab === activeTab) return;

    if (isDirty && !window.confirm("You have unsaved ping tree changes. Discard them and switch tab?")) {
      return;
    }

    setActiveSearch("");
    setInactiveFilter("");
    setDragSession(null);
    dragSessionRef.current = null;
    setDropTarget(null);
    latestPointerRef.current = null;
    dropTargetKeyRef.current = "";
    dropTargetRef.current = null;
    flipRectsRef.current.clear();
    setIsDirty(false);
    setActiveTab(tab);
  };

  const updateCardTestMock = useCallback((campaignId: string, mock: CampaignTestMockResponse | null) => {
    const apply = (cards: PingTreeCampaignCard[]) =>
      cards.map((card) => (card.id === campaignId ? { ...card, testMock: mock } : card));

    setPingTreeList((current) => apply(current));
    setNotInPingTree((current) => apply(current));
    pingTreeListRef.current = apply(pingTreeListRef.current);
    notInPingTreeRef.current = apply(notInPingTreeRef.current);
  }, []);

  const saveCampaignTestMock = useCallback(
    async (campaignId: string, mock: CampaignTestMockResponse) => {
      if (!tree) return;

      setIsSavingMock(true);
      try {
        const response = await fetch(editorTreeUrl(tree.id), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignTestMocks: {
              [campaignId]: mock,
            },
          }),
        });

        if (!response.ok) {
          toast.error("Failed to save test mock.");
          return;
        }

        updateCardTestMock(campaignId, mock);
        toast.success("Test mock saved.");
        setMockModalCard(null);
      } finally {
        setIsSavingMock(false);
      }
    },
    [tree, updateCardTestMock, editorTreeUrl]
  );

  const clearCampaignTestMock = useCallback(
    async (campaignId: string) => {
      if (!tree) return;

      setIsSavingMock(true);
      try {
        const response = await fetch(editorTreeUrl(tree.id), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignTestMocks: {
              [campaignId]: null,
            },
          }),
        });

        if (!response.ok) {
          toast.error("Failed to clear test mock.");
          return;
        }

        updateCardTestMock(campaignId, null);
        toast.success("Test mock cleared.");
        setMockModalCard(null);
      } finally {
        setIsSavingMock(false);
      }
    },
    [tree, updateCardTestMock, editorTreeUrl]
  );

  const saveTree = useCallback(
    async (nextActiveIds: string[], nextInactiveIds: string[], nextPriorities: Record<string, number>) => {
      if (!tree) return false;

      setIsSaving(true);

      try {
        const response = await fetch(editorTreeUrl(tree.id), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            activeCampaignIds: nextActiveIds,
            inactiveCampaignIds: nextInactiveIds,
            campaignPriorities: nextPriorities,
          }),
        });

        if (response.ok) {
          toast.success("Ping tree saved.");
          setIsDirty(false);
          await loadTree(tree.id, { withSpinner: false });
          return true;
        }

        toast.error("Failed to save ping tree.");
        await loadTree(tree.id, { withSpinner: false });
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [loadTree, tree, editorTreeUrl]
  );

  const handleSave = useCallback(() => {
    const activeIds = pingTreeListRef.current.map((item) => item.id);
    const inactiveIds = notInPingTreeRef.current.map((item) => item.id);
    const syncedPriorities = buildDescendingPriorities(activeIds, inactiveIds);
    setPriorities(syncedPriorities);
    prioritiesRef.current = syncedPriorities;
    void saveTree(activeIds, inactiveIds, syncedPriorities);
  }, [saveTree]);

  const applyLists = useCallback((nextActiveIds: string[], nextInactiveIds: string[]) => {
    const lookup = new Map(
      [...pingTreeListRef.current, ...notInPingTreeRef.current].map((card) => [card.id, card])
    );

    const nextActive = nextActiveIds
      .map((id) => lookup.get(id))
      .filter((item): item is PingTreeCampaignCard => Boolean(item));
    const nextInactive = sortInactiveCampaignsByBuyerMinPrice(
      nextInactiveIds
        .map((id) => lookup.get(id))
        .filter((item): item is PingTreeCampaignCard => Boolean(item))
    );

    pingTreeListRef.current = nextActive;
    notInPingTreeRef.current = nextInactive;
    setPingTreeList(nextActive);
    setNotInPingTree(nextInactive);
  }, []);

  const applyOrderChange = useCallback(
    (nextActiveIds: string[], nextInactiveIds: string[], highlightId?: string) => {
      applyLists(nextActiveIds, nextInactiveIds);
      const sortedInactiveIds = notInPingTreeRef.current.map((item) => item.id);
      setPriorities((current) =>
        syncDescendingPriorities(sortedInactiveIds, syncDescendingPriorities(nextActiveIds, current))
      );
      setPositionSyncKey((current) => current + 1);
      setIsDirty(true);
      if (highlightId) {
        flashHighlight(highlightId);
      }
    },
    [applyLists, flashHighlight]
  );

  const insertAtIndex = (ids: string[], campaignId: string, insertIndex: number | "end") => {
    const nextIds = ids.filter((id) => id !== campaignId);
    if (insertIndex === "end") {
      nextIds.push(campaignId);
    } else {
      nextIds.splice(insertIndex, 0, campaignId);
    }
    return nextIds;
  };

  const insertIntoActive = useCallback(
    (campaignId: string, insertIndex: number | "end", highlightId?: string) => {
      const activeIds = insertAtIndex(
        pingTreeListRef.current.map((item) => item.id),
        campaignId,
        insertIndex
      );
      const inactiveIds = notInPingTreeRef.current.map((item) => item.id).filter((id) => id !== campaignId);
      applyOrderChange(activeIds, inactiveIds, highlightId ?? campaignId);
    },
    [applyOrderChange]
  );

  const insertIntoInactive = useCallback(
    (campaignId: string, insertIndex: number | "end", highlightId?: string) => {
      const activeIds = pingTreeListRef.current.map((item) => item.id).filter((id) => id !== campaignId);
      const inactiveIds = insertAtIndex(
        notInPingTreeRef.current.map((item) => item.id),
        campaignId,
        insertIndex
      );
      applyOrderChange(activeIds, inactiveIds, highlightId ?? campaignId);
    },
    [applyOrderChange]
  );

  const moveActiveByStep = (campaignId: string, direction: "up" | "down") => {
    const activeIds = pingTreeListRef.current.map((item) => item.id);
    const index = activeIds.indexOf(campaignId);
    if (index < 0) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activeIds.length) return;

    const [movedId] = activeIds.splice(index, 1);
    activeIds.splice(targetIndex, 0, movedId);
    applyOrderChange(activeIds, notInPingTreeRef.current.map((item) => item.id), campaignId);
  };

  const moveActiveToPosition = (campaignId: string, descendingPosition: number) => {
    const activeIds = pingTreeListRef.current.map((item) => item.id);
    const listLength = activeIds.length;
    if (listLength === 0) return 1;

    const index = activeIds.indexOf(campaignId);
    if (index < 0) return 1;

    const targetIndex = descendingPositionToIndex(descendingPosition, listLength);
    if (targetIndex !== index) {
      const [movedId] = activeIds.splice(index, 1);
      activeIds.splice(targetIndex, 0, movedId);
      applyOrderChange(activeIds, notInPingTreeRef.current.map((item) => item.id), campaignId);
    }

    return resolveDescendingPosition(descendingPosition, listLength);
  };

  const moveInactiveToPosition = (campaignId: string, descendingPosition: number) => {
    const inactiveIds = notInPingTreeRef.current.map((item) => item.id);
    const listLength = inactiveIds.length;
    if (listLength === 0) return 1;

    const index = inactiveIds.indexOf(campaignId);
    if (index < 0) return 1;

    const targetIndex = descendingPositionToIndex(descendingPosition, listLength);
    if (targetIndex !== index) {
      const [movedId] = inactiveIds.splice(index, 1);
      inactiveIds.splice(targetIndex, 0, movedId);
      applyOrderChange(pingTreeListRef.current.map((item) => item.id), inactiveIds, campaignId);
    }

    return resolveDescendingPosition(descendingPosition, listLength);
  };

  const moveInactiveToEdge = (campaignId: string, edge: "top" | "bottom") => {
    const inactiveIds = notInPingTreeRef.current.map((item) => item.id);
    const index = inactiveIds.indexOf(campaignId);
    if (index < 0) return;

    const [movedId] = inactiveIds.splice(index, 1);
    if (edge === "top") {
      inactiveIds.unshift(movedId);
    } else {
      inactiveIds.push(movedId);
    }
    applyOrderChange(pingTreeListRef.current.map((item) => item.id), inactiveIds, campaignId);
  };

  const executeDrop = useCallback(
    (campaignId: string, sourceSide: "active" | "inactive", target: DropTarget) => {
      if (target.side === "active") {
        insertIntoActive(campaignId, target.index);
        return;
      }

      if (sourceSide === "inactive") {
        insertIntoInactive(campaignId, target.index);
        return;
      }

      insertIntoInactive(campaignId, target.index);
    },
    [insertIntoActive, insertIntoInactive]
  );

  const resolvePointerDropTarget = useCallback((clientX: number, clientY: number): DropTarget | null => {
    const element = document.elementFromPoint(clientX, clientY);

    const inactiveList = inactiveListRef.current;
    const inactiveColumn = inactiveColumnRef.current;
    if (inactiveList && inactiveColumn?.contains(element)) {
      return {
        side: "inactive",
        index: resolveInsertIndexFromPointer(inactiveList, clientY, "[data-ping-tree-inactive-card-index]"),
      };
    }

    const activeList = activeListRef.current;
    const activeColumn = activeColumnRef.current;
    if (activeList && activeColumn?.contains(element)) {
      return {
        side: "active",
        index: resolveInsertIndexFromPointer(activeList, clientY, "[data-ping-tree-card-index]"),
      };
    }

    return null;
  }, []);

  const updateDropTargetFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      setDropTargetWithRef(resolvePointerDropTarget(clientX, clientY));
    },
    [resolvePointerDropTarget, setDropTargetWithRef]
  );

  const updateGhostPosition = useCallback((clientX: number, clientY: number) => {
    const ghost = dragGhostRef.current;
    const session = dragSessionRef.current;
    if (!ghost || !session) return;

    ghost.style.transform = `translate3d(${clientX - session.offsetX}px, ${clientY - session.offsetY}px, 0)`;
    ghost.style.width = `${session.width}px`;
  }, []);

  const clearDragState = useCallback(() => {
    if (dragRafRef.current !== null) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }

    dragSessionRef.current = null;
    latestPointerRef.current = null;
    flipRectsRef.current.clear();
    setDragSession(null);
    setDropTargetWithRef(null);
    dropTargetKeyRef.current = "";
  }, [setDropTargetWithRef]);

  const activateDragSession = useCallback(
    (session: DragSession, clientX: number, clientY: number) => {
      const activatedSession = { ...session, activated: true };
      dragSessionRef.current = activatedSession;
      setDragSession(activatedSession);
      latestPointerRef.current = { x: clientX, y: clientY };
      updateDropTargetFromPointer(clientX, clientY);
    },
    [updateDropTargetFromPointer]
  );

  const startPointerDrag = (campaignId: string, sourceSide: "active" | "inactive", event: React.PointerEvent) => {
    if (event.button !== 0 || shouldIgnoreCardDrag(event.target)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const cardElement = event.currentTarget as HTMLElement;
    const rect = cardElement.getBoundingClientRect();

    const session: DragSession = {
      campaignId,
      sourceSide,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      activated: false,
    };

    dragSessionRef.current = session;
    latestPointerRef.current = { x: event.clientX, y: event.clientY };
    setDragSession(session);
  };

  useLayoutEffect(() => {
    if (!dragSession?.activated) return;

    const pointer = latestPointerRef.current;
    if (!pointer) return;

    updateGhostPosition(pointer.x, pointer.y);
  }, [dragSession?.activated, dragSession?.campaignId, updateGhostPosition]);

  useLayoutEffect(() => {
    if (!dragSession?.activated) {
      flipRectsRef.current.clear();
      return;
    }

    const roots = [activeListRef.current, inactiveListRef.current];
    const nextRects = new Map<string, DOMRect>();

    for (const root of roots) {
      if (!root) continue;

      root.querySelectorAll<HTMLElement>("[data-flip-id]").forEach((element) => {
        const flipId = element.dataset.flipId;
        if (!flipId) return;

        const nextRect = element.getBoundingClientRect();
        nextRects.set(flipId, nextRect);

        const prevRect = flipRectsRef.current.get(flipId);
        if (!prevRect) return;

        const dx = prevRect.left - nextRect.left;
        const dy = prevRect.top - nextRect.top;
        if (dx === 0 && dy === 0) return;

        element.style.transition = "none";
        element.style.transform = `translate(${dx}px, ${dy}px)`;

        requestAnimationFrame(() => {
          element.style.transition = `transform ${DRAG_FLIP_MS}ms cubic-bezier(0.2, 0.9, 0.3, 1)`;
          element.style.transform = "";
        });
      });
    }

    flipRectsRef.current = nextRects;
  }, [activePreviewItems, inactivePreviewItems, dragSession?.activated]);

  useEffect(() => {
    if (!dragSession) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== dragSession.pointerId) return;

      latestPointerRef.current = { x: event.clientX, y: event.clientY };

      if (dragRafRef.current !== null) return;

      dragRafRef.current = requestAnimationFrame(() => {
        dragRafRef.current = null;

        const session = dragSessionRef.current;
        const pointer = latestPointerRef.current;
        if (!session || !pointer) return;

        if (!session.activated) {
          const distance = Math.hypot(pointer.x - session.startX, pointer.y - session.startY);
          if (distance < DRAG_ACTIVATION_DISTANCE_PX) {
            return;
          }

          activateDragSession(session, pointer.x, pointer.y);
          return;
        }

        updateGhostPosition(pointer.x, pointer.y);
        autoScrollListNearEdge(activeListRef.current, pointer.y);
        autoScrollListNearEdge(inactiveListRef.current, pointer.y);
        updateDropTargetFromPointer(pointer.x, pointer.y);
      });
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId !== dragSession.pointerId) return;

      const session = dragSessionRef.current;
      if (session?.activated) {
        const target = dropTargetRef.current ?? resolvePointerDropTarget(event.clientX, event.clientY);
        if (target) {
          executeDrop(session.campaignId, session.sourceSide, target);
        }
      }

      clearDragState();
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [
    activateDragSession,
    clearDragState,
    dragSession,
    executeDrop,
    resolvePointerDropTarget,
    updateDropTargetFromPointer,
    updateGhostPosition,
  ]);

  useEffect(() => {
    if (!dragSession?.activated) return;

    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";

    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
    };
  }, [dragSession?.activated]);

  const isDragging = Boolean(dragSession?.activated);
  const draggedCard =
    dragSession &&
    [...pingTreeList, ...notInPingTree].find((card) => card.id === dragSession.campaignId);

  return (
    <div className="space-y-6">
      {configId ? null : (
        <PageTabBar
          tabs={PING_TREE_CAMPAIGN_TYPE_TABS.map((tab) => ({ id: tab, label: tab }))}
          activeTabId={activeTab}
          onTabChange={handleTabChange}
        />
      )}

      {configId && tree ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Ping Tree
          </span>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {tree.displayId ? `#${tree.displayId} · ` : ""}
            {tree.name}
          </h2>
          <span className="rounded-full border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-500 dark:border-slate-600 dark:text-slate-400">
            {tree.campaignType}
          </span>
        </div>
      ) : null}

      {isLoading && !tree ? (
        <ContentAreaLoading message="Loading ping tree..." />
      ) : loadError && !tree ? (
        <PageSection>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-center dark:border-amber-500/30 dark:bg-amber-500/10">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">{loadError}</p>
          </div>
        </PageSection>
      ) : tree ? (
      <PageSection>
        <div className="relative">
          {isTabRefreshing ? <LoadingOverlay /> : null}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            {isDragging ? (
              <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
                <ArrowDown size={14} className="shrink-0 rotate-180" />
                Drag to reorder — other cards shift to show the drop position.
              </p>
            ) : null}
            {isDirty ? (
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Unsaved changes</p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor="ping-tree-test-mode"
              className="mr-1 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              title="Shows mock settings buttons. Mock responses are used after you Save mock on each campaign."
            >
              <span className="font-medium">Test Mode</span>
              <ToggleSwitch
                id="ping-tree-test-mode"
                checked={testMode}
                onChange={(checked) => {
                  setTestMode(checked);
                  try {
                    window.localStorage.setItem("ping-tree-test-mode", checked ? "1" : "0");
                  } catch {
                    // Ignore storage errors (private mode, quota, etc.).
                  }
                  if (!checked) {
                    setMockModalCard(null);
                  }
                }}
              />
            </label>
            <PrimaryButton type="button" onClick={handleSave} disabled={!isDirty || isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </PrimaryButton>
            <Link href="/campaigns" className={cn(cancelButtonClassName, "w-full justify-center sm:w-auto")}>
              View Campaigns
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)]">
          <div
            ref={activeColumnRef}
            className="flex flex-col overflow-hidden rounded-lg border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900"
          >
            <ColumnStatsBar
              disabled={activeStats.disabled}
              active={activeStats.active}
              total={activeStats.total}
            />

            <div className="flex flex-col gap-2 border-b border-slate-200 px-3 py-2.5 dark:border-slate-700 sm:flex-row sm:items-center sm:gap-3">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Ping Tree List</h3>
              <div className="relative w-full sm:ml-auto sm:max-w-xs sm:flex-1">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={activeSearch}
                  onChange={(event) => setActiveSearch(event.target.value)}
                  placeholder="Search campaigns..."
                  className="h-8 py-1 pl-8 text-xs"
                />
              </div>
            </div>

            <div ref={activeListRef} className="relative max-h-[min(52vh,28rem)] flex-1 space-y-2 overflow-y-auto p-2 sm:max-h-[72vh]">
              {activePreviewItems.length === 0 ? (
                <div className="rounded border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400 dark:border-slate-600">
                  {isDragging ? "Drop here to add to ping tree" : "No campaigns in ping tree"}
                </div>
              ) : (
                activePreviewItems.map((item, itemIndex) => {
                  if (item.kind === "placeholder") {
                    return (
                      <DropPlaceholder
                        key={`active-placeholder-${itemIndex}`}
                        height={dragSession?.height ?? 72}
                        tone="active"
                      />
                    );
                  }

                  const { card, hitIndex } = item;
                  const listLength = dragSession?.activated
                    ? Math.max(
                        filteredActiveList.filter((entry) => entry.id !== dragSession.campaignId).length,
                        1
                      )
                    : Math.max(pingTreeList.length, 1);
                  const position = toDescendingPosition(hitIndex, listLength);

                  return (
                    <div
                      key={card.id}
                      data-flip-id={`active-${card.id}`}
                      data-ping-tree-card-index={hitIndex}
                      className="will-change-transform"
                    >
                      <ActiveCampaignCard
                        card={card}
                        position={position}
                        isDragging={false}
                        isHighlighted={highlightedCampaignId === card.id}
                        canMoveUp={hitIndex > 0}
                        canMoveDown={hitIndex < listLength - 1}
                        onCardPointerDown={(event) => startPointerDrag(card.id, "active", event)}
                        onApplyPosition={(value) => moveActiveToPosition(card.id, value)}
                        onRemove={() => insertIntoInactive(card.id, 0)}
                        onMoveUp={() => moveActiveByStep(card.id, "up")}
                        onMoveDown={() => moveActiveByStep(card.id, "down")}
                        onConfigureMock={() => setMockModalCard(card)}
                        showMockButton={testMode}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div
            ref={inactiveColumnRef}
            className="flex flex-col overflow-hidden rounded-lg border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900"
          >
            <ColumnStatsBar
              disabled={inactiveStats.disabled}
              active={inactiveStats.active}
              total={inactiveStats.total}
            />

            <div className="flex flex-col gap-2 border-b border-slate-200 px-3 py-2.5 dark:border-slate-700 sm:flex-row sm:items-center sm:gap-2">
              <h3 className="text-base font-semibold text-slate-800 sm:text-lg dark:text-slate-100">Not In Ping Tree</h3>
              <div className="relative w-full sm:ml-auto sm:max-w-xs sm:flex-1">
                <Filter size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={inactiveFilter}
                  onChange={(event) => setInactiveFilter(event.target.value)}
                  placeholder="Filter..."
                  className="h-8 py-1 pl-8 text-xs"
                />
              </div>
            </div>

            <div ref={inactiveListRef} className="relative max-h-[min(52vh,28rem)] flex-1 overflow-y-auto p-2 sm:max-h-[72vh]">
              {isDragging && inactivePreviewItems ? (
                inactivePreviewItems.length === 0 ? (
                  <div className="rounded border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400 dark:border-slate-600">
                    Drop here to remove from ping tree
                  </div>
                ) : (
                  <div className="space-y-2">
                    {inactivePreviewItems.map((item, itemIndex) => {
                      if (item.kind === "placeholder") {
                        return (
                          <DropPlaceholder
                            key={`inactive-placeholder-${itemIndex}`}
                            height={dragSession?.height ?? 72}
                            tone="inactive"
                          />
                        );
                      }

                      const { card, hitIndex } = item;
                      const listLength = Math.max(
                        inactiveDisplayOrder.filter((entry) => entry.id !== dragSession?.campaignId).length,
                        1
                      );
                      const position = toDescendingPosition(hitIndex, listLength);

                      return (
                        <div
                          key={card.id}
                          data-flip-id={`inactive-${card.id}`}
                          data-ping-tree-inactive-card-index={hitIndex}
                          className="will-change-transform"
                        >
                          <InactiveCampaignCard
                            card={card}
                            position={position}
                            isDragging={false}
                            isHighlighted={highlightedCampaignId === card.id}
                            canMoveToTop={hitIndex > 0}
                            canMoveToBottom={hitIndex < listLength - 1}
                            onCardPointerDown={(event) => startPointerDrag(card.id, "inactive", event)}
                            onApplyPosition={(value) => moveInactiveToPosition(card.id, value)}
                            onMoveToTop={() => moveInactiveToEdge(card.id, "top")}
                            onMoveToBottom={() => moveInactiveToEdge(card.id, "bottom")}
                            onConfigureMock={() => setMockModalCard(card)}
                            showMockButton={testMode}
                          />
                        </div>
                      );
                    })}
                  </div>
                )
              ) : filteredInactiveList.length === 0 ? (
                <div className="rounded border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400 dark:border-slate-600">
                  All campaigns are in ping tree
                </div>
              ) : (
                inactiveGroups.map(([buyerLabel, cards]) => (
                  <div key={buyerLabel} className="mb-3 last:mb-0">
                    <h4 className="mb-1.5 px-1 text-lg font-bold text-slate-900 sm:text-xl dark:text-slate-100">{buyerLabel}</h4>
                    <div className="space-y-2">
                      {cards.map((card) => {
                        const index = inactiveDisplayOrder.findIndex((item) => item.id === card.id);
                        const position =
                          index < 0 ? 1 : toDescendingPosition(index, inactiveDisplayOrder.length);
                        return (
                          <div
                            key={card.id}
                            data-flip-id={`inactive-${card.id}`}
                            data-ping-tree-inactive-card-index={index}
                            className="will-change-transform"
                          >
                            <InactiveCampaignCard
                              card={card}
                              position={position}
                              isDragging={false}
                              isHighlighted={highlightedCampaignId === card.id}
                              canMoveToTop={index > 0}
                              canMoveToBottom={index < inactiveDisplayOrder.length - 1}
                              onCardPointerDown={(event) => startPointerDrag(card.id, "inactive", event)}
                              onApplyPosition={(value) => moveInactiveToPosition(card.id, value)}
                              onMoveToTop={() => moveInactiveToEdge(card.id, "top")}
                              onMoveToBottom={() => moveInactiveToEdge(card.id, "bottom")}
                              onConfigureMock={() => setMockModalCard(card)}
                              showMockButton={testMode}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        </div>
      </PageSection>
      ) : null}

      {dragSession?.activated && draggedCard ? (
        <div
          ref={dragGhostRef}
          className="pointer-events-none fixed left-0 top-0 z-50 will-change-transform"
          style={{
            transform: "translate3d(-9999px, -9999px, 0)",
            width: dragSession.width,
          }}
        >
          {dragSession.sourceSide === "active" ? (
            <ActiveCampaignCard
              card={draggedCard}
              position={(() => {
                const index = pingTreeList.findIndex((item) => item.id === draggedCard.id);
                return index < 0 ? 1 : toDescendingPosition(index, Math.max(pingTreeList.length, 1));
              })()}
              isDragging={false}
              isHighlighted={false}
              isGhost
              canMoveUp={false}
              canMoveDown={false}
              onApplyPosition={(value) => value}
              onRemove={() => undefined}
              onMoveUp={() => undefined}
              onMoveDown={() => undefined}
              onConfigureMock={() => undefined}
              showMockButton={testMode}
            />
          ) : (
            <InactiveCampaignCard
              card={draggedCard}
              position={(() => {
                const index = notInPingTree.findIndex((item) => item.id === draggedCard.id);
                return index < 0 ? 1 : toDescendingPosition(index, Math.max(notInPingTree.length, 1));
              })()}
              isDragging={false}
              isHighlighted={false}
              isGhost
              canMoveToTop={false}
              canMoveToBottom={false}
              onApplyPosition={(value) => value}
              onMoveToTop={() => undefined}
              onMoveToBottom={() => undefined}
              onConfigureMock={() => undefined}
              showMockButton={testMode}
            />
          )}
        </div>
      ) : null}

      <CampaignTestMockModal
        open={Boolean(mockModalCard)}
        card={mockModalCard}
        isSaving={isSavingMock}
        onClose={() => setMockModalCard(null)}
        onSave={saveCampaignTestMock}
        onClear={clearCampaignTestMock}
      />
    </div>
  );
}
