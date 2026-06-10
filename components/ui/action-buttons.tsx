import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ArrowLeft, Download, RotateCcw, Search, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const detailLinkClassName =
  "cursor-pointer font-medium text-blue-700 transition hover:text-blue-800 hover:underline dark:text-blue-300 dark:hover:text-blue-200";

type DetailNameLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
};

export function DetailNameLink({ href, children, className }: DetailNameLinkProps) {
  return (
    <Link href={href} className={cn(detailLinkClassName, className)}>
      {children}
    </Link>
  );
}

type BackLinkProps = {
  href: string;
  label?: string;
  className?: string;
};

export function BackLink({ href, label = "Back", className }: BackLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-slate-50 hover:text-blue-800 dark:border-slate-600 dark:text-blue-300 dark:hover:bg-slate-800 dark:hover:text-blue-200",
        className
      )}
    >
      <ArrowLeft size={16} />
      {label}
    </Link>
  );
}

type IconActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
};

const iconActionVariants = {
  primary:
    "border-emerald-700 bg-emerald-800 text-white hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500",
  secondary:
    "border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
  danger: "border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300",
  ghost:
    "border-transparent bg-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
};

export function IconActionButton({
  icon: Icon,
  children,
  variant = "secondary",
  className,
  ...props
}: IconActionButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
        iconActionVariants[variant],
        className
      )}
    >
      <Icon size={16} />
      {children}
    </button>
  );
}

export function SearchButton({
  className,
  children = "Search",
  ...props
}: Partial<Pick<IconActionButtonProps, "children">> & Omit<IconActionButtonProps, "icon" | "variant" | "children">) {
  return (
    <IconActionButton icon={Search} variant="primary" className={cn("px-4 py-2.5", className)} {...props}>
      {children}
    </IconActionButton>
  );
}

export function ClearButton({
  className,
  children = "Clear all",
  ...props
}: Partial<Pick<IconActionButtonProps, "children">> & Omit<IconActionButtonProps, "icon" | "variant" | "children">) {
  return (
    <IconActionButton icon={RotateCcw} variant="secondary" className={cn("px-4 py-2.5", className)} {...props}>
      {children}
    </IconActionButton>
  );
}

export function ExportButton({
  className,
  children = "Export",
  disabled,
  title,
  ...props
}: Partial<Pick<IconActionButtonProps, "children">> & Omit<IconActionButtonProps, "icon" | "variant" | "children">) {
  return (
    <IconActionButton
      icon={Download}
      variant="primary"
      disabled={disabled}
      title={title ?? (disabled ? "Coming soon" : undefined)}
      className={className}
      {...props}
    >
      {children}
    </IconActionButton>
  );
}

type ComingSoonButtonProps = {
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
};

export function ComingSoonButton({ icon: Icon, children, className }: ComingSoonButtonProps) {
  return (
    <button
      type="button"
      disabled
      title="Coming soon"
      className={cn(
        "inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500 opacity-80 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400",
        className
      )}
    >
      <Icon size={14} />
      {children}
    </button>
  );
}
