"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageSection } from "@/components/ui/state";

type SellerVertical = {
  id: string;
  verticalId: string;
  verticalName: string;
  apiUrl?: string;
  apiRequest?: {
    apiKey: string;
    url: string;
    method: string;
  };
};

export default function ApiConfigPage() {
  const searchParams = useSearchParams();
  const sellerId = searchParams.get("sellerId");
  const sellerName = searchParams.get("sellerName");
  const [verticals, setVerticals] = useState<SellerVertical[]>([]);
  const [isVerticalLoading, setIsVerticalLoading] = useState(false);

  useEffect(() => {
    if (!sellerId) {
      return;
    }

    const fetchVerticals = async () => {
      setIsVerticalLoading(true);
      try {
        const response = await fetch(`/api/sellers/${encodeURIComponent(sellerId)}/verticals`);
        if (!response.ok) return;
        const data = (await response.json()) as SellerVertical[];
        setVerticals(data);
      } finally {
        setIsVerticalLoading(false);
      }
    };

    void fetchVerticals();
  }, [sellerId]);

  const verticalRows = sellerId ? verticals : [];

  const verticalColumns: Column<SellerVertical>[] = [
    { key: "verticalName", label: "Vertical Name" },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="flex gap-2">
          <Link
            href={`/api-config/document/${encodeURIComponent(row.id)}?sellerId=${encodeURIComponent(sellerId ?? "")}&sellerName=${encodeURIComponent(sellerName ?? "")}&verticalName=${encodeURIComponent(row.verticalName)}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-emerald-200 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50"
          >
            Document
          </Link>
          <Link
            href={`/api-config/${encodeURIComponent(sellerId ?? "")}/${encodeURIComponent(row.verticalId)}/field-configuration?verticalName=${encodeURIComponent(row.verticalName)}&sellerName=${encodeURIComponent(sellerName ?? "")}`}
            className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
          >
            View Fields Configuration
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {sellerId ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Generating API config for seller: <span className="font-semibold">{sellerName ?? sellerId}</span>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Please open API config from the Sellers page for a specific seller.
        </div>
      )}

      <PageSection title="Seller Vertical List">
        <DataTable<SellerVertical>
          columns={verticalColumns}
          rows={verticalRows}
          emptyMessage={isVerticalLoading ? "Loading verticals..." : "No verticals mapped to this seller yet."}
        />
      </PageSection>
    </div>
  );
}
