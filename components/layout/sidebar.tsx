"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseBusiness,
  ChevronDown,
  FileText,
  LayoutDashboard,
  LayoutList,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
} from "lucide-react";
import { clientManagementSections } from "@/components/layout/client-management-nav-items";
import { useSidebarLayout } from "@/components/layout/sidebar-layout-context";
import { SidebarTooltip } from "@/components/layout/sidebar-tooltip";
import { publisherManagementSections } from "@/components/layout/publisher-management-nav-items";
import { reportSections } from "@/components/layout/report-nav-items";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/verticals", label: "Vertical", icon: BriefcaseBusiness },
  { href: "/buyers", label: "Buyer List", icon: LayoutList },
  { href: "/documents", label: "Documents", icon: FileText },
];

function NavLink({
  href,
  label,
  icon: Icon,
  isActive,
  compact = false,
  collapsed = false,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  isActive: boolean;
  compact?: boolean;
  collapsed?: boolean;
}) {
  const iconSize = collapsed ? 18 : compact ? 15 : 16;

  return (
    <SidebarTooltip label={label} enabled={collapsed} className="block w-full">
      <Link
        href={href}
        className={cn(
          "group relative flex w-full min-w-0 max-w-full cursor-pointer items-center overflow-hidden rounded-lg py-2 font-medium transition duration-200",
          collapsed ? "justify-center px-2" : "gap-2 pl-3.5 pr-2",
          compact ? "text-xs leading-none" : "text-[13px] leading-none",
          isActive
            ? "bg-blue-50 text-blue-700 shadow-sm dark:bg-blue-500/18 dark:text-blue-200"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
        )}
      >
        {!collapsed ? (
          <span
            className={cn(
              "absolute left-1 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full transition-all duration-200",
              isActive
                ? "bg-blue-600 opacity-100 dark:bg-blue-300"
                : "bg-slate-300 opacity-0 group-hover:h-7 group-hover:opacity-100 dark:bg-slate-500"
            )}
          />
        ) : null}
        <span className={cn("shrink-0", !collapsed && "transition duration-200 group-hover:translate-x-0.5")}>
          <Icon size={iconSize} />
        </span>
        {!collapsed ? (
          <span className="min-w-0 flex-1 truncate whitespace-nowrap">{label}</span>
        ) : null}
      </Link>
    </SidebarTooltip>
  );
}

