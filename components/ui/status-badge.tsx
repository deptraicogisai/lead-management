import { getStatusBadgeClassName, type StatusBadgeVariant } from "@/lib/status-badge";
import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  status: string;
  variant?: StatusBadgeVariant;
  className?: string;
  size?: "xs" | "sm";
  compact?: boolean;
};

const sizeClasses = {
  xs: "px-2 py-0.5 text-[10px]",
  sm: "px-2.5 py-0.5 text-xs",
};

export function StatusBadge({
  status,
  variant = "pill",
  className,
  size = "sm",
  compact = false,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center",
        getStatusBadgeClassName(status, variant),
        compact ? "px-2 py-0.5 text-[10px]" : sizeClasses[size],
        className
      )}
    >
      {status}
    </span>
  );
}
