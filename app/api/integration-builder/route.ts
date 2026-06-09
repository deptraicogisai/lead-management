import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import { IntegrationBuilderModel } from "@/lib/models/integration-builder";
import {
  buildVerticalIndexMap,
  toIntegrationBuilderRecord,
  type IntegrationBuilderPostingType,
  type IntegrationBuilderStatus,
} from "@/lib/integration-builder";

type IntegrationBuilderPayload = {
  name?: string;
  verticalId?: string;
  status?: IntegrationBuilderStatus;
  postingType?: IntegrationBuilderPostingType;
};

type IntegrationBuilderDoc = {
  _id?: { toString(): string };
  displayId: number;
  name: string;
  status: IntegrationBuilderStatus;
  postingType: IntegrationBuilderPostingType;
  verticalRef?: { toString(): string } | string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

async function getVerticalMaps() {
  const verticals = await VerticalModel.find().sort({ createdAt: 1 }).select({ _id: 1, name: 1 }).lean();
  const verticalIds = verticals.map((vertical) => vertical._id.toString());
  const verticalNameById = new Map(verticals.map((vertical) => [vertical._id.toString(), vertical.name]));
  const verticalIndexById = buildVerticalIndexMap(verticalIds);

  return { verticalNameById, verticalIndexById };
}

export async function GET() {
  try {
    await connectToDatabase();
    await ensureVerticalCollectionMigrated();

    const [records, { verticalNameById, verticalIndexById }] = await Promise.all([
      IntegrationBuilderModel.find().sort({ createdAt: -1 }).lean(),
      getVerticalMaps(),
    ]);

    return NextResponse.json(
      (records as IntegrationBuilderDoc[]).map((record) =>
        toIntegrationBuilderRecord(record, verticalNameById, verticalIndexById)
      )
    );
  } catch {
    return NextResponse.json({ message: "Failed to fetch integration builder records." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as IntegrationBuilderPayload;

    if (!body.name?.trim()) {
      return NextResponse.json({ message: "Name is required." }, { status: 400 });
    }

    if (!body.verticalId?.trim() || !Types.ObjectId.isValid(body.verticalId.trim())) {
      return NextResponse.json({ message: "A valid vertical is required." }, { status: 400 });
    }

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();

    const vertical = await VerticalModel.findById(body.verticalId.trim(), { name: 1 }).lean();
    if (!vertical) {
      return NextResponse.json({ message: "Selected vertical was not found." }, { status: 404 });
    }

    const latest = await IntegrationBuilderModel.findOne().sort({ displayId: -1 }).select({ displayId: 1 }).lean();
    const nextDisplayId = (latest?.displayId ?? 0) + 1;

    const record = await IntegrationBuilderModel.create({
      displayId: nextDisplayId,
      name: body.name.trim(),
      status: body.status ?? "Active",
      postingType: body.postingType ?? "Direct Post",
      verticalRef: body.verticalId.trim(),
    });

    const { verticalNameById, verticalIndexById } = await getVerticalMaps();

    return NextResponse.json(
      toIntegrationBuilderRecord(record.toObject() as IntegrationBuilderDoc, verticalNameById, verticalIndexById),
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ message: "Failed to create integration builder record." }, { status: 500 });
  }
}
