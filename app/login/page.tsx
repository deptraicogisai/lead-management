import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ShieldCheck, Workflow, Zap } from "lucide-react";
import { LoginBrandMark } from "@/components/branding/login-brand-mark";
import { LoginFontScaleGuard } from "@/components/branding/login-font-scale-guard";
import { LoginForm } from "@/components/forms/login-form";
import { AUTH_COOKIE_NAME, decodeAuthSession } from "@/lib/auth";
import { resolvePostLoginPath } from "@/lib/auth-return-url";

const highlightDelayClasses = [
  "login-animate-delay-3",
  "login-animate-delay-4",
  "login-animate-delay-5",
] as const;

const highlights = [
  {
    title: "Lead routing visibility",
    description: "Monitor buyers, sellers, distributions, and delivery performance from one place.",
    icon: Workflow,
  },
  {
    title: "Secure admin access",
    description: "Keep operational controls behind a dedicated entry point for your internal team.",
    icon: ShieldCheck,
  },
  {
    title: "Faster daily operations",
    description: "Jump back into approvals, mappings, and logs without extra setup every session.",
    icon: Zap,
  },
];

export const metadata: Metadata = {
  title: "Login | Lead Management SaaS",
  description: "Sign in to access the lead management dashboard.",
};

type LoginPageProps = {
  searchParams: Promise<{ returnUrl?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const cookieStore = await cookies();
  const session = decodeAuthSession(cookieStore.get(AUTH_COOKIE_NAME)?.value);
  const params = await searchParams;

  if (session) {
    redirect(resolvePostLoginPath(params.returnUrl));
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-slate-950 px-3 py-4 dark:bg-slate-950 sm:px-6 sm:py-8 lg:px-8">
      <LoginFontScaleGuard />
      <div className="login-animate-shell mx-auto grid w-full max-w-6xl overflow-hidden rounded-[24px] border border-slate-800 bg-white shadow-2xl sm:rounded-[32px] dark:border-slate-700 dark:bg-slate-900 lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-[1.15fr_0.85fr]">
        <section className="relative hidden flex-col justify-between bg-gradient-to-br from-slate-950 via-slate-900 to-blue-900 p-8 text-white lg:flex sm:p-10 lg:p-12">
          <div>
            <p className="login-animate-item text-sm font-semibold uppercase tracking-[0.35em] text-blue-200">
              Lead Management
            </p>
            <h1 className="login-animate-item login-animate-delay-1 mt-6 max-w-lg text-4xl font-semibold tracking-tight sm:text-5xl">
              Centralize every lead workflow in one dashboard.
            </h1>
            <p className="login-animate-item login-animate-delay-2 mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
              Sign in to manage sellers, buyers, vertical mappings, and distribution logs with a clean internal admin experience.
            </p>
          </div>

          <div className="mt-10 grid gap-4">
            {highlights.map(({ title, description, icon: Icon }, index) => (
              <div
                key={title}
                className={`login-animate-item rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm ${highlightDelayClasses[index]}`}
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-blue-400/15 p-2 text-blue-200">
                    <Icon size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-white">{title}</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-300">{description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center bg-white px-5 py-6 dark:bg-slate-900 sm:p-8 lg:p-10">
          <div className="w-full max-w-md">
            <LoginBrandMark className="login-animate-item mb-5 sm:mb-8 lg:mb-10" />

            <div className="login-animate-item login-animate-delay-2 mb-6 text-center sm:mb-8 sm:text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600 sm:text-sm">Welcome back</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:mt-3 sm:text-3xl dark:text-slate-100">
                Sign in to your account
              </h2>
              <p className="mt-2 hidden text-sm leading-6 text-slate-500 sm:mt-3 sm:block dark:text-slate-300">
                Use the credentials configured in the `login` collection to access the admin dashboard.
              </p>
            </div>

            <div className="login-animate-item login-animate-delay-3">
              <Suspense fallback={null}>
                <LoginForm />
              </Suspense>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

