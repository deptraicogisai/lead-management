"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import type { PublisherDistributionTreeUsage } from "@/lib/publisher-distribution";

type PublisherDistributionUsageAlertProps = {
  usages: PublisherDistributionTreeUsage[];
  variant?: "deleteBlocked";
  className?: string;
};

function formatUsageLine(usage: PublisherDistributionTreeUsage) {
  return `${usage.sellerName} · ${usage.productLabel} · ${usage.channelName} · ${usage.processingType} (${usage.percent}%)`;
}

export function PublisherDistributionUsageAlert({
  usages,
  variant,
  className,
}: PublisherDistributionUsageAlertProps) {
  if (usages.length === 0) return null;

  const uniqueUsages = Array.from(
    new Map(usages.map((usage) => [`${usage.distributionId}:${usage.percent}`, usage])).values()
  );

  return (
    <div
      className={
        className ??
        "flex gap-3 rounded-xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50 p-4 text-amber-900 dark:border-amber-500/30 dark:from-amber-500/10 dark:to-orange-500/5 dark:text-amber-100"
      }
    >
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">
        <TriangleAlert size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold">
          {variant === "deleteBlocked" ? "Cannot delete ping tree" : "Used in Publisher Distribution"}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-amber-800/90 dark:text-amber-100/80">
          {variant === "deleteBlocked"
            ? "Remove this ping tree from Distribution by Publisher before deleting it."
            : "This ping tree is assigned in Distribution by Publisher."}
        </p>
        <ul className="mt-2 space-y-1 text-xs text-amber-900/90 dark:text-amber-100/85">
          {uniqueUsages.map((usage) => (
            <li key={`${usage.distributionId}-${usage.percent}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span>{formatUsageLine(usage)}</span>
              {usage.sellerId ? (
                <Link
                  href={`/sellers/${encodeURIComponent(usage.sellerId)}?tab=ping-tree`}
                  className="font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950 dark:text-amber-100 dark:hover:text-white"
                >
                  Open publisher
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
