import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { PingTreeConfigModel } from "@/lib/models/ping-tree-config";

type ConfigPercentPayload = {
  percentages?: Record<string, number>;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ConfigPercentPayload;
    const entries = Object.entries(body.percentages ?? {});

    if (entries.length === 0) {
      return NextResponse.json({ message: "No percentages provided." }, { status: 400 });
    }

    let total = 0;
    for (const [treeId, rawValue] of entries) {
      if (!Types.ObjectId.isValid(treeId)) {
        return NextResponse.json({ message: "Invalid ping tree id." }, { status: 400 });
      }
      const value = Number(rawValue);
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        return NextResponse.json(
          { message: "Each percentage must be between 0 and 100." },
          { status: 400 }
        );
      }
      total += value;
    }

    if (Math.abs(total - 100) > 0.001) {
      return NextResponse.json(
        { message: `Total percent is ${total}%. The total for all trees must equal 100%.` },
        { status: 400 }
      );
    }

    await connectToDatabase();

    await Promise.all(
      entries.map(([treeId, value]) =>
        PingTreeConfigModel.updateOne({ _id: treeId }, { $set: { percent: Number(value) } })
      )
    );

    return NextResponse.json({ message: "Percentages updated.", total });
  } catch {
    return NextResponse.json({ message: "Failed to update percentages." }, { status: 500 });
  }
}
