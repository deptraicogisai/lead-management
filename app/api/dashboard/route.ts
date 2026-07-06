import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, decodeAuthSession } from "@/lib/auth";
import { buildDashboardSnapshot } from "@/lib/dashboard-server";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = decodeAuthSession(cookieStore.get(AUTH_COOKIE_NAME)?.value);
    const layoutName = session?.name ?? "Default";

    const snapshot = await buildDashboardSnapshot(layoutName);
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("Failed to fetch dashboard:", error);
    return NextResponse.json({ message: "Failed to fetch dashboard." }, { status: 500 });
  }
}
