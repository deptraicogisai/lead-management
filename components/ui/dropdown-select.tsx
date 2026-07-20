"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export type DropdownSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type DropdownSelectProps = {
  id?: string;
  value: string;
  options: DropdownSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  menuClassName?: string;
  disabled?: boolean;
  maxVisibleItems?: number;
  size?: "default" | "compact";
  /** Keep the menu in-place (needed inside font-scale-stable containers). */
  disablePortal?: boolean;
};

type MenuPosition = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
};

const ITEM_HEIGHT = 36;
const MENU_GAP = 4;
const VIEWPORT_PADDING = 8;

export function DropdownSelect({
  id,
  value,
  options,
  onChange,
  placeholder = "Please select",
  className,
  menuClassName,
  disabled = false,
  maxVisibleItems = 5,
  size = "default",
  disablePortal = false,
}: DropdownSelectProps) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selectedLabel = useMemo(
    () => options.find((option) => option.value === value)?.label,
    [options, value]
  );

  useEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }

    const updatePosition = () => {
      if (disablePortal) return;
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const menuHeight = Math.min(options.length, maxVisibleItems) * ITEM_HEIGHT + 8;
      const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PADDING;
      const spaceAbove = rect.top - VIEWPORT_PADDING;
      const openUpward = spaceBelow < menuHeight && spaceAbove > spaceBelow;
      const width = Math.min(rect.width, window.innerWidth - VIEWPORT_PADDING * 2);

      setMenuPosition({
        top: openUpward ? undefined : rect.bottom + MENU_GAP,
        bottom: openUpward ? window.innerHeight - rect.top + MENU_GAP : undefined,
        left: Math.min(
          Math.max(VIEWPORT_PADDING, rect.left),
          window.innerWidth - width - VIEWPORT_PADDING
        ),
        width,
      });
    };

    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    updatePosition();
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [disablePortal, maxVisibleItems, open, options.length]);

  const menu =
    open && (disablePortal || menuPosition) ? (
      <div
        ref={menuRef}
        role="listbox"
        aria-labelledby={id}
        style={
          disablePortal
            ? undefined
            : {
                position: "fixed",
                top: menuPosition?.top,
                bottom: menuPosition?.bottom,
                left: menuPosition?.left,
                width: menuPosition?.width,
              }
        }
        className={cn(
          "z-[300] rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-600 dark:bg-slate-900",
          disablePortal && "absolute left-0 right-0 top-[calc(100%+4px)]",
          menuClassName
        )}
      >
        <div
          style={{ maxHeight: maxVisibleItems * ITEM_HEIGHT }}
          className="overflow-y-auto overscroll-contain"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              aria-disabled={option.disabled || undefined}
              disabled={option.disabled}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={cn(
                "flex h-9 w-full items-center rounded-lg px-3 text-left text-sm text-slate-700 transition-colors duration-150 hover:bg-sky-100 hover:text-sky-900 focus-visible:bg-sky-100 focus-visible:text-sky-900 focus-visible:outline-none dark:text-slate-200 dark:hover:bg-sky-500/20 dark:hover:text-sky-100 dark:focus-visible:bg-sky-500/20 dark:focus-visible:text-sky-100",
                option.disabled &&
                  "cursor-not-allowed text-slate-400 hover:bg-transparent dark:text-slate-500 dark:hover:bg-transparent",
                option.value === value &&
                  "bg-blue-100 font-medium text-blue-800 hover:bg-sky-200 dark:bg-blue-500/25 dark:text-blue-200 dark:hover:bg-sky-500/30"
              )}
            >
              <span className="truncate">{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <div className="relative">
      <button
        id={id}
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex w-full items-center justify-between gap-2 border border-slate-300 bg-white text-left text-slate-800 outline-none transition duration-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25",
          size === "compact"
            ? "min-h-8 rounded-lg px-2 py-1 text-xs"
            : "min-h-11 rounded-xl px-3 py-2 text-sm",
          disabled &&
            "cursor-not-allowed bg-slate-100 text-slate-500 opacity-70 dark:bg-slate-900/60 dark:text-slate-400",
          className
        )}
      >
        <span className={cn("truncate", !selectedLabel && "text-slate-400")}>
          {selectedLabel ?? placeholder}
        </span>
        <ChevronDown
          size={16}
          className={cn("shrink-0 text-slate-400 transition", open && "rotate-180")}
        />
      </button>

      {disablePortal
        ? menu
        : open && menuPosition && typeof document !== "undefined"
          ? createPortal(menu, document.body)
          : null}
    </div>
  );
}
