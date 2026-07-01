import { clientManagementNavItems } from "@/components/layout/client-management-nav-items";
import { publisherManagementNavItems } from "@/components/layout/publisher-management-nav-items";
import { reportSections } from "@/components/layout/report-nav-items";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BuildBreadcrumbsOptions = {
  overrideLabel?: string | null;
  searchParams?: Pick<URLSearchParams, "get"> | null;
};

type BreadcrumbResult = {
  items: BreadcrumbItem[];
  pageTitle: string;
};

const DASHBOARD_CRUMB: BreadcrumbItem = { label: "Dashboard", href: "/dashboard" };

const STATIC_ROUTES: Record<string, { pageTitle: string }> = {
  "/leads": { pageTitle: "Leads" },
  "/logs": { pageTitle: "Logs" },
  "/distributions": { pageTitle: "Distributions" },
  "/ping-tree-settings": { pageTitle: "Ping Tree Settings" },
  "/documents": { pageTitle: "Documents" },
  "/settings": { pageTitle: "Settings" },
};

function withDashboard(items: BreadcrumbItem[]) {
  if (items[0]?.label === "Dashboard") {
    return items;
  }

  return [DASHBOARD_CRUMB, ...items];
}

function buildListDetailBreadcrumbs(
  listLabel: string,
  listHref: string,
  detailLabel: string
): BreadcrumbResult {
  return {
    items: withDashboard([
      { label: listLabel, href: listHref },
      { label: detailLabel },
    ]),
    pageTitle: detailLabel,
  };
}

function buildApiConfigSellerHref(sellerId: string, sellerName?: string) {
  if (!sellerId) return "/api-config";

  const params = new URLSearchParams({ sellerId });
  if (sellerName) {
    params.set("sellerName", sellerName);
  }

  return `/api-config?${params.toString()}`;
}

function hasPublisherContext(context: { sellerId: string; sellerName: string }) {
  return Boolean(context.sellerId || context.sellerName);
}

function buildPublisherApiBreadcrumbs(
  context: { sellerId: string; sellerName: string },
  sellerHref: string,
  tail: BreadcrumbItem[]
) {
  if (!hasPublisherContext(context)) {
    return [{ label: "Publisher Channel", href: "/api-config" }, ...tail];
  }

  return [
    { label: "Publisher Management" },
    { label: "Publisher List", href: "/sellers" },
    ...(context.sellerName
      ? [{ label: context.sellerName, href: sellerHref }]
      : context.sellerId
        ? [{ label: "Publisher Detail", href: sellerHref }]
        : []),
    ...tail,
  ];
}

function resolveApiConfigContext(pathname: string, searchParams?: Pick<URLSearchParams, "get"> | null) {
  const fieldConfigurationMatch = pathname.match(/^\/api-config\/([^/]+)\/mappings\/([^/]+)\/field-configuration$/);

  if (fieldConfigurationMatch) {
    return {
      sellerId: decodeURIComponent(fieldConfigurationMatch[1]),
      mappingId: fieldConfigurationMatch[2],
      sellerName: searchParams?.get("sellerName")?.trim() ?? "",
      apiName: searchParams?.get("apiName")?.trim() ?? "",
      verticalName: searchParams?.get("verticalName")?.trim() ?? "",
    };
  }

  return {
    sellerId: searchParams?.get("sellerId")?.trim() ?? "",
    mappingId: "",
    sellerName: searchParams?.get("sellerName")?.trim() ?? "",
    apiName: searchParams?.get("apiName")?.trim() ?? "",
    verticalName: searchParams?.get("verticalName")?.trim() ?? "",
  };
}

function findPublisherManagementNav(pathname: string) {
  return publisherManagementNavItems.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );
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

function buildBuyersBreadcrumbs(pathname: string, overrideLabel?: string | null) {
  if (pathname === "/buyers") {
    return {
      items: withDashboard([{ label: "Buyer List" }]),
      pageTitle: "Buyer List",
    };
  }

  if (/^\/buyers\/[^/]+$/.test(pathname)) {
    const detailLabel = overrideLabel || "Buyer Detail";
    return buildListDetailBreadcrumbs("Buyer List", "/buyers", detailLabel);
  }

  return null;
}

function buildSellersBreadcrumbs(pathname: string, overrideLabel?: string | null) {
  if (pathname === "/sellers") {
    return {
      items: withDashboard([
        { label: "Publisher Management" },
        { label: "Publisher List" },
      ]),
      pageTitle: "Publisher List",
    };
  }

  if (/^\/sellers\/[^/]+$/.test(pathname)) {
    const detailLabel = overrideLabel || "Publisher Detail";
    return {
      items: withDashboard([
        { label: "Publisher Management" },
        { label: "Publisher List", href: "/sellers" },
        { label: detailLabel },
      ]),
      pageTitle: detailLabel,
    };
  }

  return null;
}

