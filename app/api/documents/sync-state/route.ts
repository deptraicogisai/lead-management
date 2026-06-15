import { NextResponse } from "next/server";
import { markDocumentsInitialSyncAttempted } from "@/lib/models/phonexa-sync-state";
import { connectToDatabase } from "@/lib/mongodb";

export async function POST() {
  try {
    await connectToDatabase();
    await markDocumentsInitialSyncAttempted();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to update sync state." },
      { status: 500 }
    );
  }
}
