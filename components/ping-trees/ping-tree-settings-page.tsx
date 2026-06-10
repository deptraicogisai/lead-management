"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Filter,
  HelpCircle,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/form-controls";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageSection, Spinner } from "@/components/ui/state";
import {
  PING_TREE_CAMPAIGN_TYPE_TABS,
  PING_TREE_STRATEGY_OPTIONS,
  type PingTreeCampaignCard,
  type PingTreeCampaignType,
  type PingTreeRecord,
} from "@/lib/ping-tree";
import { cn } from "@/lib/utils";

type DropTarget = {
  side: "active" | "inactive";
  index: number | "end";
};

type DragSession = {
  campaignId: string;
  sourceSide: "active" | "inactive";
  pointerId: number;
};

type DropIndicatorPosition = {
  side: "active" | "inactive";
  top: number;
};

function dropTargetKey(target: DropTarget | null) {
  if (!target) return "";
  return `${target.side}:${target.index}`;
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
    const cardIndex = Number.parseInt(element.dataset.pingTreeCardIndex ?? "0", 10);
    const midpoint = rect.top + rect.height / 2;

    if (pointerY < midpoint) {
      return cardIndex;
    }
  }

  return "end";
}

function computeIndicatorTop(
  columnElement: HTMLElement,
  listElement: HTMLElement,
  cardSelector: string,
  index: number | "end"
): number {
  const columnRect = columnElement.getBoundingClientRect();
  const cardElements = Array.from(listElement.querySelectorAll<HTMLElement>(cardSelector));

  if (cardElements.length === 0) {
    return listElement.getBoundingClientRect().top - columnRect.top + 8;
  }

  if (index === "end") {
    const last = cardElements[cardElements.length - 1];
    return last.getBoundingClientRect().bottom - columnRect.top + 4;
  }

  const card = cardElements[index];
  return card.getBoundingClientRect().top - columnRect.top - 4;
}

function ColumnStatsBar({ disabled, active, total }: { disabled: number; active: number; total: number }) {
  return (
    <div className="border-b border-sky-200 bg-sky-100 px-3 py-2 text-sm text-slate-700 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-slate-200">
      <span className="font-medium">Disabled: {disabled}</span>
      <span className="mx-3">Active: {active}</span>
      <span>Total: {total}</span>
    </div>
  );
}

const greenControlClass =
  "bg-emerald-800 text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-emerald-700 dark:hover:bg-emerald-600";

function DropIndicator({ top, tone }: { top: number; tone: "active" | "inactive" }) {
  const isActive = tone === "active";

  return (
    <div className="pointer-events-none absolute inset-x-2 z-20 flex items-center gap-2" style={{ top }}>
      <div className={cn("h-0.5 flex-1 rounded-full", isActive ? "bg-emerald-500" : "bg-rose-400")} />
      <span
        className={cn(
          "rounded px-2 py-0.5 text-[11px] font-medium shadow-sm",
          isActive ? "bg-emerald-600 text-white" : "bg-rose-400 text-white"
        )}
      >
        Drop here
      </span>
      <div className={cn("h-0.5 flex-1 rounded-full", isActive ? "bg-emerald-500" : "bg-rose-400")} />
    </div>
  );
}

function DragHandle({
  onPointerDown,
  compact = false,
  className,
}: {
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      title="Drag to move"
      style={{ touchAction: "none" }}
      className={cn(
        "flex shrink-0 cursor-grab items-center justify-center rounded transition active:cursor-grabbing",
        greenControlClass,
        compact ? "h-7 w-7" : "h-8 w-8",
        className
      )}
    >
      <Crosshair size={compact ? 14 : 16} />
    </div>
  );
}

function PriorityControls({
  priority,
  onPriorityChange,
  onSetPriority,
  compact = false,
}: {
  priority: number;
  onPriorityChange: (value: number) => void;
  onSetPriority: () => void;
  compact?: boolean;
}) {
  return (
    <>
      <input
        type="number"
        value={priority}
        onChange={(event) => onPriorityChange(Number(event.target.value))}
        className={cn(
          "rounded border border-slate-300 bg-white text-center dark:border-slate-600 dark:bg-slate-800",
          compact ? "h-7 w-10 text-[11px]" : "h-8 w-12 text-xs"
        )}
      />
      <button
        type="button"
        onClick={onSetPriority}
        className={cn("rounded font-medium", greenControlClass, compact ? "px-2 py-1 text-[11px]" : "px-2.5 py-1.5 text-xs")}
      >
        Set
      </button>
    </>
  );
}

