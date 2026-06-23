import {
  Check,
  Copy,
  Download,
  Eye,
  LogIn,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings2,
  Trash2,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

export function buttonLabelText(children: ReactNode): string {
  if (children == null || typeof children === "boolean") return "";
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(buttonLabelText).join("");
  if (typeof children === "object" && "props" in children) {
    return buttonLabelText((children as { props?: { children?: ReactNode } }).props?.children);
  }
  return "";
}

export function inferPrimaryIcon(label: string): LucideIcon {
  const text = label.toLowerCase().trim();
  if (!text) return Save;
  if (text.includes("search")) return Search;
  if (text.includes("creat") || text.includes("add") || text.includes("new")) return Plus;
  if (text.includes("import")) return Upload;
  if (text.includes("export")) return Download;
  if (text.includes("apply") || text.includes("confirm")) return Check;
  if (text.includes("copy")) return Copy;
  if (text.includes("test") || text.includes("run") || text.includes("mock") || text.includes("send")) return Play;
  if (text.includes("retry") || text.includes("again")) return RotateCcw;
  if (text.includes("update") || text.includes("edit")) return Pencil;
  if (text.includes("log in") || text.includes("sign in")) return LogIn;
  return Save;
}

export function inferTableActionIcon(label: string): LucideIcon {
  const text = label.toLowerCase().trim();
  if (text.includes("delete") || text.includes("remove")) return Trash2;
  if (text.includes("edit")) return Pencil;
  if (text.includes("view")) return Eye;
  if (text.includes("api") || text.includes("config")) return Settings2;
  if (text.includes("configure")) return Settings2;
  if (text.includes("clone")) return Copy;
  if (text.includes("export")) return Download;
  if (text.includes("test")) return Play;
  return Eye;
}

type IconTextProps = {
  icon: LucideIcon;
  children: ReactNode;
  size?: number;
};

export function IconText({ icon: Icon, children, size = 16 }: IconTextProps) {
  return (
    <>
      <Icon size={size} aria-hidden className="shrink-0" />
      {children}
    </>
  );
}

export const cancelIcon = X;
export const dangerIcon = Trash2;
export const warningIcon = Trash2;
