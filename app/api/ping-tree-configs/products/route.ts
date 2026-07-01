import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated } from "@/lib/models/industry";
import { listActivePingTreeProducts } from "@/lib/ping-tree-config-products";

export async function GET() {
  try {
    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    const products = await listActivePingTreeProducts();
    return NextResponse.json(products);
  } catch {
    return NextResponse.json({ message: "Failed to fetch products." }, { status: 500 });
  }
}
