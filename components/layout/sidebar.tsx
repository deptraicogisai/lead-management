"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Building2, BriefcaseBusiness, LayoutDashboard, Link2, ScrollText, Send, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sellers", label: "Sellers", icon: Users },
  { href: "/verticals", label: "Vertical", icon: BriefcaseBusiness },
  { href: "/vertical-mappings", label: "Vertical Mapping", icon: Link2 },
  { href: "/buyers", label: "Buyers", icon: Building2 },
  { href: "/leads", label: "Leads", icon: BarChart3 },
  { href: "/logs", label: "Logs", icon: ScrollText },
  { href: "/distributions", label: "Distributions", icon: Send },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-20 flex h-screen w-64 flex-col border-r border-slate-200 bg-white px-4 py-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-8 px-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Lead Management</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">SaaS Admin</h1>
      </div>

      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 pl-4 text-sm font-medium transition duration-200",
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
                <Icon size={18} />
              </span>
              <span className="transition duration-200 group-hover:translate-x-0.5">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
