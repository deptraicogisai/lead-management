"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseBusiness,
  ChevronDown,
  LayoutDashboard,
  LayoutList,
} from "lucide-react";
import { clientManagementSections } from "@/components/layout/client-management-nav-items";
import { reportSections } from "@/components/layout/report-nav-items";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/verticals", label: "Vertical", icon: BriefcaseBusiness },
];

function NavLink({
  href,
  label,
  icon: Icon,
  isActive,
  iconSize = 18,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  isActive: boolean;
  iconSize?: number;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 pl-4 text-sm font-medium transition duration-200",
        isActive
          ? "bg-blue-50 text-blue-700 shadow-sm dark:bg-blue-500/18 dark:text-blue-200"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
      )}
    >
      <span
        className={cn(
          "absolute left-1 top-1/2 h-7 w-1 -translate-y-1/2 rounded-full transition-all duration-200",
          isActive
            ? "bg-blue-600 opacity-100 dark:bg-blue-300"
            : "bg-slate-300 opacity-0 group-hover:h-8 group-hover:opacity-100 dark:bg-slate-500"
        )}
      />
      <span className="transition duration-200 group-hover:translate-x-0.5">
        <Icon size={iconSize} />
      </span>
      <span className="transition duration-200 group-hover:translate-x-0.5">{label}</span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const isClientManagementActive = clientManagementSections.some((section) =>
    section.items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
  );
  const isReportsActive = pathname.startsWith("/reports");
  const [isClientManagementOpen, setIsClientManagementOpen] = useState(true);
  const [isReportsOpen, setIsReportsOpen] = useState(true);

  return (
    <aside className="fixed left-0 top-0 z-20 flex h-screen w-64 flex-col border-r border-slate-200 bg-white px-4 py-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-8 px-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Lead Management</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">SaaS Admin</h1>
      </div>

      <nav className="space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

          return <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} isActive={isActive} />;
        })}

        <div className="pt-2">
          <button
            type="button"
            onClick={() => setIsReportsOpen((current) => !current)}
            className={cn(
              "flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pl-4 text-left text-sm font-semibold transition duration-200 dark:border-slate-700 dark:bg-slate-800/70",
              isReportsActive
                ? "text-blue-700 dark:text-blue-200"
                : "text-slate-700 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <span className="flex items-center gap-3">
              <LayoutList size={18} className={isReportsActive ? "text-blue-600 dark:text-blue-300" : undefined} />
              <span>All Reports</span>
            </span>
            <ChevronDown
              size={16}
              className={cn("opacity-70 transition-transform duration-200", isReportsOpen ? "rotate-0" : "-rotate-90")}
            />
          </button>

          <div
            className={cn(
              "mt-1 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition-all duration-200 dark:border-slate-700 dark:bg-slate-800/40",
              isReportsOpen ? "max-h-[520px] opacity-100" : "max-h-0 border-transparent opacity-0"
            )}
          >
            <div className="space-y-3 p-2">
              {reportSections.map((section) => (
                <div key={section.title}>
                  <p className="border-b border-dashed border-slate-300 px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-600 dark:text-slate-300">
                    {section.title}
                  </p>
                  <div className="mt-1 space-y-0.5">
                    {section.items.map((item) => {
                      const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

                      return (
                        <NavLink
                          key={item.href}
                          href={item.href}
                          label={item.label}
                          icon={item.icon}
                          isActive={isActive}
                          iconSize={17}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => setIsClientManagementOpen((current) => !current)}
            className={cn(
              "flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pl-4 text-left text-sm font-semibold transition duration-200 dark:border-slate-700 dark:bg-slate-800/70",
              isClientManagementActive
                ? "text-blue-700 dark:text-blue-200"
                : "text-slate-700 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <span className="flex items-center gap-3">
              <BriefcaseBusiness
                size={18}
                className={isClientManagementActive ? "text-blue-600 dark:text-blue-300" : undefined}
              />
              <span>Client Management</span>
            </span>
            <ChevronDown
              size={16}
              className={cn("opacity-70 transition-transform duration-200", isClientManagementOpen ? "rotate-0" : "-rotate-90")}
            />
          </button>

          <div
            className={cn(
              "mt-1 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition-all duration-200 dark:border-slate-700 dark:bg-slate-800/40",
              isClientManagementOpen ? "max-h-[520px] opacity-100" : "max-h-0 border-transparent opacity-0"
            )}
          >
            <div className="space-y-3 p-2">
              {clientManagementSections.map((section, index) => (
                <div key={section.title ?? `section-${index}`}>
                  {section.title ? (
                    <p className="border-b border-dashed border-slate-300 px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-600 dark:text-slate-300">
                      {section.title}
                    </p>
                  ) : null}
                  <div className={cn("space-y-0.5", section.title ? "mt-1" : undefined)}>
                    {section.items.map((item) => {
                      const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

                      return (
                        <NavLink
                          key={item.href}
                          href={item.href}
                          label={item.label}
                          icon={item.icon}
                          isActive={isActive}
                          iconSize={17}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </nav>
    </aside>
  );
}