function ActiveCampaignCard({
  card,
  index,
  isDragging,
  priority,
  canMoveUp,
  canMoveDown,
  onGripPointerDown,
  onPriorityChange,
  onSetPriority,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  card: PingTreeCampaignCard;
  index: number;
  isDragging: boolean;
  priority: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onGripPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPriorityChange: (value: number) => void;
  onSetPriority: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded border bg-white dark:bg-slate-900",
        isDragging ? "border-emerald-400 opacity-50" : "border-slate-300 dark:border-slate-600"
      )}
    >
      <div className="flex items-start gap-3 p-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start gap-2">
            <StatusBadge status={card.status} variant="solid" />
            <p className="text-sm leading-snug text-slate-800 dark:text-slate-100">{formatCampaignLabel(card)}</p>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">${card.minPrice.toFixed(2)}</p>
          <div className="mt-1.5 flex flex-wrap items-center justify-end gap-1">
            <DragHandle onPointerDown={onGripPointerDown} />
            <button
              type="button"
              disabled={!canMoveUp}
              onClick={onMoveUp}
              title="Move up"
              className={cn("inline-flex h-8 w-8 items-center justify-center rounded", greenControlClass)}
            >
              <ChevronUp size={16} />
            </button>
            <button
              type="button"
              disabled={!canMoveDown}
              onClick={onMoveDown}
              title="Move down"
              className={cn("inline-flex h-8 w-8 items-center justify-center rounded", greenControlClass)}
            >
              <ChevronDown size={16} />
            </button>
            <button
              type="button"
              onClick={onRemove}
              className={cn("rounded px-2.5 py-1.5 text-xs font-medium", greenControlClass)}
            >
              Remove
            </button>
            <PriorityControls
              priority={priority}
              onPriorityChange={onPriorityChange}
              onSetPriority={onSetPriority}
            />
          </div>
          <p className="mt-1 text-[10px] text-slate-400">#{index + 1}</p>
        </div>
      </div>
    </div>
  );
}

function InactiveCampaignCard({
  card,
  priority,
  canMoveToTop,
  canMoveToBottom,
  isDragging,
  onGripPointerDown,
  onPriorityChange,
  onSetPriority,
  onMoveToTop,
  onMoveToBottom,
}: {
  card: PingTreeCampaignCard;
  priority: number;
  canMoveToTop: boolean;
  canMoveToBottom: boolean;
  isDragging: boolean;
  onGripPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPriorityChange: (value: number) => void;
  onSetPriority: () => void;
  onMoveToTop: () => void;
  onMoveToBottom: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded border bg-white dark:bg-slate-900",
        isDragging ? "border-emerald-400 opacity-50" : "border-slate-300 dark:border-slate-600"
      )}
    >
      <div className="flex items-start justify-between gap-2 p-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={card.status} variant="solid" compact />
            <p className="truncate text-xs text-slate-800 dark:text-slate-100">{formatCampaignLabel(card)}</p>
          </div>
        </div>
        <p className="shrink-0 text-xs font-semibold text-slate-800 dark:text-slate-100">${card.minPrice.toFixed(2)}</p>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-t border-slate-100 px-2 py-1.5 dark:border-slate-800">
        <DragHandle onPointerDown={onGripPointerDown} compact />
        <button
          type="button"
          disabled={!canMoveToTop}
          onClick={onMoveToTop}
          className={cn("rounded px-2 py-1 text-[11px] font-medium", greenControlClass)}
        >
          To the top
        </button>
        <button
          type="button"
          disabled={!canMoveToBottom}
          onClick={onMoveToBottom}
          className={cn("rounded px-2 py-1 text-[11px] font-medium", greenControlClass)}
        >
          To the bottom
        </button>
        <PriorityControls
          priority={priority}
          onPriorityChange={onPriorityChange}
          onSetPriority={onSetPriority}
          compact
        />
      </div>
    </div>
  );
}

