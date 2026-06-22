import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { buildClonedIntegrationBuilderPayload } from "@/lib/integration-builder-clone";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import { IntegrationBuilderModel } from "@/lib/models/integration-builder";
import { buildVerticalIndexMap, toIntegrationBuilderRecord } from "@/lib/integration-builder";
import { connectToDatabase } from "@/lib/mongodb";

type Params = { params: Promise<{ id: string }> };

async function getVerticalMaps() {
  const verticals = await VerticalModel.find().sort({ createdAt: 1 }).select({ _id: 1, name: 1 }).lean();
  const verticalIds = verticals.map((vertical) => vertical._id.toString());
  const verticalNameById = new Map(verticals.map((vertical) => [vertical._id.toString(), vertical.name]));
  const verticalIndexById = buildVerticalIndexMap(verticalIds);

  return { verticalNameById, verticalIndexById };
}

export async function POST(req: Request, context: Params) {
  try {
    const { id } = await context.params;
    const body = (await req.json()) as { name?: string };

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid integration builder id." }, { status: 400 });
    }

    if (!body.name?.trim()) {
      return NextResponse.json({ message: "Name is required." }, { status: 400 });
    }

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();

    const source = await IntegrationBuilderModel.findById(id);
    if (!source) {
      return NextResponse.json({ message: "Integration builder record not found." }, { status: 404 });
    }

    const latest = await IntegrationBuilderModel.findOne().sort({ displayId: -1 }).select({ displayId: 1 }).lean();
    const nextDisplayId = (latest?.displayId ?? 0) + 1;

    const cloned = await IntegrationBuilderModel.create({
      displayId: nextDisplayId,
      ...buildClonedIntegrationBuilderPayload(source, body.name),
    });

    const { verticalNameById, verticalIndexById } = await getVerticalMaps();

    return NextResponse.json(
      toIntegrationBuilderRecord(cloned.toObject(), verticalNameById, verticalIndexById),
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ message: "Failed to clone integration builder record." }, { status: 500 });
  }
}
