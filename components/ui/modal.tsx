"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type ModalProps = {
  open: boolean;
  title: ReactNode;
  description?: string;
  children?: ReactNode;
  actions?: ReactNode;
  onClose?: () => void;
  panelClassName?: string;
  className?: string;
  disablePortal?: boolean;
};

export function Modal({
  open,
  title,
  description,
  children,
  actions,
  onClose,
  panelClassName,
  className,
  disablePortal = false,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || (!disablePortal && !mounted)) return null;

  const content = (
    <div
      className={cn(
        "animate-fade-in fixed inset-0 z-[60] flex items-center justify-center overflow-x-hidden overflow-y-auto overscroll-contain bg-slate-950/45 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:py-6",
        className
      )}
    >
      <div
        className={cn(
          "animate-scale-in flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl",
          "max-h-[min(90dvh,calc(100dvh-2rem))] p-4 sm:max-h-[90vh] sm:p-6",
          "dark:border-slate-700 dark:bg-slate-900",
          panelClassName ?? "max-w-md"
        )}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-slate-900 sm:text-lg dark:text-slate-100">{title}</h3>
            {description ? (
              <p className="mt-1.5 text-xs text-slate-600 sm:mt-2 sm:text-sm dark:text-slate-400">{description}</p>
            ) : null}
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition duration-200 hover:bg-slate-100 hover:text-slate-700 active:scale-95 sm:h-9 sm:w-9 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <X size={18} />
            </button>
          ) : null}
        </div>

        {children ? <div className="modal-body mt-3 min-w-0 overflow-x-auto overflow-y-auto sm:mt-4">{children}</div> : null}
        {actions ? (
          <div className="modal-actions mt-4 flex w-full min-w-0 flex-col-reverse gap-2 sm:mt-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );

  if (disablePortal) return content;
  return createPortal(content, document.body);
}
