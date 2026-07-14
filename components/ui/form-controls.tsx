import { Check, ChevronDown } from "lucide-react";
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import type { LucideIcon } from "lucide-react";
import { formatDecimalInputDisplayValue, sanitizeNumberInputValue } from "@/lib/decimal-input";
import { cn } from "@/lib/utils";
import {
  buttonLabelText,
  cancelIcon,
  childrenIncludeIcon,
  dangerIcon,
  IconText,
  inferPrimaryIcon,
  warningIcon,
} from "@/lib/button-icons";
import {
  buttonBaseClassName,
  cancelButtonClassName,
  compactPrimaryButtonClassName,
  dangerButtonClassName,
  paginationActiveClassName,
  paginationInactiveClassName,
  paginationNavButtonClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  tableActionButtonClassName,
  tableActionDangerButtonClassName,
  toolbarPrimaryButtonClassName,
  warningButtonClassName,
} from "@/lib/button-styles";

export {
  buttonBaseClassName,
  cancelButtonClassName,
  compactPrimaryButtonClassName,
  dangerButtonClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  toolbarPrimaryButtonClassName,
  warningButtonClassName,
  paginationActiveClassName,
  paginationInactiveClassName,
  paginationNavButtonClassName,
  tableActionButtonClassName,
  tableActionDangerButtonClassName,
} from "@/lib/button-styles";

const fieldControlClassName =
  "w-full rounded-xl border border-slate-300 bg-white text-sm text-slate-800 outline-none transition duration-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25";

const fieldControlDisabledClassName =
  "cursor-not-allowed bg-slate-100 text-slate-500 opacity-70 dark:bg-slate-900/60 dark:text-slate-400";

export function FormError({ error, className }: { error?: string; className?: string }) {
  if (!error) return null;

  return (
    <div
      role="alert"
      data-form-error="true"
      className={cn(
        "animate-field-error mb-2 rounded-lg border border-red-200 bg-red-100 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-200",
        className
      )}
    >
      {error}
    </div>
  );
}

const fieldInvalidClassName =
  "animate-field-invalid border-red-400 focus:border-red-500 focus:ring-red-100 dark:border-red-500/70 dark:focus:border-red-500 dark:focus:ring-red-500/25";

export function FieldLabel({
  htmlFor,
  label,
  required = false,
}: {
  htmlFor?: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
      {label}
      {required ? <span className="text-red-600 dark:text-red-400"> *</span> : null}
    </label>
  );
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function Input(
  { className, disabled, readOnly, tabIndex, invalid, type, onChange, value, lang, min, step, ...restProps },
  ref
) {
  const isDecimalNumberInput = type === "number";

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!onChange) {
      return;
    }

    if (isDecimalNumberInput) {
      const sanitized = sanitizeNumberInputValue(event.target.value, { step, min });
      if (sanitized === null) {
        event.target.value = String(value ?? "");
        return;
      }

      if (sanitized !== event.target.value) {
        event.target.value = sanitized;
      }
    }

    onChange(event);
  };

  return (
    <input
      ref={ref}
      type={isDecimalNumberInput ? "text" : type}
      inputMode={isDecimalNumberInput ? "decimal" : restProps.inputMode}
      lang={isDecimalNumberInput ? (lang ?? "en") : lang}
      min={min}
      step={step}
      disabled={disabled}
      readOnly={disabled ? true : readOnly}
      tabIndex={disabled ? -1 : tabIndex}
      aria-invalid={invalid || undefined}
      value={isDecimalNumberInput ? formatDecimalInputDisplayValue(value) : value}
      onChange={isDecimalNumberInput ? handleChange : onChange}
      {...restProps}
      className={cn(
        "w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition duration-200 dark:placeholder:text-slate-400",
        disabled
          ? "pointer-events-none cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500 caret-transparent selection:bg-transparent focus:border-slate-200 focus:ring-0 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400"
          : cn(
              fieldControlClassName,
              "focus:-translate-y-px",
              invalid && fieldInvalidClassName
            ),
        className
      )}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(function Select({ className, disabled, invalid, children, ...restProps }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        {...restProps}
        className={cn(
          fieldControlClassName,
          "appearance-none px-3 py-2.5 pr-10",
          disabled && fieldControlDisabledClassName,
          invalid && fieldInvalidClassName,
          className
        )}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
      />
    </div>
  );
});

type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
  id?: string;
  className?: string;
};

export function Checkbox({ checked, onChange, label, disabled, id, className }: CheckboxProps) {
  return (
    <button
      type="button"
      id={id}
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "group flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 dark:hover:bg-slate-800/60",
        disabled && "cursor-not-allowed opacity-60 hover:bg-transparent dark:hover:bg-transparent",
        className
      )}
    >
      <span
        className={cn(
          "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition duration-150",
          checked
            ? "border-emerald-700 bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600"
            : "border-slate-300 bg-white group-hover:border-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:group-hover:border-slate-500"
        )}
      >
        <Check
          size={13}
          strokeWidth={3}
          className={cn(
            "text-white transition duration-150",
            checked ? "scale-100 opacity-100" : "scale-75 opacity-0"
          )}
        />
      </span>
      <span className="text-sm text-slate-700 dark:text-slate-200">{label}</span>
    </button>
  );
}

