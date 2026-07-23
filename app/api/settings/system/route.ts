import { NextResponse } from "next/server";
import { getSystemSettings, updateSystemSettings } from "@/lib/system-settings";

export async function GET() {
  try {
    const settings = await getSystemSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Failed to load system settings:", error);
    return NextResponse.json({ message: "Failed to load system settings." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { testMode?: unknown } | null;
    if (!body || typeof body.testMode !== "boolean") {
      return NextResponse.json({ message: "testMode must be a boolean." }, { status: 400 });
    }

    const settings = await updateSystemSettings({ testMode: body.testMode });
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Failed to update system settings:", error);
    return NextResponse.json({ message: "Failed to update system settings." }, { status: 500 });
  }
}
