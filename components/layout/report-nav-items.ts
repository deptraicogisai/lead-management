import { BriefcaseBusiness, Boxes, List } from "lucide-react";

export type ReportNavItem = {
  href: string;
  label: string;
  icon: typeof List;
};

export type ReportNavSection = {
  title: string;
  items: ReportNavItem[];
};

export const reportSections: ReportNavSection[] = [
  {
    title: "Publisher Reports",
    items: [
      { href: "/reports/publisher/performance-summary", label: "Performance Summary", icon: Boxes },
      { href: "/reports/publisher/lead-details", label: "Lead Details", icon: List },
    ],
  },
  {
    title: "Buyer Reports",
    items: [
      { href: "/reports/buyer/performance-summary", label: "Performance Summary", icon: BriefcaseBusiness },
      { href: "/reports/buyer/lead-details", label: "Lead Details", icon: List },
    ],
  },
];

export const reportNavItems = reportSections.flatMap((section) => section.items);
