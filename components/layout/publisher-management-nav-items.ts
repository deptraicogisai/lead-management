import { List, Radio, Share2, type LucideIcon } from "lucide-react";

export type PublisherManagementNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type PublisherManagementNavSection = {
  title?: string;
  items: PublisherManagementNavItem[];
};

export const publisherManagementSections: PublisherManagementNavSection[] = [
  {
    items: [
      { href: "/sellers", label: "Publisher List", icon: List },
      { href: "/publisher-channels", label: "Publisher Channels", icon: Radio },
      { href: "/publisher-sources", label: "Publisher Sources", icon: Share2 },
    ],
  },
];

export const publisherManagementNavItems = publisherManagementSections.flatMap((section) => section.items);
