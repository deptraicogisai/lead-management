import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { AUTH_COOKIE_NAME, decodeAuthSession } from "@/lib/auth";
import { buildLoginPath } from "@/lib/auth-return-url";
import type { ReactNode } from "react";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const session = decodeAuthSession(cookieStore.get(AUTH_COOKIE_NAME)?.value);

  if (!session) {
    const headerStore = await headers();
    const returnPath = headerStore.get("x-pathname");
    redirect(buildLoginPath(returnPath));
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <DashboardShell session={session}>{children}</DashboardShell>
    </div>
  );
}
