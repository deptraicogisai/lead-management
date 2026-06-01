import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ShieldCheck, Workflow, Zap } from "lucide-react";
import { LoginForm } from "@/components/forms/login-form";
import { AUTH_COOKIE_NAME, decodeAuthSession } from "@/lib/auth";

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

export default async function LoginPage() {
  const cookieStore = await cookies();
  const session = decodeAuthSession(cookieStore.get(AUTH_COOKIE_NAME)?.value);

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 dark:bg-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-[32px] border border-slate-800 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="relative flex flex-col justify-between bg-gradient-to-br from-slate-950 via-slate-900 to-blue-900 p-8 text-white sm:p-10 lg:p-12">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-blue-200">Lead Management</p>
            <h1 className="mt-6 max-w-lg text-4xl font-semibold tracking-tight sm:text-5xl">
              Centralize every lead workflow in one dashboard.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
              Sign in to manage sellers, buyers, vertical mappings, and distribution logs with a clean internal admin experience.
            </p>
          </div>

          <div className="mt-10 grid gap-4">
            {highlights.map(({ title, description, icon: Icon }) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
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

        <section className="flex items-center justify-center bg-white p-6 dark:bg-slate-900 sm:p-10">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Welcome back</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Sign in to your account</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-300">
                Use the credentials configured in the `login` collection to access the admin dashboard.
              </p>
            </div>

            <LoginForm />
          </div>
        </section>
      </div>
    </main>
  );
}
