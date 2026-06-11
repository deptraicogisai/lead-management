import { Check, ChevronDown } from "lucide-react";
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

const fieldControlClassName =
  "w-full rounded-xl border border-slate-300 bg-white text-sm text-slate-800 outline-none transition duration-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25";

const fieldControlDisabledClassName =
  "cursor-not-allowed bg-slate-100 text-slate-500 opacity-70 dark:bg-slate-900/60 dark:text-slate-400";

export function FormError({ error }: { error?: string }) {
  if (!error) return null;

  return <p className="mt-1 text-xs text-red-600 dark:text-red-300">{error}</p>;
}

export function FieldLabel({ htmlFor, label }: { htmlFor: string; label: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
      {label}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, disabled, readOnly, tabIndex, ...restProps },
  ref
) {
  return (
    <input
      ref={ref}
      disabled={disabled}
      readOnly={disabled ? true : readOnly}
      tabIndex={disabled ? -1 : tabIndex}
      {...restProps}
      className={cn(
        "w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition duration-200 dark:placeholder:text-slate-400",
        disabled
          ? "pointer-events-none cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500 caret-transparent selection:bg-transparent focus:border-slate-200 focus:ring-0 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400"
          : cn(
              fieldControlClassName,
              "focus:-translate-y-px"
            ),
        className
      )}
    />
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, disabled, children, ...restProps },
  ref
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        disabled={disabled}
        {...restProps}
        className={cn(
          fieldControlClassName,
          "appearance-none px-3 py-2.5 pr-10",
          disabled && fieldControlDisabledClassName,
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

export function PrimaryButton({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className, ...restProps } = props;

  return (
    <button
      {...restProps}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-blue-300 disabled:hover:translate-y-0 disabled:hover:shadow-sm dark:bg-blue-500 dark:text-white dark:hover:bg-blue-400 dark:disabled:bg-slate-700 dark:disabled:text-slate-400",
        className
      )}
    >
      {children}
    </button>
  );
}

type ToggleSwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
};

export function ToggleSwitch({ checked, onChange, disabled, id }: ToggleSwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-8 w-[4.25rem] shrink-0 cursor-pointer items-center rounded-full border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60",
        checked
          ? "border-emerald-700 bg-emerald-800 dark:border-emerald-500 dark:bg-emerald-700"
          : "border-slate-300 bg-slate-200 dark:border-slate-600 dark:bg-slate-700"
      )}
    >
      <span
        className={cn(
          "absolute text-[10px] font-bold uppercase tracking-wide transition-opacity duration-200",
          checked ? "left-2.5 text-white opacity-100" : "opacity-0"
        )}
      >
        On
      </span>
      <span
        className={cn(
          "absolute text-[10px] font-bold uppercase tracking-wide transition-opacity duration-200",
          !checked ? "right-2 text-slate-600 opacity-100 dark:text-slate-300" : "opacity-0"
        )}
      >
        Off
      </span>
      <span
        className={cn(
          "absolute left-0.5 top-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-sm transition-transform duration-200",
          checked ? "translate-x-[2.125rem]" : "translate-x-0"
        )}
      >
        {checked ? (
          <svg viewBox="0 0 12 12" className="h-3.5 w-3.5 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </span>
    </button>
  );
}