function CollapsibleNavSection({
  label,
  icon: Icon,
  isActive,
  isOpen,
  onToggle,
  children,
  collapsed = false,
  pathname,
  maxHeightClass = "max-h-[520px]",
}: {
  label: string;
  icon: typeof LayoutDashboard;
  isActive: boolean;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
  collapsed?: boolean;
  pathname: string;
  maxHeightClass?: string;
}) {
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!collapsed) {
      setFlyoutOpen(false);
    }
  }, [collapsed]);

  useEffect(() => {
    setFlyoutOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!flyoutOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!sectionRef.current?.contains(event.target as Node)) {
        setFlyoutOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFlyoutOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [flyoutOpen]);

  if (collapsed) {
    return (
      <div ref={sectionRef} className="relative pt-2">
        <SidebarTooltip label={label} className="block w-full">
          <button
            type="button"
            onClick={() => setFlyoutOpen((current) => !current)}
            className={cn(
              "flex w-full items-center justify-center rounded-lg border py-2 transition duration-200",
              isActive || flyoutOpen
                ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/18 dark:text-blue-200"
                : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <Icon size={18} className={isActive ? "text-blue-600 dark:text-blue-300" : undefined} />
          </button>
        </SidebarTooltip>

        {flyoutOpen ? (
          <div className="absolute left-[calc(100%+0.5rem)] top-0 z-50 w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <p className="truncate px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {label}
            </p>
            <div className="mt-1">{children}</div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-w-0 pt-2">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full min-w-0 max-w-full items-center justify-between gap-1 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 py-2 pl-3.5 pr-2 text-left text-[13px] font-semibold leading-none transition duration-200 dark:border-slate-700 dark:bg-slate-800/70",
          isActive
            ? "text-blue-700 dark:text-blue-200"
            : "text-slate-700 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <Icon
            size={16}
            className={cn("shrink-0", isActive ? "text-blue-600 dark:text-blue-300" : undefined)}
          />
          <span className="min-w-0 flex-1 truncate whitespace-nowrap">{label}</span>
        </span>
        <ChevronDown
          size={14}
          className={cn("shrink-0 opacity-70 transition-transform duration-200", isOpen ? "rotate-0" : "-rotate-90")}
        />
      </button>

      <div
        className={cn(
          "mt-1 min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 transition-all duration-200 dark:border-slate-700 dark:bg-slate-800/40",
          isOpen ? `${maxHeightClass} opacity-100` : "max-h-0 border-transparent opacity-0"
        )}
      >
        {children}
      </div>
    </div>
  );
}

function SectionLinks({
  sections,
  pathname,
}: {
  sections: Array<{ title?: string; items: Array<{ href: string; label: string; icon: typeof LayoutDashboard }> }>;
  pathname: string;
}) {
  return (
    <div className="min-w-0 space-y-2.5 overflow-hidden p-1.5">
      {sections.map((section, index) => (
        <div key={section.title ?? `section-${index}`}>
          {section.title ? (
            <p className="truncate border-b border-dashed border-slate-300 px-1.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-600 dark:text-slate-300">
              {section.title}
            </p>
          ) : null}
          <div className={cn("space-y-0.5", section.title ? "mt-0.5" : undefined)}>
            {section.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  isActive={isActive}
                  compact
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggleCollapsed } = useSidebarLayout();
  const isPublisherManagementActive = publisherManagementSections.some((section) =>
    section.items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
  );
  const isClientManagementActive = clientManagementSections.some((section) =>
    section.items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
  );
  const isReportsActive = pathname.startsWith("/reports");
  const [isPublisherManagementOpen, setIsPublisherManagementOpen] = useState(true);
  const [isClientManagementOpen, setIsClientManagementOpen] = useState(true);
  const [isReportsOpen, setIsReportsOpen] = useState(true);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-20 flex h-screen flex-col overflow-hidden border-r border-slate-200 bg-white py-5 shadow-sm transition-[width,padding] duration-300 ease-in-out dark:border-slate-700 dark:bg-slate-900",
        collapsed ? "w-[4.5rem] px-2" : "w-64 px-3"
      )}
    >
      <div className={cn("mb-5 shrink-0", collapsed ? "px-0" : "px-1")}>
        {collapsed ? (
          <div className="flex justify-center">
            <SidebarTooltip label="Expand sidebar">
              <button
                type="button"
                onClick={toggleCollapsed}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition duration-200 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <PanelLeftOpen size={18} />
              </button>
            </SidebarTooltip>
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
              S
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold leading-tight text-slate-900 dark:text-slate-100">
                SaaS Admin
              </h1>
              <p className="truncate text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Lead Management
              </p>
            </div>
            <SidebarTooltip label="Collapse sidebar" className="shrink-0">
              <button
                type="button"
                onClick={toggleCollapsed}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition duration-200 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <PanelLeftClose size={18} />
              </button>
            </SidebarTooltip>
          </div>
        )}
      </div>

      <nav className="min-w-0 flex-1 space-y-1 overflow-x-hidden overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

          return (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              isActive={isActive}
              collapsed={collapsed}
            />
          );
        })}

        <CollapsibleNavSection
          label="All Reports"
          icon={LayoutList}
          isActive={isReportsActive}
          isOpen={isReportsOpen}
          collapsed={collapsed}
          pathname={pathname}
          onToggle={() => setIsReportsOpen((current) => !current)}
        >
          <SectionLinks sections={reportSections} pathname={pathname} />
        </CollapsibleNavSection>

        <CollapsibleNavSection
          label="Publisher Management"
          icon={Users}
          isActive={isPublisherManagementActive}
          isOpen={isPublisherManagementOpen}
          collapsed={collapsed}
          pathname={pathname}
          onToggle={() => setIsPublisherManagementOpen((current) => !current)}
          maxHeightClass="max-h-[320px]"
        >
          <SectionLinks sections={publisherManagementSections} pathname={pathname} />
        </CollapsibleNavSection>

        <CollapsibleNavSection
          label="Client Management"
          icon={BriefcaseBusiness}
          isActive={isClientManagementActive}
          isOpen={isClientManagementOpen}
          collapsed={collapsed}
          pathname={pathname}
          onToggle={() => setIsClientManagementOpen((current) => !current)}
        >
          <SectionLinks sections={clientManagementSections} pathname={pathname} />
        </CollapsibleNavSection>
      </nav>
    </aside>
  );
}
