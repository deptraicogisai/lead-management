"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";

type InfoPopoverProps = {
  title?: string;
  description: string;
  children: ReactNode;
  className?: string;
  /** Prefer placing the card above/below the help icon. */
  side?: "top" | "bottom";
};

type PopoverPosition = {
  top: number;
  left: number;
  side: "top" | "bottom";
  arrowLeft: number;
};

/**
 * Label + (?) icon; hover the icon to show a dark info tooltip.
 */
export function InfoPopover({
  title,
  description,
  children,
  className,
  side = "bottom",
}: InfoPopoverProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const card = cardRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const cardWidth = card?.offsetWidth || 160;
    const cardHeight = card?.offsetHeight || 36;
    const gap = 8;
    const viewportPadding = 8;

    const preferredSide =
      side === "top"
        ? rect.top >= cardHeight + gap + viewportPadding
          ? "top"
          : "bottom"
        : rect.bottom + cardHeight + gap <= window.innerHeight - viewportPadding
          ? "bottom"
          : "top";

    const rawLeft = rect.left + rect.width / 2 - cardWidth / 2;
    const left = Math.min(
      Math.max(viewportPadding, rawLeft),
      window.innerWidth - cardWidth - viewportPadding
    );
    const top =
      preferredSide === "top" ? rect.top - cardHeight - gap : rect.bottom + gap;
    const arrowLeft = Math.min(
      Math.max(14, rect.left + rect.width / 2 - left),
      cardWidth - 14
    );

    setPosition({ top, left, side: preferredSide, arrowLeft });
  }, [side]);

  useEffect(() => {
    if (!open) return;

    updatePosition();
    const frame = requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span>{children}</span>
      <span
        ref={triggerRef}
        role="img"
        aria-label={title ? `About ${title}` : "More information"}
        aria-describedby={open ? tooltipId : undefined}
        className={cn(
          "inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full text-slate-500 transition",
          "hover:text-sky-600 dark:text-slate-300 dark:hover:text-sky-300"
        )}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <CircleHelp size={14} strokeWidth={2.25} aria-hidden />
      </span>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={cardRef}
              id={tooltipId}
              role="tooltip"
              style={
                position
                  ? { top: position.top, left: position.left }
                  : { top: -9999, left: -9999, visibility: "hidden" }
              }
              className={cn(
                "pointer-events-none fixed z-[120] w-max max-w-[min(28rem,calc(100vw-16px))] px-2.5 py-1.5 text-left transition duration-150 ease-out",
                "rounded-md bg-slate-950 text-[11px] leading-snug text-white shadow-[0_8px_20px_-8px_rgba(15,23,42,0.5)]",
                "ring-1 ring-white/10 dark:bg-slate-950 dark:ring-white/15",
                position ? "opacity-100 translate-y-0" : "opacity-0 translate-y-0.5"
              )}
            >
              {position ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute h-2 w-2 rotate-45 bg-slate-950",
                    position.side === "bottom" ? "-top-1" : "-bottom-1"
                  )}
                  style={{ left: position.arrowLeft - 4 }}
                />
              ) : null}

              <span className="relative z-[1] block whitespace-pre-line text-pretty text-slate-100">
                {description}
              </span>
            </div>,
            document.body
          )
        : null}
    </span>
  );
}
