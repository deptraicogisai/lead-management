import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const LONG_LIST_DUAL_SAVE_THRESHOLD = 4;

export function shouldUseDualSaveBar(itemCount: number) {
  return itemCount >= LONG_LIST_DUAL_SAVE_THRESHOLD;
}

type DualSaveBarProps = {
  renderActions: () => ReactNode;
  children: ReactNode;
  feedback?: ReactNode;
  className?: string;
  barClassName?: string;
  /** When false, only show save actions at the bottom (for short forms). */
  dual?: boolean;
};

function SaveBarRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-end gap-3", className)}>{children}</div>
  );
}

export function DualSaveBar({
  renderActions,
  children,
  feedback,
  className,
  barClassName,
  dual = true,
}: DualSaveBarProps) {
  const bottomBarClassName = cn(
    "border-t border-slate-200 pt-4 dark:border-slate-700",
    barClassName
  );

  return (
    <div className={cn("space-y-4", className)}>
      {dual ? (
        <SaveBarRow
          className={cn(
            "border-b border-slate-200 pb-4 dark:border-slate-700",
            barClassName
          )}
        >
          {renderActions()}
        </SaveBarRow>
      ) : null}
      {children}
      <div className="space-y-2">
        <SaveBarRow className={bottomBarClassName}>{renderActions()}</SaveBarRow>
        {feedback}
      </div>
    </div>
  );
}
