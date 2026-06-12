import { getStatusBadgePresentation, getStatusDisplayLabel, type StatusBadgeVariant } from "@/lib/status-badge";
import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  status: string;
  label?: string;
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
  label,
  variant = "outline",
  className,
  size = "sm",
  compact = false,
}: StatusBadgeProps) {
  const presentation = getStatusBadgePresentation(status, variant);
  const displayLabel = label ?? getStatusDisplayLabel(status);

  return (
    <span
      className={cn(
        presentation.className,
        compact ? "px-2 py-0.5 text-[10px]" : sizeClasses[size],
        className
      )}
      style={presentation.style}
    >
      {displayLabel}
    </span>
  );
}
