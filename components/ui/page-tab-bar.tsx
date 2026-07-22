import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type PageTabItem<T extends string = string> = {
  id: T;
  label: string;
  icon?: LucideIcon;
};

export function pageTabButtonClassName(isActive: boolean) {
  return cn(
    "inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-2xl border px-4 py-2.5 text-sm font-medium transition duration-200 sm:min-h-0",
    isActive
      ? "border-emerald-700 bg-emerald-800 text-white shadow-sm dark:border-emerald-500 dark:bg-emerald-600"
      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
  );
}

type PageTabBarProps<T extends string> = {
  tabs: readonly PageTabItem<T>[];
  activeTabId: T;
  onTabChange: (tabId: T) => void;
  className?: string;
};

export function PageTabBar<T extends string>({
  tabs,
  activeTabId,
  onTabChange,
  className,
}: PageTabBarProps<T>) {
  return (
    <div
      className={cn(
        "relative overflow-x-auto overscroll-x-contain rounded-2xl border border-slate-200 bg-slate-50/80 p-2 sm:p-3 dark:border-slate-700 dark:bg-slate-900/70",
        className
      )}
    >
      <div className="flex min-w-max items-center gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === activeTabId;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={pageTabButtonClassName(isActive)}
            >
              {Icon ? <Icon size={16} /> : null}
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
