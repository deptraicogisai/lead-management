import type { ButtonHTMLAttributes, InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

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

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...restProps } = props;

  return (
    <input
      {...restProps}
      className={cn(
        "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition duration-200 focus:-translate-y-px focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:placeholder:text-slate-400 dark:focus:border-blue-400 dark:focus:ring-blue-400/25",
        className
      )}
    />
  );
}

export function PrimaryButton({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className, ...restProps } = props;

  return (
    <button
      {...restProps}
      className={cn(
        "rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-blue-300 disabled:hover:translate-y-0 disabled:hover:shadow-sm dark:bg-blue-500 dark:text-white dark:hover:bg-blue-400 dark:disabled:bg-slate-700 dark:disabled:text-slate-400",
        className
      )}
    >
      {children}
    </button>
  );
}
