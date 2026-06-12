import { Ban, Rocket, Shuffle, type LucideIcon } from "lucide-react";

export type ClientManagementNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type ClientManagementNavSection = {
  title?: string;
  items: ClientManagementNavItem[];
};

export const clientManagementSections: ClientManagementNavSection[] = [
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