export function PrimaryButton({
  children,
  icon,
  iconSize = 16,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: LucideIcon | false; iconSize?: number }) {
  const resolvedIcon =
    icon === false || childrenIncludeIcon(children)
      ? null
      : (icon ?? inferPrimaryIcon(buttonLabelText(children)));

  return (
    <button {...props} className={cn(primaryButtonClassName, className)}>
      {resolvedIcon ? (
        <IconText icon={resolvedIcon} size={iconSize}>
          {children}
        </IconText>
      ) : (
        children
      )}
    </button>
  );
}

export function SecondaryButton({
  children,
  icon,
  iconSize = 16,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: LucideIcon | false; iconSize?: number }) {
  const resolvedIcon = icon === false ? null : icon ?? null;

  return (
    <button {...props} className={cn(secondaryButtonClassName, className)}>
      {resolvedIcon ? (
        <IconText icon={resolvedIcon} size={iconSize}>
          {children}
        </IconText>
      ) : (
        children
      )}
    </button>
  );
}

export function CancelButton({
  children = "Cancel",
  icon = cancelIcon,
  iconSize = 16,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: LucideIcon | false; iconSize?: number }) {
  const resolvedIcon = icon === false || childrenIncludeIcon(children) ? null : icon;

  return (
    <button {...props} className={cn(cancelButtonClassName, className)}>
      {resolvedIcon ? (
        <IconText icon={resolvedIcon} size={iconSize}>
          {children}
        </IconText>
      ) : (
        children
      )}
    </button>
  );
}

export function DangerButton({
  children = "Delete",
  icon = dangerIcon,
  iconSize = 16,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: LucideIcon | false; iconSize?: number }) {
  const resolvedIcon = icon === false || childrenIncludeIcon(children) ? null : icon;

  return (
    <button {...props} className={cn(dangerButtonClassName, className)}>
      {resolvedIcon ? (
        <IconText icon={resolvedIcon} size={iconSize}>
          {children}
        </IconText>
      ) : (
        children
      )}
    </button>
  );
}

export function WarningButton({
  children,
  icon = warningIcon,
  iconSize = 16,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: LucideIcon | false; iconSize?: number }) {
  const resolvedIcon = icon === false || childrenIncludeIcon(children) ? null : icon;

  return (
    <button {...props} className={cn(warningButtonClassName, className)}>
      {resolvedIcon ? (
        <IconText icon={resolvedIcon} size={iconSize}>
          {children}
        </IconText>
      ) : (
        children
      )}
    </button>
  );
}

type ToggleSwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  onLabel?: string;
  offLabel?: string;
};

export function ToggleSwitch({
  checked,
  onChange,
  disabled,
  id,
  onLabel = "On",
  offLabel = "Off",
}: ToggleSwitchProps) {
  const usesCustomLabels = onLabel !== "On" || offLabel !== "Off";

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-200",
        "shadow-inner focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30",
        "disabled:cursor-not-allowed disabled:opacity-55",
        usesCustomLabels ? "h-7 w-[5.1rem] px-0.5" : "h-8 w-[4.5rem] p-0.5",
        checked
          ? "border-emerald-600/40 bg-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-600"
          : "border-slate-300 bg-slate-300 dark:border-slate-600 dark:bg-slate-600"
      )}
    >
      <span
        className={cn(
          "absolute font-semibold uppercase tracking-wide transition-opacity duration-200",
          usesCustomLabels ? "text-[9px]" : "text-[10px] font-bold",
          checked ? "left-1.5 text-white opacity-100" : "opacity-0"
        )}
      >
        {onLabel}
      </span>
      <span
        className={cn(
          "absolute font-semibold uppercase tracking-wide transition-opacity duration-200",
          usesCustomLabels ? "text-[9px]" : "text-[10px] font-bold",
          checked ? "opacity-0" : "right-1.5 text-slate-700 opacity-100 dark:text-slate-100"
        )}
      >
        {offLabel}
      </span>
      <span
        className={cn(
          "pointer-events-none absolute top-0.5 flex items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-200 ease-out dark:ring-white/10",
          usesCustomLabels ? "h-[22px] w-[22px]" : "h-7 w-7",
          checked
            ? usesCustomLabels
              ? "translate-x-[3.2rem]"
              : "translate-x-[2.35rem]"
            : "translate-x-0"
        )}
      >
        {checked ? (
          <svg
            viewBox="0 0 12 12"
            className={cn(usesCustomLabels ? "h-3 w-3" : "h-3.5 w-3.5", "text-emerald-600")}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
          >
            <path d="M2.5 6.2l2.4 2.4 4.6-4.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500" />
        )}
      </span>
    </button>
  );
}
