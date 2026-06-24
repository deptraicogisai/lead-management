"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Download, RefreshCw, Search } from "lucide-react";
import { toolbarPrimaryButtonClassName, secondaryButtonClassName } from "@/lib/button-styles";
import {
  DocumentsCatalogDrawer,
  DocumentsCatalogPanel,
  type CatalogCategory,
  type CatalogProduct,
} from "@/components/documents/documents-catalog-panel";
import { ProductDocViewer } from "@/components/documents/product-doc-viewer";
import {
  SyncProgressPanel,
  type DocumentSyncItem,
  type DocumentSyncProgress,
} from "@/components/documents/sync-progress-panel";
import { PageSection } from "@/components/ui/state";
import type { PhonexaProductDocument } from "@/lib/phonexa-products";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

type CatalogResponse = {
  catalog: CatalogCategory[];
  cachedCount: number;
  totalCount: number;
  needsInitialSync: boolean;
};

function getAllProducts(catalog: CatalogCategory[]) {
  return catalog.flatMap((category) => category.subCategories);
}

function createSyncItems(products: CatalogProduct[]): DocumentSyncItem[] {
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    status: "pending",
  }));
}

export default function DocumentsPage() {
  const [catalog, setCatalog] = useState<CatalogCategory[]>([]);
  const [cachedCount, setCachedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [selectedProductName, setSelectedProductName] = useState("");
  const [document, setDocument] = useState<PhonexaProductDocument | null>(null);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [isDocumentLoading, setIsDocumentLoading] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<DocumentSyncProgress | null>(null);
  const [syncMenuOpen, setSyncMenuOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [syncingMode, setSyncingMode] = useState<"missing" | "all" | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [mobileCatalogOpen, setMobileCatalogOpen] = useState(false);
  const syncMenuRef = useRef<HTMLDivElement | null>(null);
  const initialSyncStartedRef = useRef(false);
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");

  const loadCatalog = useCallback(async () => {
    setIsCatalogLoading(true);

    try {
      const response = await fetch("/api/documents/catalog");
      const payload = (await response.json()) as CatalogResponse | { message?: string };

      if (!response.ok) {
        throw new Error("message" in payload && payload.message ? payload.message : "Unable to load catalog.");
      }

      const data = payload as CatalogResponse;
      setCatalog(data.catalog);
      setCachedCount(data.cachedCount);
      setTotalCount(data.totalCount);
      setExpandedCategories((current) => {
        if (Object.keys(current).length > 0) return current;

        const initial: Record<string, boolean> = {};
        for (const category of data.catalog) {
          initial[category.category] = category.category === "Financial Services";
        }
        return initial;
      });

      return data;
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "Unable to load catalog.");
      return null;
    } finally {
      setIsCatalogLoading(false);
    }
  }, []);

  const markProductCached = useCallback((productId: number) => {
    setCatalog((current) =>
      current.map((category) => ({
        ...category,
        subCategories: category.subCategories.map((product) =>
          product.id === productId ? { ...product, cached: true } : product
        ),
      }))
    );
    setCachedCount((current) => Math.min(current + 1, totalCount || current + 1));
  }, [totalCount]);

  const updateSyncItem = useCallback(
    (productId: number, patch: Partial<DocumentSyncItem>) => {
      setSyncProgress((current) => {
        if (!current) return current;

        return {
          ...current,
          items: current.items.map((item) => (item.id === productId ? { ...item, ...patch } : item)),
        };
      });
    },
    []
  );

  const runProductSync = useCallback(
    async (products: CatalogProduct[], options: { forceRefresh?: boolean } = {}) => {
      if (products.length === 0) return { synced: 0, failed: 0 };

      setIsSyncing(true);
      setSyncMessage(null);

      const items = createSyncItems(products);
      setSyncProgress({
        completed: 0,
        total: products.length,
        currentProductName: products[0]?.name ?? "",
        synced: 0,
        failed: 0,
        isComplete: false,
        items,
      });

      let synced = 0;
      let failed = 0;

      for (let index = 0; index < products.length; index += 1) {
        const product = products[index];

        updateSyncItem(product.id, { status: "syncing" });
        setSyncProgress((current) =>
          current
            ? {
                ...current,
                completed: index,
                currentProductName: product.name,
                synced,
                failed,
              }
            : current
        );

        try {
          const query = options.forceRefresh ? "?refresh=1" : "";
          const response = await fetch(`/api/documents/products/${product.id}${query}`);
          const payload = (await response.json()) as { message?: string };

          if (!response.ok) {
            throw new Error(payload.message ?? "Unable to sync product.");
          }

          synced += 1;
          updateSyncItem(product.id, { status: "synced" });
          if (!options.forceRefresh) {
            markProductCached(product.id);
          }
        } catch (error) {
          failed += 1;
          updateSyncItem(product.id, {
            status: "failed",
            message: error instanceof Error ? error.message : "Sync failed.",
          });
        }

        setSyncProgress((current) =>
          current
            ? {
                ...current,
                completed: index + 1,
                currentProductName: product.name,
                synced,
                failed,
              }
            : current
        );
      }

      setSyncProgress((current) =>
        current
          ? {
              ...current,
              completed: products.length,
              currentProductName: "",
              synced,
              failed,
              isComplete: true,
            }
          : current
      );

      await loadCatalog();
      setIsSyncing(false);

      if (failed > 0) {
        setSyncMessage(`Synced ${synced} products. ${failed} failed.`);
      }

      return { synced, failed };
    },
    [loadCatalog, markProductCached, updateSyncItem]
  );

  const loadProductDocument = useCallback(async (productId: number, refresh = false) => {
    setIsDocumentLoading(true);
    setDocumentError(null);

    try {
      const query = refresh ? "?refresh=1" : "";
      const response = await fetch(`/api/documents/products/${productId}${query}`);
      const payload = (await response.json()) as PhonexaProductDocument | { message?: string };

      if (!response.ok) {
        throw new Error("message" in payload && payload.message ? payload.message : "Unable to load documentation.");
      }

      setDocument(payload as PhonexaProductDocument);
    } catch (error) {
      setDocument(null);
      setDocumentError(error instanceof Error ? error.message : "Unable to load documentation.");
    } finally {
      setIsDocumentLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!syncMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!syncMenuRef.current?.contains(event.target as Node)) {
        setSyncMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [syncMenuOpen]);

  useEffect(() => {
    const initialize = async () => {
      const data = await loadCatalog();
      if (!data || initialSyncStartedRef.current) return;

      if (data.needsInitialSync) {
        initialSyncStartedRef.current = true;
        const productsToSync = getAllProducts(data.catalog).filter((product) => !product.cached);

        try {
          await runProductSync(productsToSync);
        } finally {
          await fetch("/api/documents/sync-state", { method: "POST" });
        }
      }
    };

    void initialize();
  }, [loadCatalog, runProductSync]);

  const filteredCatalog = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return catalog;

    return catalog
      .map((category) => ({
        ...category,
        subCategories: category.subCategories.filter(
          (product) =>
            product.name.toLowerCase().includes(normalizedSearch) ||
            String(product.id).includes(normalizedSearch) ||
            category.category.toLowerCase().includes(normalizedSearch)
        ),
      }))
      .filter((category) => category.subCategories.length > 0);
  }, [catalog, search]);

  const handleSelectProduct = (product: CatalogProduct) => {
    setSelectedProductId(product.id);
    setSelectedProductName(product.name);
    setSyncProgress(null);
    setMobileCatalogOpen(false);
    void loadProductDocument(product.id);
  };

  const catalogPanelProps = {
    filteredCatalog,
    expandedCategories,
    onToggleCategory: (category: string) =>
      setExpandedCategories((current) => ({
        ...current,
        [category]: !(current[category] ?? false),
      })),
    onExpandCategory: (category: string) =>
      setExpandedCategories((current) => ({
        ...current,
        [category]: true,
      })),
    search,
    onSearchChange: setSearch,
    selectedProductId,
    onSelectProduct: handleSelectProduct,
    isCatalogLoading,
    cachedCount,
    totalCount,
    isSyncing,
    syncProgress,
  };

  const handleRefreshCurrent = () => {
    if (!selectedProductId) return;
    void loadProductDocument(selectedProductId, true);
  };

  const handleSyncMissing = async () => {
    const productsToSync = getAllProducts(catalog).filter((product) => !product.cached);
    if (productsToSync.length === 0) {
      setSyncMessage("All products are already synced.");
      setSyncMenuOpen(false);
      return;
    }

    setSyncMenuOpen(false);
    setSyncingMode("missing");
    try {
      await runProductSync(productsToSync);
    } finally {
      setSyncingMode(null);
    }
  };

  const handleSyncAll = async () => {
    setSyncMenuOpen(false);
    setSyncingMode("all");
    try {
      await runProductSync(getAllProducts(catalog), { forceRefresh: true });
    } finally {
      setSyncingMode(null);
    }
  };

  const handleDownloadJson = async () => {
    setIsDownloading(true);
    setDownloadError(null);

    try {
      const response = await fetch("/api/documents/export?download=1");
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Failed to download documents.");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const fileNameMatch = disposition.match(/filename="([^"]+)"/);
      anchor.href = objectUrl;
      anchor.download = fileNameMatch?.[1] ?? "phonexa-product-documents.json";
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Failed to download documents.");
    } finally {
      setIsDownloading(false);
    }
  };

  const missingCount = Math.max(totalCount - cachedCount, 0);
  const showSyncPanel = syncProgress !== null;
  const showDocument = !showSyncPanel;

  return (
    <div className="space-y-4">
      <PageSection
        title="Product API Documents"
        actions={
          <>
            <button
              type="button"
              onClick={() => void handleDownloadJson()}
              disabled={isDownloading || cachedCount === 0 || isSyncing}
              className={secondaryButtonClassName}
            >
              <Download size={15} className={isDownloading ? "animate-pulse" : undefined} />
              <span className="sm:hidden">Download JSON</span>
              <span className="hidden sm:inline">Download as JSON</span>
            </button>
            <button
              type="button"
              onClick={() => void handleRefreshCurrent()}
              disabled={!selectedProductId || isDocumentLoading || isSyncing}
              className={secondaryButtonClassName}
            >
              <RefreshCw size={15} />
              Refresh current
            </button>
            <div ref={syncMenuRef} className="relative w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setSyncMenuOpen((open) => !open)}
                disabled={isSyncing || isCatalogLoading}
                className={cn(toolbarPrimaryButtonClassName, "w-full sm:w-auto")}
              >
                <RefreshCw size={15} className={isSyncing ? "animate-spin" : undefined} />
                {isSyncing
                  ? syncingMode === "all"
                    ? "Syncing all..."
                    : "Syncing missing..."
                  : "Sync"}
                <ChevronDown
                  size={15}
                  className={cn("opacity-80 transition-transform", syncMenuOpen && "rotate-180")}
                />
              </button>

              {syncMenuOpen ? (
                <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg sm:left-auto sm:right-0 sm:min-w-[240px] sm:w-auto dark:border-slate-700 dark:bg-slate-900">
                  <button
                    type="button"
                    onClick={() => void handleSyncMissing()}
                    disabled={isSyncing || missingCount === 0}
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <span className="font-medium">
                      {syncingMode === "missing" ? "Syncing missing..." : "Sync missing"}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {missingCount > 0 ? `${missingCount} products not in database` : "No missing products"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSyncAll()}
                    disabled={isSyncing}
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <span className="font-medium">
                      {syncingMode === "all" ? "Syncing all..." : "Sync all"}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Refresh all {totalCount} products from Phonexa API
                    </span>
                  </button>
                </div>
              ) : null}
            </div>
          </>
        }
      >
        {syncMessage ? (
          <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {syncMessage}
          </div>
        ) : null}
        {downloadError ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {downloadError}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <DocumentsCatalogDrawer
            open={!isLargeScreen && mobileCatalogOpen}
            onClose={() => setMobileCatalogOpen(false)}
            {...catalogPanelProps}
          />

          <div
            className={cn(
              "flex min-h-[min(72vh,44rem)] flex-col lg:grid lg:min-h-[640px] lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]",
              !isLargeScreen && !selectedProductId && "min-h-[min(78vh,48rem)]"
            )}
          >
            <aside className="hidden min-h-0 border-r border-slate-200 bg-slate-50/80 lg:flex lg:flex-col lg:self-stretch dark:border-slate-700 dark:bg-slate-900/60">
              <div className="sticky top-0 flex max-h-[calc(100dvh-10rem)] min-h-0 flex-col p-4">
                <DocumentsCatalogPanel
                  {...catalogPanelProps}
                  className="min-h-0 flex-1"
                  listClassName="max-h-[calc(100dvh-16rem)] min-h-0"
                />
              </div>
            </aside>

            {!isLargeScreen && !selectedProductId ? (
              <div className="flex min-h-0 flex-1 flex-col border-b border-slate-200 p-3 dark:border-slate-700 sm:p-4">
                <DocumentsCatalogPanel
                  {...catalogPanelProps}
                  className="min-h-0 flex-1"
                  listClassName="min-h-0 max-h-none flex-1"
                />
              </div>
            ) : null}

            <div
              className={cn(
                "flex min-h-0 flex-col",
                !isLargeScreen && !selectedProductId && "hidden",
                !isLargeScreen && selectedProductId && "flex-1"
              )}
            >
              {!isLargeScreen && selectedProductId ? (
                <div className="sticky top-0 z-10 flex shrink-0 flex-col gap-2 border-b border-slate-200 bg-white/95 px-3 py-3 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:px-4 dark:border-slate-700 dark:bg-slate-900/95">
                  <button
                    type="button"
                    onClick={() => setMobileCatalogOpen(true)}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-800 active:bg-slate-100 sm:w-auto dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <Search size={16} />
                    Browse products
                  </button>
                  {selectedProductName ? (
                    <p className="truncate text-center text-sm text-slate-500 sm:max-w-[55%] sm:text-right dark:text-slate-400">
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{selectedProductName}</span>
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 md:p-6">
                {showSyncPanel && syncProgress ? (
                  <SyncProgressPanel progress={syncProgress} onDismiss={() => setSyncProgress(null)} />
                ) : null}

                {showDocument ? (
                  <>
                    {isLargeScreen && selectedProductName ? (
                      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                        Viewing documentation for{" "}
                        <span className="font-semibold text-slate-800 dark:text-slate-100">{selectedProductName}</span>
                      </p>
                    ) : null}
                    <ProductDocViewer document={document} isLoading={isDocumentLoading} error={documentError} />
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </PageSection>
    </div>
  );
}
