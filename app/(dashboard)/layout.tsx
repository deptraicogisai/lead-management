import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { AUTH_COOKIE_NAME, decodeAuthSession } from "@/lib/auth";
import type { ReactNode } from "react";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const session = decodeAuthSession(cookieStore.get(AUTH_COOKIE_NAME)?.value);

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <Sidebar />
      <main className="min-h-screen pl-0 md:pl-64">
        <div className="p-4 md:p-6">
          <Header session={session} />
          {children}
        </div>
      </main>
    </div>
  );
}
