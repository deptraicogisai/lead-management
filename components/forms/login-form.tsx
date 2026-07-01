"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { FormError, Input, PrimaryButton } from "@/components/ui/form-controls";
import { resolvePostLoginPath } from "@/lib/auth-return-url";

type LoginErrors = {
  identifier?: string;
  password?: string;
  general?: string;
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl");
  const [identifier, setIdentifier] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return window.localStorage.getItem("lead-management:last-login-identifier") ?? "";
  });
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>({});

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: LoginErrors = {};

    if (!identifier.trim()) {
      nextErrors.identifier = "Username or email is required.";
    }

    if (!password.trim()) {
      nextErrors.password = "Password is required.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
        }),
      });

      const contentType = response.headers.get("content-type") ?? "";
      const payload = contentType.includes("application/json")
        ? ((await response.json().catch(() => null)) as { message?: string } | null)
        : null;

      if (!response.ok) {
        setErrors({
          general:
            payload?.message ??
            (response.status === 404
              ? "Sign-in service is unavailable. Restart the dev server and try again."
              : "Unable to sign in with the provided credentials."),
        });
        return;
      }

      if (rememberMe) {
        window.localStorage.setItem("lead-management:last-login-identifier", identifier.trim());
      } else {
        window.localStorage.removeItem("lead-management:last-login-identifier");
      }

      router.replace(resolvePostLoginPath(returnUrl));
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="login-identifier" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          Email or username
        </label>
        <FormError error={errors.identifier} />
        <Input
          id="login-identifier"
          autoComplete="username"
          value={identifier}
          invalid={Boolean(errors.identifier)}
          onChange={(event) => setIdentifier(event.target.value)}
          placeholder="Enter your email or username"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Password
          </label>
          <span className="text-xs font-medium text-slate-400 dark:text-slate-300">Secure access</span>
        </div>

        <FormError error={errors.password} />
        <div className="relative">
          <Input
            id="login-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            invalid={Boolean(errors.password)}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            className="pr-11"
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 transition hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-200">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-blue-400"
          />
          Remember me
        </label>
        <span className="text-sm font-medium text-slate-400 dark:text-slate-300">Internal access</span>
      </div>

      <FormError error={errors.general} />

      <PrimaryButton type="submit" disabled={isSubmitting} className="w-full justify-center">
        {isSubmitting ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 size={16} className="animate-spin" />
            Signing in...
          </span>
        ) : (
          "Sign In"
        )}
      </PrimaryButton>
    </form>
  );
}
