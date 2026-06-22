import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureSellerCollectionMigrated, SellerModel } from "@/lib/models/seller";
import { normalizePublisherTag } from "@/lib/publisher-tag";

export async function GET() {
  try {
    await connectToDatabase();
    await ensureSellerCollectionMigrated();

    const rawTags = await SellerModel.distinct("publisherTag", {
      publisherTag: { $exists: true, $nin: [null, ""] },
    });

    const tags = [...new Set(rawTags.map((tag) => normalizePublisherTag(String(tag))).filter(Boolean))].sort(
      (left, right) => left.localeCompare(right, undefined, { sensitivity: "base" })
    );

    return NextResponse.json({ tags });
  } catch {
    return NextResponse.json({ message: "Failed to fetch publisher tags." }, { status: 500 });
  }
}