export function PingTreeSettingsPage() {
  const [activeTab, setActiveTab] = useState<PingTreeCampaignType>("Redirect");
  const [trees, setTrees] = useState<PingTreeRecord[]>([]);
  const [tree, setTree] = useState<PingTreeRecord | null>(null);
  const [pingTreeList, setPingTreeList] = useState<PingTreeCampaignCard[]>([]);
  const [notInPingTree, setNotInPingTree] = useState<PingTreeCampaignCard[]>([]);
  const [priorities, setPriorities] = useState<Record<string, number>>({});
  const [activeSearch, setActiveSearch] = useState("");
  const [inactiveFilter, setInactiveFilter] = useState("");
  const [dragSession, setDragSession] = useState<DragSession | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicatorPosition | null>(null);
  const [pointerPosition, setPointerPosition] = useState<{ x: number; y: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  const pingTreeListRef = useRef(pingTreeList);
  const notInPingTreeRef = useRef(notInPingTree);
  const prioritiesRef = useRef(priorities);
  const dropTargetRef = useRef<DropTarget | null>(null);
  const dropTargetKeyRef = useRef("");
  const activeColumnRef = useRef<HTMLDivElement | null>(null);
  const activeListRef = useRef<HTMLDivElement | null>(null);
  const inactiveColumnRef = useRef<HTMLDivElement | null>(null);
  const inactiveListRef = useRef<HTMLDivElement | null>(null);

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

  const inactiveGroups = useMemo(() => {
    const groups = new Map<string, PingTreeCampaignCard[]>();

    for (const card of filteredInactiveList) {
      const key = card.buyerLabel || "Unknown";
      const bucket = groups.get(key) ?? [];
      bucket.push(card);
      groups.set(key, bucket);
    }

    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredInactiveList]);

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
      setNotInPingTree(data.notInPingTree);

      const nextPriorities: Record<string, number> = {};
      for (const card of data.pingTreeList) nextPriorities[card.id] = card.priority;
      for (const card of data.notInPingTree) nextPriorities[card.id] = card.priority;
      setPriorities(nextPriorities);
    },
    []
  );

  const loadTree = useCallback(
    async (treeId: string, options?: { withSpinner?: boolean }) => {
      const withSpinner = options?.withSpinner ?? true;
      if (withSpinner) setIsLoading(true);

      try {
        const response = await fetch(`/api/ping-trees/${encodeURIComponent(treeId)}`);
        if (!response.ok) return;
        const data = (await response.json()) as {
          tree: PingTreeRecord;
          pingTreeList: PingTreeCampaignCard[];
          notInPingTree: PingTreeCampaignCard[];
        };
        applyTreeData(data);
      } finally {
        if (withSpinner) setIsLoading(false);
      }
    },
    [applyTreeData]
  );

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/ping-trees");
      if (!response.ok) return;
      const fetchedTrees = (await response.json()) as PingTreeRecord[];
      setTrees(fetchedTrees);
    })();
  }, []);

  useEffect(() => {
    const matchedTree = trees.find((item) => item.campaignType === activeTab);
    if (!matchedTree?.id) return;

    void loadTree(matchedTree.id);
  }, [activeTab, loadTree, trees]);

  const handleTabChange = (tab: PingTreeCampaignType) => {
    if (tab === activeTab) return;

    setActiveSearch("");
    setInactiveFilter("");
    setMessage("");
    setDragSession(null);
    setDropTarget(null);
    setDropIndicator(null);
    setPointerPosition(null);
    dropTargetKeyRef.current = "";
    dropTargetRef.current = null;
    setTree(null);
    setPingTreeList([]);
    setNotInPingTree([]);
    setPriorities({});
    setIsLoading(true);
    setActiveTab(tab);
  };

  const saveTree = useCallback(
    async (nextActiveIds: string[], nextInactiveIds: string[], nextPriorities: Record<string, number>) => {
      if (!tree) return false;

      setIsSaving(true);
      setMessage("");

      try {
        const response = await fetch(`/api/ping-trees/${encodeURIComponent(tree.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            activeCampaignIds: nextActiveIds,
            inactiveCampaignIds: nextInactiveIds,
            campaignPriorities: nextPriorities,
          }),
        });

        if (response.ok) {
          setMessage("Ping tree updated.");
          return true;
        }

        setMessage("Failed to update ping tree.");
        await loadTree(tree.id, { withSpinner: false });
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [loadTree, tree]
  );

  const applyLists = useCallback((nextActiveIds: string[], nextInactiveIds: string[]) => {
    const lookup = new Map(
      [...pingTreeListRef.current, ...notInPingTreeRef.current].map((card) => [card.id, card])
    );

    const nextActive = nextActiveIds
      .map((id) => lookup.get(id))
      .filter((item): item is PingTreeCampaignCard => Boolean(item));
    const nextInactive = nextInactiveIds
      .map((id) => lookup.get(id))
      .filter((item): item is PingTreeCampaignCard => Boolean(item));

    pingTreeListRef.current = nextActive;
    notInPingTreeRef.current = nextInactive;
    setPingTreeList(nextActive);
    setNotInPingTree(nextInactive);
  }, []);

  const commitOrder = useCallback(
    (nextActiveIds: string[], nextInactiveIds: string[]) => {
      applyLists(nextActiveIds, nextInactiveIds);
      void saveTree(nextActiveIds, nextInactiveIds, prioritiesRef.current);
    },
    [applyLists, saveTree]
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
    (campaignId: string, insertIndex: number | "end") => {
      const activeIds = insertAtIndex(
        pingTreeListRef.current.map((item) => item.id),
        campaignId,
        insertIndex
      );
      const inactiveIds = notInPingTreeRef.current.map((item) => item.id).filter((id) => id !== campaignId);
      commitOrder(activeIds, inactiveIds);
    },
    [commitOrder]
  );

  const insertIntoInactive = useCallback(
    (campaignId: string, insertIndex: number | "end") => {
      const activeIds = pingTreeListRef.current.map((item) => item.id).filter((id) => id !== campaignId);
      const inactiveIds = insertAtIndex(
        notInPingTreeRef.current.map((item) => item.id),
        campaignId,
        insertIndex
      );
      commitOrder(activeIds, inactiveIds);
    },
    [commitOrder]
  );

  const getActiveIndex = (campaignId: string) =>
    pingTreeListRef.current.findIndex((item) => item.id === campaignId);

  const getInactiveIndex = (campaignId: string) =>
    notInPingTreeRef.current.findIndex((item) => item.id === campaignId);

  const moveActiveByStep = (campaignId: string, direction: "up" | "down") => {
    const activeIds = pingTreeListRef.current.map((item) => item.id);
    const index = activeIds.indexOf(campaignId);
    if (index < 0) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activeIds.length) return;

    const [movedId] = activeIds.splice(index, 1);
    activeIds.splice(targetIndex, 0, movedId);
    commitOrder(activeIds, notInPingTreeRef.current.map((item) => item.id));
  };

  const moveActiveToEdge = (campaignId: string, edge: "top" | "bottom") => {
    const activeIds = pingTreeListRef.current.map((item) => item.id);
    const index = activeIds.indexOf(campaignId);
    if (index < 0) return;

    const [movedId] = activeIds.splice(index, 1);
    if (edge === "top") {
      activeIds.unshift(movedId);
    } else {
      activeIds.push(movedId);
    }
    commitOrder(activeIds, notInPingTreeRef.current.map((item) => item.id));
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
    commitOrder(
      pingTreeListRef.current.map((item) => item.id),
      inactiveIds
    );
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

  const clearDragState = useCallback(() => {
    setDragSession(null);
    setDropTargetWithRef(null);
    setDropIndicator(null);
    setPointerPosition(null);
    dropTargetKeyRef.current = "";
  }, [setDropTargetWithRef]);

  const startPointerDrag = (campaignId: string, sourceSide: "active" | "inactive", event: React.PointerEvent) => {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    setDragSession({
      campaignId,
      sourceSide,
      pointerId: event.pointerId,
    });
    setPointerPosition({ x: event.clientX, y: event.clientY });
    updateDropTargetFromPointer(event.clientX, event.clientY);
  };

  useLayoutEffect(() => {
    if (!dragSession || !dropTarget) {
      setDropIndicator(null);
      return;
    }

    const columnRef = dropTarget.side === "active" ? activeColumnRef : inactiveColumnRef;
    const listRef = dropTarget.side === "active" ? activeListRef : inactiveListRef;
    const cardSelector =
      dropTarget.side === "active" ? "[data-ping-tree-card-index]" : "[data-ping-tree-inactive-card-index]";

    if (!columnRef.current || !listRef.current) {
      setDropIndicator(null);
      return;
    }

    setDropIndicator({
      side: dropTarget.side,
      top: computeIndicatorTop(columnRef.current, listRef.current, cardSelector, dropTarget.index),
    });
  }, [dragSession, dropTarget, pingTreeList.length, notInPingTree.length, activeSearch, inactiveFilter]);

  useEffect(() => {
    if (!dragSession) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== dragSession.pointerId) return;

      setPointerPosition({ x: event.clientX, y: event.clientY });
      updateDropTargetFromPointer(event.clientX, event.clientY);
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId !== dragSession.pointerId) return;

      const target = dropTargetRef.current ?? resolvePointerDropTarget(event.clientX, event.clientY);
      if (target) {
        executeDrop(dragSession.campaignId, dragSession.sourceSide, target);
      }

      clearDragState();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [clearDragState, dragSession, executeDrop, resolvePointerDropTarget, updateDropTargetFromPointer]);

  useEffect(() => {
    if (!dragSession) return;

    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    return () => {
      document.body.style.userSelect = previousUserSelect;
    };
  }, [dragSession]);

  if (isLoading || !tree) {
    return (
      <PageSection title="Ping Tree Settings">
        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          <Spinner />
          <span>Loading ping tree...</span>
        </div>
      </PageSection>
    );
  }

  const isDragging = Boolean(dragSession);
  const draggedCard =
    dragSession &&
    [...pingTreeList, ...notInPingTree].find((card) => card.id === dragSession.campaignId);

  return (
    <div className="space-y-6">
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/50">
        {PING_TREE_CAMPAIGN_TYPE_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => handleTabChange(tab)}
            className={cn(
              "flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition",
              activeTab === tab
                ? "bg-white text-emerald-800 shadow-sm dark:bg-slate-900 dark:text-emerald-300"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <PageSection title={`${activeTab} Ping Tree`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="ping-tree-strategy" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Strategy
              </label>
              <select
                id="ping-tree-strategy"
                value={tree.strategy}
                disabled
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
              >
                {PING_TREE_STRATEGY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <HelpCircle size={16} className="text-sky-500" aria-hidden />
            </div>

            {isDragging ? (
              <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
                <ArrowDown size={14} className="rotate-180" />
                Drag using the crosshair icon. A line shows where the campaign will land.
              </p>
            ) : null}
            {message ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{message}</p> : null}
            {isSaving ? <p className="text-sm text-slate-500">Saving...</p> : null}
          </div>

          <Link
            href="/campaigns"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100"
          >
            View Campaigns
          </Link>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)]">
          <div
            ref={activeColumnRef}
            className={cn(
              "flex flex-col overflow-hidden rounded-lg border bg-white dark:bg-slate-900",
              isDragging && dropTarget?.side === "active"
                ? "border-emerald-400 ring-2 ring-emerald-200 dark:border-emerald-500 dark:ring-emerald-500/20"
                : "border-slate-300 dark:border-slate-600"
            )}
          >
            <ColumnStatsBar
              disabled={activeStats.disabled}
              active={activeStats.active}
              total={activeStats.total}
            />

            <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-3 py-2 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Ping Tree List</h3>
              <div className="relative ml-auto min-w-[12rem] flex-1 sm:max-w-xs">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={activeSearch}
                  onChange={(event) => setActiveSearch(event.target.value)}
                  placeholder="Search campaigns..."
                  className="h-8 py-1 pl-8 text-xs"
                />
              </div>
            </div>

            <div ref={activeListRef} className="relative max-h-[72vh] flex-1 space-y-2 overflow-y-auto p-2">
              {filteredActiveList.length === 0 ? (
                <div className="rounded border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400 dark:border-slate-600">
                  {isDragging ? "Drop here to add to ping tree" : "No campaigns in ping tree"}
                </div>
              ) : (
                filteredActiveList.map((card) => {
                  const index = getActiveIndex(card.id);
                  return (
                    <div key={card.id} data-ping-tree-card-index={index}>
                      <ActiveCampaignCard
                        card={card}
                        index={index}
                        isDragging={dragSession?.campaignId === card.id}
                        priority={priorities[card.id] ?? 0}
                        canMoveUp={index > 0}
                        canMoveDown={index < pingTreeList.length - 1}
                        onGripPointerDown={(event) => startPointerDrag(card.id, "active", event)}
                        onPriorityChange={(value) => setPriorities((current) => ({ ...current, [card.id]: value }))}
                        onSetPriority={() =>
                          void saveTree(
                            pingTreeList.map((item) => item.id),
                            notInPingTree.map((item) => item.id),
                            { ...priorities, [card.id]: priorities[card.id] ?? 0 }
                          )
                        }
                        onRemove={() => insertIntoInactive(card.id, 0)}
                        onMoveUp={() => moveActiveByStep(card.id, "up")}
                        onMoveDown={() => moveActiveByStep(card.id, "down")}
                      />
                    </div>
                  );
                })
              )}

              {isDragging && dropIndicator?.side === "active" ? (
                <DropIndicator top={dropIndicator.top} tone="active" />
              ) : null}
            </div>
          </div>

          <div
            ref={inactiveColumnRef}
            className={cn(
              "flex flex-col overflow-hidden rounded-lg border bg-white dark:bg-slate-900",
              isDragging && dropTarget?.side === "inactive"
                ? "border-rose-300 ring-2 ring-rose-200 dark:border-rose-500/60 dark:ring-rose-500/20"
                : "border-slate-300 dark:border-slate-600"
            )}
          >
            <ColumnStatsBar
              disabled={inactiveStats.disabled}
              active={inactiveStats.active}
              total={inactiveStats.total}
            />

            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Not In Ping Tree</h3>
              <div className="relative ml-auto min-w-0 flex-1">
                <Filter size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={inactiveFilter}
                  onChange={(event) => setInactiveFilter(event.target.value)}
                  placeholder="Filter..."
                  className="h-8 py-1 pl-8 text-xs"
                />
              </div>
            </div>

            <div ref={inactiveListRef} className="relative max-h-[72vh] flex-1 overflow-y-auto p-2">
              {filteredInactiveList.length === 0 ? (
                <div className="rounded border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400 dark:border-slate-600">
                  {isDragging ? "Drop here to remove from ping tree" : "All campaigns are in ping tree"}
                </div>
              ) : (
                inactiveGroups.map(([buyerLabel, cards]) => (
                  <div key={buyerLabel} className="mb-3 last:mb-0">
                    <h4 className="mb-1.5 px-1 text-sm font-bold text-slate-800 dark:text-slate-100">{buyerLabel}</h4>
                    <div className="space-y-2">
                      {cards.map((card) => {
                        const index = getInactiveIndex(card.id);
                        return (
                          <div key={card.id} data-ping-tree-inactive-card-index={index}>
                            <InactiveCampaignCard
                              card={card}
                              isDragging={dragSession?.campaignId === card.id}
                              priority={priorities[card.id] ?? 0}
                              canMoveToTop={index > 0}
                              canMoveToBottom={index < notInPingTree.length - 1}
                              onGripPointerDown={(event) => startPointerDrag(card.id, "inactive", event)}
                              onPriorityChange={(value) =>
                                setPriorities((current) => ({ ...current, [card.id]: value }))
                              }
                              onSetPriority={() =>
                                void saveTree(
                                  pingTreeList.map((item) => item.id),
                                  notInPingTree.map((item) => item.id),
                                  { ...priorities, [card.id]: priorities[card.id] ?? 0 }
                                )
                              }
                              onMoveToTop={() => moveInactiveToEdge(card.id, "top")}
                              onMoveToBottom={() => moveInactiveToEdge(card.id, "bottom")}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}

              {isDragging && dropIndicator?.side === "inactive" ? (
                <DropIndicator top={dropIndicator.top} tone="inactive" />
              ) : null}
            </div>
          </div>
        </div>
      </PageSection>

      {dragSession && pointerPosition && draggedCard ? (
        <div
          className="pointer-events-none fixed z-50 w-72 rounded-xl border border-emerald-400 bg-white p-3 shadow-lg dark:bg-slate-900"
          style={{
            left: pointerPosition.x + 12,
            top: pointerPosition.y + 12,
          }}
        >
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{formatCampaignLabel(draggedCard)}</p>
          <p className="text-xs text-slate-500">${draggedCard.minPrice.toFixed(2)}</p>
        </div>
      ) : null}
    </div>
  );
}
