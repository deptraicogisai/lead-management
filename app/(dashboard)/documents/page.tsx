"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Download, Minus, Plus, RefreshCw, Search } from "lucide-react";
import { ProductDocViewer } from "@/components/documents/product-doc-viewer";
import {
  SyncProgressPanel,
  type DocumentSyncItem,
  type DocumentSyncProgress,
} from "@/components/documents/sync-progress-panel";
import { PageSection } from "@/components/ui/state";
import type { PhonexaProductDocument } from "@/lib/phonexa-products";
import { cn } from "@/lib/utils";

type CatalogProduct = {
  id: number;
  name: string;
  cached: boolean;
};

type CatalogCategory = {
  category: string;
  subCategories: CatalogProduct[];
};

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
  const syncMenuRef = useRef<HTMLDivElement | null>(null);
  const initialSyncStartedRef = useRef(false);

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
    void loadProductDocument(product.id);
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
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleDownloadJson()}
              disabled={isDownloading || cachedCount === 0 || isSyncing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Download size={16} className={isDownloading ? "animate-pulse" : undefined} />
              {isDownloading ? "Downloading JSON..." : "Download as JSON"}
            </button>
            <button
              type="button"
              onClick={() => void handleRefreshCurrent()}
              disabled={!selectedProductId || isDocumentLoading || isSyncing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCw size={16} />
              Refresh current
            </button>
            <div ref={syncMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setSyncMenuOpen((open) => !open)}
                disabled={isSyncing || isCatalogLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                <RefreshCw size={16} className={isSyncing ? "animate-spin" : undefined} />
                {isSyncing
                  ? syncingMode === "all"
                    ? "Syncing all..."
                    : "Syncing missing..."
                  : "Sync"}
                <ChevronDown
                  size={16}
                  className={cn("opacity-80 transition-transform", syncMenuOpen && "rotate-180")}
                />
              </button>

              {syncMenuOpen ? (
                <div className="absolute right-0 z-20 mt-1 min-w-[240px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
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
          </div>
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
          <div className="grid min-h-[640px] lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="border-b border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/60 lg:border-b-0 lg:border-r">
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Product APIs</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {cachedCount} / {totalCount} products cached in database
                  </p>
                  {isSyncing ? (
                    <p className="mt-1 text-xs font-medium text-blue-600 dark:text-blue-400">Sync in progress...</p>
                  ) : null}
                </div>

                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Product search..."
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none ring-blue-500/0 transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-500 dark:focus:ring-blue-500/20"
                  />
                </label>

                <div className="max-h-[calc(100vh-18rem)] space-y-2 overflow-y-auto pr-1">
                  {isCatalogLoading ? (
                    <p className="px-2 py-4 text-sm text-slate-500">Loading catalog...</p>
                  ) : filteredCatalog.length === 0 ? (
                    <p className="px-2 py-4 text-sm text-slate-500">No products match your search.</p>
                  ) : (
                    filteredCatalog.map((category) => {
                      const isExpanded = expandedCategories[category.category] ?? false;

                      return (
                        <div
                          key={category.category}
                          className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedCategories((current) => ({
                                ...current,
                                [category.category]: !isExpanded,
                              }))
                            }
                            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800/60"
                          >
                            <span>{category.category}</span>
                            {isExpanded ? <Minus size={16} /> : <Plus size={16} />}
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
                                    onClick={() => handleSelectProduct(product)}
                                    className={cn(
                                      "flex w-full items-start justify-between gap-2 border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 dark:border-slate-800",
                                      isActive
                                        ? "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200"
                                        : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/50"
                                    )}
                                  >
                                    <span className="min-w-0 flex-1">{product.name}</span>
                                    {syncItem?.status === "syncing" ? (
                                      <span className="mt-0.5 shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                                        ...
                                      </span>
                                    ) : syncItem?.status === "synced" || product.cached ? (
                                      <span className="mt-0.5 shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                                        DB
                                      </span>
                                    ) : syncItem?.status === "failed" ? (
                                      <span className="mt-0.5 shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
                                        Fail
                                      </span>
                                    ) : null}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedCategories((current) => ({
                                  ...current,
                                  [category.category]: true,
                                }))
                              }
                              className="flex w-full items-center gap-2 border-t border-slate-200 px-3 py-2 text-left text-xs text-slate-500 dark:border-slate-700"
                            >
                              <ChevronDown size={14} />
                              {category.subCategories.length} products
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </aside>

            <div className="p-5 md:p-6">
              {showSyncPanel && syncProgress ? (
                <SyncProgressPanel progress={syncProgress} onDismiss={() => setSyncProgress(null)} />
              ) : null}

              {showDocument ? (
                <>
                  {selectedProductName ? (
                    <p className="mb-4 text-sm text-slate-500">
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
      </PageSection>
    </div>
  );
}
