"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  FileText,
  LayoutDashboard,
  LayoutList,
  ScrollText,
  Users,
} from "lucide-react";
import { clientManagementSections } from "@/components/layout/client-management-nav-items";
import { SidebarTooltip } from "@/components/layout/sidebar-tooltip";
import { publisherManagementSections } from "@/components/layout/publisher-management-nav-items";
import { reportSections } from "@/components/layout/report-nav-items";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/verticals", label: "Vertical", icon: BriefcaseBusiness },
  { href: "/buyers", label: "Buyer List", icon: LayoutList },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/logs", label: "Logs", icon: ScrollText },
];

type NavLinkProps = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  isActive: boolean;
  compact?: boolean;
  collapsed?: boolean;
  isMobile?: boolean;
  onNavigate?: () => void;
};

function NavLink({
  href,
  label,
  icon: Icon,
  isActive,
  compact = false,
  collapsed = false,
  isMobile = false,
  onNavigate,
}: NavLinkProps) {
  const iconSize = isMobile ? 20 : collapsed ? 18 : compact ? 15 : 16;

  const link = (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "group relative flex w-full min-w-0 max-w-full cursor-pointer items-center overflow-hidden font-medium transition-colors duration-200",
        isMobile
          ? "min-h-[48px] gap-3 rounded-xl px-4 py-3 text-[15px] leading-none"
          : cn(
              "rounded-lg py-2",
              collapsed ? "justify-center px-2" : "gap-2 pl-3.5 pr-2",
              compact ? "text-xs leading-none" : "text-sm leading-none"
            ),
        isActive
          ? isMobile
            ? "bg-blue-600 text-white shadow-md shadow-blue-600/20 dark:bg-blue-500 dark:shadow-blue-500/20"
            : "bg-blue-50 text-blue-700 shadow-sm dark:bg-blue-500/18 dark:text-blue-200"
          : isMobile
            ? "text-slate-700 hover:bg-slate-100 active:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800 dark:active:bg-slate-800"
            : "text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
      )}
    >
      {!collapsed && !isMobile ? (
        <span
          className={cn(
            "absolute left-1 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full transition-all duration-200",
            isActive
              ? "bg-blue-600 opacity-100 dark:bg-blue-300"
              : "bg-slate-300 opacity-0 group-hover:h-7 group-hover:opacity-100 dark:bg-slate-500"
          )}
        />
      ) : null}
      <span
        className={cn(
          "flex shrink-0 items-center justify-center",
          isMobile && "h-9 w-9 rounded-lg",
          isMobile && (isActive ? "bg-white/15" : "bg-slate-100 dark:bg-slate-800"),
          !collapsed && !isMobile && "transition-transform duration-200 group-hover:translate-x-0.5"
        )}
      >
        <Icon size={iconSize} />
      </span>
      {!collapsed ? <span className="min-w-0 flex-1 truncate whitespace-nowrap">{label}</span> : null}
      {isMobile ? <ChevronRight size={16} className={cn("shrink-0 opacity-50", isActive && "opacity-80")} /> : null}
    </Link>
  );

  if (collapsed && !isMobile) {
    return (
      <SidebarTooltip label={label} enabled className="block w-full">
        {link}
      </SidebarTooltip>
    );
  }

  return link;
}

