"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Minus, Plus, Search, X } from "lucide-react";
import { InlineLoading } from "@/components/ui/loading-indicator";
import type { DocumentSyncItem, DocumentSyncProgress } from "@/components/documents/sync-progress-panel";
import { cn } from "@/lib/utils";

export type CatalogProduct = {
  id: number;
  name: string;
  cached: boolean;
};

export type CatalogCategory = {
  category: string;
  subCategories: CatalogProduct[];
};

type DocumentsCatalogPanelProps = {
  filteredCatalog: CatalogCategory[];
  expandedCategories: Record<string, boolean>;
  onToggleCategory: (category: string) => void;
  onExpandCategory: (category: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  selectedProductId: number | null;
  onSelectProduct: (product: CatalogProduct) => void;
  isCatalogLoading: boolean;
  cachedCount: number;
  totalCount: number;
  isSyncing: boolean;
  syncProgress: DocumentSyncProgress | null;
  className?: string;
  listClassName?: string;
  /** Hide title/stats block (e.g. when drawer already shows a header). */
  compactHeader?: boolean;
};

export function DocumentsCatalogPanel({
  filteredCatalog,
  expandedCategories,
  onToggleCategory,
  onExpandCategory,
  search,
  onSearchChange,
  selectedProductId,
  onSelectProduct,
  isCatalogLoading,
  cachedCount,
  totalCount,
  isSyncing,
  syncProgress,
  className,
  listClassName,
  compactHeader = false,
}: DocumentsCatalogPanelProps) {
  const normalizedSearch = search.trim();
  const effectiveExpanded = normalizedSearch
    ? Object.fromEntries(filteredCatalog.map((category) => [category.category, true]))
    : expandedCategories;

  return (
    <div className={cn("flex min-h-0 flex-col gap-3 sm:gap-4", className)}>
      {compactHeader ? null : (
        <div className="shrink-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Product APIs</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {cachedCount} / {totalCount} products cached
          </p>
          {isSyncing ? (
            <p className="mt-1 text-xs font-medium text-blue-600 dark:text-blue-400">Sync in progress...</p>
          ) : null}
        </div>
      )}

      <label className="relative block shrink-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search products..."
          className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-500 dark:focus:ring-blue-500/20"
        />
      </label>

      <div
        className={cn(
          "min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch]",
          listClassName ?? "max-h-[min(60vh,28rem)] lg:max-h-[calc(100vh-18rem)]"
        )}
      >
        {isCatalogLoading ? (
          <InlineLoading message="Loading catalog..." className="py-8" />
        ) : filteredCatalog.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-slate-500">No products match your search.</p>
        ) : (
          filteredCatalog.map((category) => {
            const isExpanded = effectiveExpanded[category.category] ?? false;

            return (
              <div
                key={category.category}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
              >
                <button
                  type="button"
                  onClick={() => onToggleCategory(category.category)}
                  className="flex min-h-[48px] w-full items-center justify-between gap-2 px-3 py-3 text-left text-sm font-semibold text-slate-800 active:bg-slate-50 dark:text-slate-100 dark:active:bg-slate-800/60"
                >
                  <span className="min-w-0 flex-1 truncate">{category.category}</span>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {category.subCategories.length}
                  </span>
                  {isExpanded ? <Minus size={16} className="shrink-0" /> : <Plus size={16} className="shrink-0" />}
                </button>

                {isExpanded ? (
                  <div className="border-t border-slate-200 dark:border-slate-700">
                    {category.subCategories.map((product) => {
                      const isActive = selectedProductId === product.id;
                      const syncItem = syncProgress?.items.find((item) => item.id === product.id);

                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => onSelectProduct(product)}
                          className={cn(
                            "flex min-h-[48px] w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 text-left text-sm last:border-b-0 active:bg-slate-50 dark:border-slate-800 dark:active:bg-slate-800/50",
                            isActive
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200"
                              : "text-slate-700 dark:text-slate-200"
                          )}
                        >
                          <span className="min-w-0 flex-1 leading-snug line-clamp-2" title={product.name}>
                            {product.name}
                          </span>
                          <ProductStatusBadge syncItem={syncItem} cached={product.cached} />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onExpandCategory(category.category)}
                    className="flex min-h-[40px] w-full items-center gap-2 border-t border-slate-200 px-3 py-2 text-left text-xs text-slate-500 active:bg-slate-50 dark:border-slate-700 dark:active:bg-slate-800/40"
                  >
                    <ChevronDown size={14} />
                    Show {category.subCategories.length} products
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ProductStatusBadge({
  syncItem,
  cached,
}: {
  syncItem?: DocumentSyncItem;
  cached: boolean;
}) {
  if (syncItem?.status === "syncing") {
    return (
      <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
        ...
      </span>
    );
  }

  if (syncItem?.status === "synced" || cached) {
    return (
      <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
        DB
      </span>
    );
  }

  if (syncItem?.status === "failed") {
    return (
      <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700 dark:bg-red-500/20 dark:text-red-300">
        Fail
      </span>
    );
  }

  return null;
}

type DocumentsCatalogDrawerProps = DocumentsCatalogPanelProps & {
  open: boolean;
  onClose: () => void;
};

export function DocumentsCatalogDrawer({ open, onClose, ...panelProps }: DocumentsCatalogDrawerProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!open) {
      setIsVisible(false);
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setIsVisible(true));
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Product catalog">
      <button
        type="button"
        aria-label="Close catalog"
        className={cn(
          "mobile-nav-backdrop absolute inset-0 bg-slate-950/55 backdrop-blur-[3px]",
          isVisible ? "mobile-nav-backdrop-open" : "mobile-nav-backdrop-closed"
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "mobile-nav-panel absolute left-0 top-0 flex h-[100dvh] w-[min(92vw,22rem)] flex-col border-r border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900",
          isVisible ? "mobile-nav-panel-open" : "mobile-nav-panel-closed"
        )}
      >
        <div className="mobile-safe-top flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="min-w-0">
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100">Product APIs</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {panelProps.cachedCount} / {panelProps.totalCount} cached
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 active:scale-95 dark:bg-slate-800 dark:text-slate-200"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mobile-nav-scroll min-h-0 flex-1 p-4">
          <DocumentsCatalogPanel {...panelProps} compactHeader listClassName="max-h-none min-h-0" />
        </div>
      </aside>
    </div>
  );
}
