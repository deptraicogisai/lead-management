import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ArrowLeft, Download, Plus, RotateCcw, Search, type LucideIcon } from "lucide-react";
import {
  CancelButton,
  DangerButton,
  WarningButton,
} from "@/components/ui/form-controls";
import {
  dangerButtonClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  tableActionButtonClassName,
  tableActionDangerButtonClassName,
  toolbarPrimaryButtonClassName,
} from "@/lib/button-styles";
import { IconText, buttonLabelText, inferTableActionIcon } from "@/lib/button-icons";
import { cn } from "@/lib/utils";

export { CancelButton, DangerButton, WarningButton };

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
      className={cn(secondaryButtonClassName, className)}
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
  primary: primaryButtonClassName,
  secondary: secondaryButtonClassName,
  danger: dangerButtonClassName,
  ghost:
    "border-transparent bg-transparent font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
};

export function IconActionButton({
  icon: Icon,
  children,
  variant = "secondary",
  className,
  ...props
}: IconActionButtonProps) {
  return (
    <button type="button" {...props} className={cn(iconActionVariants[variant], "px-3 py-2", className)}>
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
      className={cn(toolbarPrimaryButtonClassName, className)}
      {...props}
    >
      {children}
    </IconActionButton>
  );
}

type AddNewButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: LucideIcon;
  children: ReactNode;
};

export function AddNewButton({ icon: Icon = Plus, children, className, ...props }: AddNewButtonProps) {
  return (
    <button type="button" {...props} className={cn(toolbarPrimaryButtonClassName, className)}>
      <Icon size={15} />
      {children}
    </button>
  );
}

export { tableActionButtonClassName, tableActionDangerButtonClassName };

type TableActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: LucideIcon | false;
  variant?: "default" | "danger";
};

export function TableActionButton({
  children,
  icon,
  variant = "default",
  className,
  ...props
}: TableActionButtonProps) {
  const label = buttonLabelText(children);
  const resolvedIcon = icon === false ? null : (icon ?? inferTableActionIcon(label));
  const baseClass = variant === "danger" ? tableActionDangerButtonClassName : tableActionButtonClassName;

  return (
    <button type="button" {...props} className={cn(baseClass, "inline-flex items-center gap-1", className)}>
      {resolvedIcon ? <IconText icon={resolvedIcon} size={12}>{children}</IconText> : children}
    </button>
  );
}

type TableActionLinkProps = {
  href: string;
  children: ReactNode;
  icon?: LucideIcon | false;
  className?: string;
};

export function TableActionLink({ href, children, icon, className }: TableActionLinkProps) {
  const label = buttonLabelText(children);
  const resolvedIcon = icon === false ? null : (icon ?? inferTableActionIcon(label));

  return (
    <Link href={href} className={cn(tableActionButtonClassName, "inline-flex items-center gap-1", className)}>
      {resolvedIcon ? <IconText icon={resolvedIcon} size={12}>{children}</IconText> : children}
    </Link>
  );
}

type DeleteSelectedButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  count: number;
  label?: string;
};

export function DeleteSelectedButton({ count, label = "Delete Selected", className, ...props }: DeleteSelectedButtonProps) {
  return (
    <WarningButton className={className} {...props}>
      {label} ({count})
    </WarningButton>
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
