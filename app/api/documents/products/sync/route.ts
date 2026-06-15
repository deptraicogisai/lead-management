import { NextResponse } from "next/server";
import { syncAllPhonexaProducts } from "@/lib/phonexa-products";

export async function POST() {
  try {
    const result = await syncAllPhonexaProducts();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to sync product documentation." },
      { status: 500 }
    );
  }
}