function buildPublisherManagementBreadcrumbs(pathname: string) {
  const navItem = findPublisherManagementNav(pathname);
  if (!navItem || pathname === "/sellers") return null;

  return {
    items: withDashboard([
      { label: "Publisher Management" },
      { label: navItem.label },
    ]),
    pageTitle: navItem.label,
  };
}

function buildVerticalBreadcrumbs(pathname: string, searchParams?: Pick<URLSearchParams, "get"> | null) {
  if (pathname === "/verticals" || pathname === "/industries") {
    return {
      items: withDashboard([{ label: "Vertical" }]),
      pageTitle: "Vertical",
    };
  }

  if (pathname === "/verticals/fields" || pathname === "/industries/fields") {
    const verticalName = searchParams?.get("verticalName")?.trim() ?? "";
    const detailLabel = verticalName ? `${verticalName} - Fields` : "Vertical Fields";

    return {
      items: withDashboard([
        { label: "Vertical", href: "/verticals" },
        { label: detailLabel },
      ]),
      pageTitle: detailLabel,
    };
  }

  return null;
}

function buildClientManagementBreadcrumbs(pathname: string, overrideLabel?: string | null) {
  const navItem = findClientManagementNav(pathname);
  if (!navItem) return null;

  const detailLabel = overrideLabel ?? getClientManagementDetailLabel(pathname);
  const items: BreadcrumbItem[] = [
    { label: "Client Management" },
    ...(pathname === navItem.href
      ? [{ label: navItem.label }]
      : [
          { label: navItem.label, href: navItem.href },
          { label: detailLabel },
        ]),
  ];

  const pageTitle = pathname === navItem.href ? navItem.label : detailLabel;

  return { items: withDashboard(items), pageTitle };
}

function getClientManagementDetailLabel(pathname: string) {
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

  const context = resolveApiConfigContext(pathname, searchParams);
  const sellerHref = buildApiConfigSellerHref(context.sellerId, context.sellerName);

  if (pathname === "/api-config") {
    const items: BreadcrumbItem[] = hasPublisherContext(context)
      ? [
          { label: "Publisher Management" },
          { label: "Publisher List", href: "/sellers" },
          { label: context.sellerName || "Publisher Detail" },
          { label: "Publisher Channel" },
        ]
      : [{ label: "Publisher Channel" }];

    return {
      items: withDashboard(items),
      pageTitle: "Publisher Channel",
    };
  }

  if (/^\/api-config\/[^/]+\/mappings\/[^/]+\/field-configuration$/.test(pathname)) {
    const fieldLabel = context.apiName ? `${context.apiName} - Field Configuration` : "Field Configuration";
    const items = buildPublisherApiBreadcrumbs(context, sellerHref, [{ label: fieldLabel }]);

    return {
      items: withDashboard(items),
      pageTitle: context.apiName ? `Field Configuration - ${context.apiName}` : "Field Configuration",
    };
  }

  if (/^\/api-config\/document\/[^/]+$/.test(pathname)) {
    const documentLabel = context.apiName
      ? `${context.apiName} - Documentation`
      : context.verticalName
        ? `${context.verticalName} - Documentation`
        : "API Documentation";

    const items = buildPublisherApiBreadcrumbs(context, sellerHref, [{ label: documentLabel }]);

    return {
      items: withDashboard(items),
      pageTitle: documentLabel,
    };
  }

  return null;
}

export function buildBreadcrumbs(pathname: string, options: BuildBreadcrumbsOptions = {}) {
  const overrideLabel = options.overrideLabel?.trim() || null;

  if (pathname === "/dashboard") {
    return {
      items: [{ label: "Dashboard" }],
      pageTitle: "Dashboard",
    };
  }

  const apiConfig = buildApiConfigBreadcrumbs(pathname, options.searchParams);
  if (apiConfig) {
    return apiConfig;
  }

  const buyers = buildBuyersBreadcrumbs(pathname, overrideLabel);
  if (buyers) {
    return buyers;
  }

  const sellers = buildSellersBreadcrumbs(pathname, overrideLabel);
  if (sellers) {
    return sellers;
  }

  const publisherManagement = buildPublisherManagementBreadcrumbs(pathname);
  if (publisherManagement) {
    return publisherManagement;
  }

  const verticals = buildVerticalBreadcrumbs(pathname, options.searchParams);
  if (verticals) {
    return verticals;
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
    items: withDashboard([{ label: overrideLabel || fallbackTitle || "Dashboard" }]),
    pageTitle: overrideLabel || fallbackTitle || "Dashboard",
  };
}
