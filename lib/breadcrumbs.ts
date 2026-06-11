import { clientManagementNavItems } from "@/components/layout/client-management-nav-items";
import { reportSections } from "@/components/layout/report-nav-items";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BuildBreadcrumbsOptions = {
  overrideLabel?: string | null;
  searchParams?: Pick<URLSearchParams, "get"> | null;
};

const DASHBOARD_CRUMB: BreadcrumbItem = { label: "Dashboard", href: "/dashboard" };

const STATIC_ROUTES: Record<string, { pageTitle: string; section?: string }> = {
  "/dashboard": { pageTitle: "Dashboard" },
  "/verticals": { pageTitle: "Vertical" },
  "/verticals/fields": { pageTitle: "Vertical Fields" },
  "/industries": { pageTitle: "Vertical" },
  "/industries/fields": { pageTitle: "Vertical Fields" },
  "/leads": { pageTitle: "Leads" },
  "/logs": { pageTitle: "Logs" },
  "/distributions": { pageTitle: "Distributions" },
  "/vertical-mappings": { pageTitle: "Vertical Mappings" },
  "/api-config": { pageTitle: "API Configuration" },
  "/ping-tree-settings": { pageTitle: "Ping Tree Settings" },
};

function withDashboard(items: BreadcrumbItem[]) {
  if (items[0]?.label === "Dashboard") {
    return items;
  }

  return [DASHBOARD_CRUMB, ...items];
}

function findClientManagementNav(pathname: string) {
  return clientManagementNavItems.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );
}

function findReportNav(pathname: string) {
  for (const section of reportSections) {
    const item = section.items.find(
      (entry) => pathname === entry.href || pathname.startsWith(`${entry.href}/`)
    );

    if (item) {
      return { sectionTitle: section.title, item };
    }
  }

  return null;
}

function buildClientManagementBreadcrumbs(pathname: string, overrideLabel?: string | null) {
  const navItem = findClientManagementNav(pathname);
  if (!navItem) return null;

  const items: BreadcrumbItem[] = [
    { label: "Client Management" },
    ...(pathname === navItem.href
      ? [{ label: navItem.label }]
      : [
          { label: navItem.label, href: navItem.href },
          { label: overrideLabel ?? getClientManagementDetailLabel(pathname) },
        ]),
  ];

  const pageTitle =
    pathname === navItem.href ? navItem.label : overrideLabel ?? getClientManagementDetailLabel(pathname);

  return { items: withDashboard(items), pageTitle };
}

function getClientManagementDetailLabel(pathname: string) {
  if (/^\/buyers\/[^/]+$/.test(pathname)) return "Buyer Detail";
  if (/^\/campaigns\/[^/]+$/.test(pathname)) return "Campaign Setup";
  if (/^\/present-lists\/[^/]+$/.test(pathname)) return "Present List Detail";
  if (/^\/integration-builder\/[^/]+$/.test(pathname)) return "Integration Detail";
  return "Detail";
}

function buildReportBreadcrumbs(pathname: string) {
  const reportNav = findReportNav(pathname);
  if (!reportNav) return null;

  const items: BreadcrumbItem[] = [
    { label: "All Reports" },
    { label: reportNav.sectionTitle },
    { label: reportNav.item.label },
  ];

  return { items: withDashboard(items), pageTitle: reportNav.item.label };
}

function buildApiConfigBreadcrumbs(pathname: string, searchParams?: Pick<URLSearchParams, "get"> | null) {
  if (!pathname.startsWith("/api-config")) return null;

  const sellerId = searchParams?.get("sellerId")?.trim() ?? "";
  const sellerName = searchParams?.get("sellerName")?.trim() ?? "";
  const apiName = searchParams?.get("apiName")?.trim() ?? "";

  if (pathname === "/api-config") {
    const items: BreadcrumbItem[] = [{ label: "API Configuration" }];
    if (sellerName) {
      items.push({ label: sellerName });
    }

    return {
      items: withDashboard(items),
      pageTitle: sellerName ? `API Configuration - ${sellerName}` : "API Configuration",
    };
  }

  if (pathname.includes("/field-configuration")) {
    const sellerHref = sellerId
      ? `/api-config?sellerId=${encodeURIComponent(sellerId)}${sellerName ? `&sellerName=${encodeURIComponent(sellerName)}` : ""}`
      : "/api-config";

    const items: BreadcrumbItem[] = [
      { label: "API Configuration", href: "/api-config" },
      ...(sellerName ? [{ label: sellerName, href: sellerHref }] : []),
      { label: apiName ? `${apiName} - Field Configuration` : "Field Configuration" },
    ];

    return {
      items: withDashboard(items),
      pageTitle: apiName ? `Field Configuration - ${apiName}` : "Field Configuration",
    };
  }

  if (/^\/api-config\/document\/[^/]+$/.test(pathname)) {
    return {
      items: withDashboard([
        { label: "API Configuration", href: "/api-config" },
        { label: "API Documentation" },
      ]),
      pageTitle: "API Documentation",
    };
  }

  return null;
}

export function buildBreadcrumbs(pathname: string, options: BuildBreadcrumbsOptions = {}) {
  const overrideLabel = options.overrideLabel?.trim();

  if (pathname === "/dashboard") {
    return {
      items: [{ label: "Dashboard" }],
      pageTitle: "Dashboard",
    };
  }

  const apiConfig = buildApiConfigBreadcrumbs(pathname, options.searchParams);
  if (apiConfig) {
    if (overrideLabel) {
      const items = [...apiConfig.items];
      items[items.length - 1] = { label: overrideLabel };
      return { items, pageTitle: overrideLabel };
    }

    return apiConfig;
  }

  const clientManagement = buildClientManagementBreadcrumbs(pathname, overrideLabel);
  if (clientManagement) {
    return clientManagement;
  }

  const reports = buildReportBreadcrumbs(pathname);
  if (reports) {
    return reports;
  }

  const staticRoute = STATIC_ROUTES[pathname];
  if (staticRoute) {
    return {
      items: withDashboard([{ label: staticRoute.pageTitle }]),
      pageTitle: staticRoute.pageTitle,
    };
  }

  const fallbackTitle = pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.replace(/-/g, " "))
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" / ");

  return {
    items: withDashboard([{ label: fallbackTitle || "Dashboard" }]),
    pageTitle: fallbackTitle || "Dashboard",
  };
}
