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
    <div
      className={cn(
        "mobile-page-actions flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3",
        className
      )}
    >
      {children}
    </div>
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
    "sticky bottom-0 z-10 -mx-1 border-t border-slate-200 bg-white/95 px-1 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95 sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:pt-4 sm:pb-0 sm:backdrop-blur-none dark:sm:bg-transparent",
    barClassName
  );

  return (
    <div className={cn("space-y-4", className)}>
      {dual ? (
        <SaveBarRow
          className={cn(
            "hidden border-b border-slate-200 pb-4 sm:flex dark:border-slate-700",
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
