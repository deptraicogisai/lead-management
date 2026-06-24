import { NextResponse } from "next/server";
import { clearDataCleanupTargets, getDataCleanupTargetCounts, resolveDataCleanupTargets } from "@/lib/data-cleanup";
import { connectToDatabase } from "@/lib/mongodb";

type ClearPayload = {
  targets?: string[];
};

export async function GET() {
  try {
    await connectToDatabase();
    const items = await getDataCleanupTargetCounts();

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Failed to load data cleanup settings:", error);
    return NextResponse.json({ message: "Failed to load data cleanup settings." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ClearPayload;
    const targets = Array.isArray(body.targets) ? body.targets : [];

    if (targets.length === 0) {
      return NextResponse.json({ message: "Select at least one list to clear." }, { status: 400 });
    }

    const resolvedTargets = resolveDataCleanupTargets(targets);
    if (resolvedTargets.length === 0) {
      return NextResponse.json({ message: "No valid lists were selected." }, { status: 400 });
    }

    await connectToDatabase();
    const results = await clearDataCleanupTargets(targets);
    const items = await getDataCleanupTargetCounts();

    return NextResponse.json({
      results,
      items,
      message: "Selected lists were cleared successfully.",
    });
  } catch (error) {
    console.error("Failed to clear selected lists:", error);
    return NextResponse.json({ message: "Failed to clear selected lists." }, { status: 500 });
  }
}
