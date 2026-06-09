import { Ban, LayoutList, Rocket, Shuffle } from "lucide-react";

export type ClientManagementNavItem = {
  href: string;
  label: string;
  icon: typeof LayoutList;
};

export type ClientManagementNavSection = {
  title?: string;
  items: ClientManagementNavItem[];
};

export const clientManagementSections: ClientManagementNavSection[] = [
  {
    items: [{ href: "/buyers", label: "Buyer List", icon: LayoutList }],
  },
  {
    title: "Setup",
    items: [
      { href: "/campaigns", label: "Campaigns", icon: Shuffle },
      { href: "/integration-builder", label: "Integration Builder", icon: Rocket },
      { href: "/ping-tree-settings", label: "Ping Tree Settings", icon: Shuffle },
      { href: "/present-lists", label: "Present & Do Not Present Lists", icon: Ban },
    ],
  },
];

export const clientManagementNavItems = clientManagementSections.flatMap((section) => section.items);
