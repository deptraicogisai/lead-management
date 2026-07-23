"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Plus, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

export type FloatingActionItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
};

type FloatingActionButtonProps = {
  label?: string;
  /** Satellite actions arranged around the main FAB on hover/focus. */
  actions?: FloatingActionItem[];
  disabled?: boolean;
  className?: string;
  /** Fallback single-action click when no `actions` provided. */
  onClick?: () => void;
};

const ORBIT_RADIUS = 78;

function polarOffset(index: number, total: number, radius: number) {
  // Fan above-left of a bottom-right FAB (screen y grows downward).
  const startDeg = 115;
  const endDeg = 195;
  const deg =
    total <= 1 ? 155 : startDeg + ((endDeg - startDeg) * index) / Math.max(total - 1, 1);
  const rad = (deg * Math.PI) / 180;
  return {
    x: Math.cos(rad) * radius,
    y: -Math.sin(rad) * radius,
  };
}

/**
 * Viewport-fixed action. With `actions`, hover/focus (and tap on touch) opens a radial menu.
 */
export function FloatingActionButton({
  label = "Actions",
  actions = [],
  disabled = false,
  className,
  onClick,
}: FloatingActionButtonProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const hasMenu = actions.length > 0;

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const openMenu = () => {
    if (!hasMenu || disabled) return;
    clearCloseTimer();
    setOpen(true);
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setOpen(false), 120);
  };

  useEffect(() => {
    return () => clearCloseTimer();
  }, []);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        clearCloseTimer();
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clearCloseTimer();
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const showMenu = hasMenu && open && !disabled;

  return (
    <div
      ref={rootRef}
      className={cn(
        "fixed z-40",
        "bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1.25rem,env(safe-area-inset-right))]",
        "lg:bottom-7 lg:right-7",
        className
      )}
      onMouseEnter={openMenu}
      onMouseLeave={scheduleClose}
      onFocusCapture={openMenu}
      onBlurCapture={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node)) {
          scheduleClose();
        }
      }}
    >
      {/* Expanded hit-area covers orbit so cursor can reach satellite items. */}
      <div
        className={cn(
          "relative transition-[width,height] duration-150 ease-out",
          showMenu ? "h-44 w-56" : "h-12 w-12"
        )}
      >
        <div className="absolute bottom-0 right-0 flex h-12 w-12 items-center justify-center">
          {hasMenu
            ? actions.map((action, index) => {
                const { x, y } = polarOffset(index, actions.length, ORBIT_RADIUS);
                return (
                  <button
                    key={action.id}
                    type="button"
                    disabled={disabled || action.disabled}
                    onClick={() => {
                      action.onClick();
                      clearCloseTimer();
                      setOpen(false);
                    }}
                    aria-hidden={!showMenu}
                    tabIndex={showMenu ? 0 : -1}
                    className={cn(
                      "absolute left-1/2 top-1/2 z-10 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-2",
                      "rounded-full border border-emerald-700/70 bg-emerald-800 px-3 py-2 text-xs font-semibold text-white",
                      "shadow-[0_10px_24px_-10px_rgba(6,95,70,0.55)] ring-1 ring-white/15",
                      "transition duration-200 ease-out",
                      "hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
                      "disabled:pointer-events-none disabled:opacity-45",
                      "dark:border-emerald-400/40 dark:bg-emerald-600 dark:hover:bg-emerald-500",
                      showMenu
                        ? "pointer-events-auto scale-100 opacity-100"
                        : "pointer-events-none scale-75 opacity-0"
                    )}
                    style={{
                      transform: showMenu
                        ? `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(1)`
                        : "translate(-50%, -50%) scale(0.75)",
                      transitionDelay: showMenu ? `${index * 35}ms` : "0ms",
                    }}
                    title={action.label}
                  >
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15">
                      {action.icon ?? <Plus size={14} strokeWidth={2.5} />}
                    </span>
                    <span className="whitespace-nowrap pr-0.5">{action.label}</span>
                  </button>
                );
              })
            : null}

          <button
            type="button"
            aria-label={label}
            aria-haspopup={hasMenu ? "menu" : undefined}
            aria-expanded={hasMenu ? showMenu : undefined}
            title={label}
            disabled={disabled}
            onClick={() => {
              if (hasMenu) {
                clearCloseTimer();
                setOpen((current) => !current);
                return;
              }
              onClick?.();
            }}
            className={cn(
              "relative z-20 inline-flex h-12 w-12 items-center justify-center rounded-full",
              "border border-emerald-700/80 bg-emerald-800 text-white",
              "shadow-[0_10px_30px_-8px_rgba(6,95,70,0.55)] ring-1 ring-white/15",
              "transition duration-200 ease-out",
              "hover:bg-emerald-700 hover:shadow-[0_14px_34px_-10px_rgba(6,95,70,0.6)]",
              "active:scale-[0.98]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100",
              "disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none",
              "dark:border-emerald-400/50 dark:bg-emerald-600 dark:shadow-[0_10px_30px_-8px_rgba(16,185,129,0.35)]",
              "dark:hover:bg-emerald-500 dark:focus-visible:ring-offset-slate-950",
              showMenu && "bg-emerald-700 dark:bg-emerald-500"
            )}
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
              <Plus
                size={18}
                strokeWidth={2.5}
                className={cn("transition duration-200", showMenu && "rotate-45")}
              />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export const floatingActionIcons = {
  plus: <Plus size={14} strokeWidth={2.5} />,
  upload: <Upload size={14} strokeWidth={2.5} />,
};
