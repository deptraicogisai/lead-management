import { NextResponse } from "next/server";
import { processDueDelayedSilentPosts } from "@/lib/delayed-silent-post";

/**
 * Flush due Delay Posting Silent deliveries.
 * Call from an external scheduler (e.g. every minute) or manually.
 */
export async function GET() {
  try {
    const result = await processDueDelayedSilentPosts();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process delayed posts.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}
