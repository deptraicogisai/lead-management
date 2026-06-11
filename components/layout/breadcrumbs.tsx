"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import type { BreadcrumbItem } from "@/lib/breadcrumbs";
import { cn } from "@/lib/utils";

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
  className?: string;
};

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 flex-wrap items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const isHome = item.label === "Dashboard" && item.href === "/dashboard";

          return (
            <li key={`${item.label}-${index}`} className="inline-flex min-w-0 items-center gap-1">
              {index > 0 ? <ChevronRight size={14} className="shrink-0 opacity-60" aria-hidden /> : null}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="inline-flex min-w-0 items-center gap-1 truncate rounded-md px-1 py-0.5 transition hover:bg-slate-100 hover:text-blue-700 dark:hover:bg-slate-800 dark:hover:text-blue-300"
                >
                  {isHome ? <Home size={14} className="shrink-0" /> : null}
                  <span className="truncate">{item.label}</span>
                </Link>
              ) : (
                <span
                  className={cn(
                    "inline-flex min-w-0 items-center gap-1 truncate px-1 py-0.5",
                    isLast ? "text-base font-semibold text-slate-900 dark:text-slate-100" : ""
                  )}
                  aria-current={isLast ? "page" : undefined}
                >
                  {isHome ? <Home size={14} className="shrink-0" /> : null}
                  <span className="truncate">{item.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
