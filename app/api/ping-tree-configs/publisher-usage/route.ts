import { NextResponse } from "next/server";
import { findPublisherUsagesByConfigIds } from "@/lib/publisher-distribution-service";
import { connectToDatabase } from "@/lib/mongodb";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const configIds = (searchParams.get("configIds") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (configIds.length === 0) {
      return NextResponse.json({ message: "At least one config id is required." }, { status: 400 });
    }

    await connectToDatabase();
    const usages = await findPublisherUsagesByConfigIds(configIds);
    return NextResponse.json(usages);
  } catch {
    return NextResponse.json({ message: "Failed to load publisher distribution usage." }, { status: 500 });
  }
}