function CollapsibleNavSection({
  label,
  icon: Icon,
  isActive,
  isOpen,
  onToggle,
  children,
  collapsed = false,
  isMobile = false,
  pathname,
  maxHeightClass = "max-h-[520px]",
  onNavigate,
}: {
  label: string;
  icon: typeof LayoutDashboard;
  isActive: boolean;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
  collapsed?: boolean;
  isMobile?: boolean;
  pathname: string;
  maxHeightClass?: string;
  onNavigate?: () => void;
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

  if (isMobile) {
    return (
      <div className="pt-1">
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "flex min-h-[48px] w-full items-center justify-between gap-2 rounded-xl px-4 py-3 text-left text-[15px] font-semibold transition-colors duration-200",
            isActive
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/80 dark:bg-slate-900/20">
              <Icon size={18} />
            </span>
            <span className="truncate">{label}</span>
          </span>
          <ChevronDown
            size={18}
            className={cn("shrink-0 transition-transform duration-300", isOpen ? "rotate-180" : "rotate-0")}
          />
        </button>

        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out",
            isOpen ? "mt-2 grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="overflow-hidden">
            <div className="space-y-1 rounded-xl bg-slate-50 p-2 dark:bg-slate-800/50">{children}</div>
          </div>
        </div>
      </div>
    );
  }

  if (collapsed) {
    return (
      <div ref={sectionRef} className="relative pt-2">
        <SidebarTooltip label={label} className="block w-full">
          <button
            type="button"
            onClick={() => setFlyoutOpen((current) => !current)}
            className={cn(
              "flex w-full items-center justify-center rounded-lg border py-2 transition-colors duration-200",
              isActive || flyoutOpen
                ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/18 dark:text-blue-200"
                : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100 dark:hover:bg-slate-700"
            )}
          >
            <Icon size={18} className={isActive ? "text-blue-600 dark:text-blue-300" : undefined} />
          </button>
        </SidebarTooltip>

        {flyoutOpen ? (
          <div className="absolute left-[calc(100%+0.5rem)] top-0 z-50 w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <p className="truncate px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
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
          "flex w-full min-w-0 max-w-full items-center justify-between gap-1 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 py-2 pl-3.5 pr-2 text-left text-[13px] font-semibold leading-none transition-colors duration-200 dark:border-slate-700 dark:bg-slate-800/70",
          isActive
            ? "text-blue-700 dark:text-blue-200"
            : "text-slate-700 hover:bg-slate-200 dark:text-slate-100 dark:hover:bg-slate-700"
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <Icon size={16} className={cn("shrink-0", isActive ? "text-blue-600 dark:text-blue-300" : undefined)} />
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
  isMobile = false,
  onNavigate,
}: {
  sections: Array<{ title?: string; items: Array<{ href: string; label: string; icon: typeof LayoutDashboard }> }>;
  pathname: string;
  isMobile?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className={cn("min-w-0 overflow-hidden", isMobile ? "space-y-1" : "space-y-2.5 p-1.5")}>
      {sections.map((section, index) => (
        <div key={section.title ?? `section-${index}`}>
          {section.title ? (
            <p
              className={cn(
                "truncate font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300",
                isMobile ? "px-3 py-2 text-[12px]" : "border-b border-dashed border-slate-300 px-1.5 pb-1.5 text-[11px] dark:border-slate-600"
              )}
            >
              {section.title}
            </p>
          ) : null}
          <div className={cn(isMobile ? "space-y-1" : "space-y-0.5", section.title && !isMobile ? "mt-0.5" : undefined)}>
            {section.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  isActive={isActive}
                  compact={!isMobile}
                  isMobile={isMobile}
                  onNavigate={onNavigate}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

type SidebarNavContentProps = {
  collapsed?: boolean;
  isMobile?: boolean;
  onNavigate?: () => void;
};

export function SidebarNavContent({ collapsed = false, isMobile = false, onNavigate }: SidebarNavContentProps) {
  const pathname = usePathname();
  const isPublisherManagementActive = publisherManagementSections.some((section) =>
    section.items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
  );
  const isClientManagementActive = clientManagementSections.some((section) =>
    section.items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
  );
  const isReportsActive = pathname.startsWith("/reports");
  const [isPublisherManagementOpen, setIsPublisherManagementOpen] = useState(() => !isMobile);
  const [isClientManagementOpen, setIsClientManagementOpen] = useState(() => !isMobile);
  const [isReportsOpen, setIsReportsOpen] = useState(() => !isMobile);

  return (
    <nav className={cn(isMobile ? "space-y-1.5" : "sidebar-nav-scroll min-w-0 flex-1 space-y-1")}>
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
            isMobile={isMobile}
            onNavigate={onNavigate}
          />
        );
      })}

      <CollapsibleNavSection
        label="All Reports"
        icon={LayoutList}
        isActive={isReportsActive}
        isOpen={isReportsOpen}
        collapsed={collapsed}
        isMobile={isMobile}
        pathname={pathname}
        onToggle={() => setIsReportsOpen((current) => !current)}
        onNavigate={onNavigate}
      >
        <SectionLinks sections={reportSections} pathname={pathname} isMobile={isMobile} onNavigate={onNavigate} />
      </CollapsibleNavSection>

      <CollapsibleNavSection
        label="Publisher Management"
        icon={Users}
        isActive={isPublisherManagementActive}
        isOpen={isPublisherManagementOpen}
        collapsed={collapsed}
        isMobile={isMobile}
        pathname={pathname}
        onToggle={() => setIsPublisherManagementOpen((current) => !current)}
        maxHeightClass="max-h-[320px]"
        onNavigate={onNavigate}
      >
        <SectionLinks
          sections={publisherManagementSections}
          pathname={pathname}
          isMobile={isMobile}
          onNavigate={onNavigate}
        />
      </CollapsibleNavSection>

      <CollapsibleNavSection
        label="Client Management"
        icon={BriefcaseBusiness}
        isActive={isClientManagementActive}
        isOpen={isClientManagementOpen}
        collapsed={collapsed}
        isMobile={isMobile}
        pathname={pathname}
        onToggle={() => setIsClientManagementOpen((current) => !current)}
        onNavigate={onNavigate}
      >
        <SectionLinks
          sections={clientManagementSections}
          pathname={pathname}
          isMobile={isMobile}
          onNavigate={onNavigate}
        />
      </CollapsibleNavSection>
    </nav>
  );
}
