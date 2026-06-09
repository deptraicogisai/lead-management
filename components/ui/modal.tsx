"use client";

import type { ReactNode } from "react";

type ModalProps = {
  open: boolean;
  title: ReactNode;
  description?: string;
  children?: ReactNode;
  actions?: ReactNode;
  onClose?: () => void;
  panelClassName?: string;
};

export function Modal({ open, title, description, children, actions, onClose, panelClassName }: ModalProps) {
  if (!open) return null;

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 px-4 py-6">
      <div
        className={`animate-scale-in flex max-h-[90vh] w-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900 ${panelClassName ?? "max-w-md"}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
            {description ? <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{description}</p> : null}
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-slate-400 transition duration-200 hover:bg-slate-100 hover:text-slate-700 active:scale-95 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              x
            </button>
          ) : null}
        </div>

        {children ? <div className="mt-4 overflow-y-auto pr-1">{children}</div> : null}
        {actions ? <div className="mt-6 flex items-center justify-end gap-3">{actions}</div> : null}
      </div>
    </div>
  );
}
