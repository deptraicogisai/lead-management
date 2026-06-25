import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import { ensureIntegrationBuilderStatusMigrated, IntegrationBuilderModel } from "@/lib/models/integration-builder";
import {
  DEFAULT_CONFIG_FIELDS,
  buildVerticalIndexMap,
  toIntegrationBuilderRecord,
  type IntegrationBuilderStatus,
} from "@/lib/integration-builder";
import type { IntegrationBuilderExportPayload } from "@/lib/integration-builder-export";
import {
  buildIntegrationBuilderImportCreateData,
  buildIntegrationBuilderImportName,
  parseIntegrationBuilderImportSchema,
  resolveImportVerticalId,
} from "@/lib/integration-builder-import";
import { sortNewestDisplayIdFirst } from "@/lib/list-sort";

type IntegrationBuilderPayload = {
  name?: string;
  verticalId?: string;
  status?: IntegrationBuilderStatus;
  createType?: "new" | "import";
  importSchema?: IntegrationBuilderExportPayload;
};

type IntegrationBuilderDoc = {
  _id?: { toString(): string };
  displayId: number;
  name: string;
  status: IntegrationBuilderStatus;
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
    await ensureIntegrationBuilderStatusMigrated();

    const [records, { verticalNameById, verticalIndexById }] = await Promise.all([
      IntegrationBuilderModel.find().sort(sortNewestDisplayIdFirst).lean(),
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
    const isImport = body.createType === "import";

    if (!isImport) {
      if (!body.name?.trim()) {
        return NextResponse.json({ message: "Name is required." }, { status: 400 });
      }

      if (!body.verticalId?.trim() || !Types.ObjectId.isValid(body.verticalId.trim())) {
        return NextResponse.json({ message: "A valid vertical is required." }, { status: 400 });
      }
    }

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();

    const verticals = await VerticalModel.find().sort({ createdAt: 1 }).select({ _id: 1, name: 1 }).lean();
    const verticalIdsOldestFirst = verticals.map((vertical) => vertical._id.toString());

    let importName = "";
    let importVerticalId = "";

    if (isImport) {
      if (!body.importSchema) {
        return NextResponse.json({ message: "Import schema is required." }, { status: 400 });
      }

      const parsed = parseIntegrationBuilderImportSchema(body.importSchema);
      if (!parsed.ok) {
        return NextResponse.json({ message: parsed.message }, { status: 400 });
      }

      importName = buildIntegrationBuilderImportName(
        parsed.schema.name,
        (await IntegrationBuilderModel.find().select({ name: 1 }).lean()).map((record) => record.name)
      );
      importVerticalId = resolveImportVerticalId(parsed.schema.productId, verticalIdsOldestFirst) ?? "";

      if (!importVerticalId || !Types.ObjectId.isValid(importVerticalId)) {
        return NextResponse.json(
          { message: `Product with id ${parsed.schema.productId} was not found.` },
          { status: 400 }
        );
      }
    } else {
      importVerticalId = body.verticalId!.trim();
    }

    const vertical = await VerticalModel.findById(importVerticalId, { name: 1 }).lean();
    if (!vertical) {
      return NextResponse.json({ message: "Selected vertical was not found." }, { status: 404 });
    }

    const latest = await IntegrationBuilderModel.findOne().sort({ displayId: -1 }).select({ displayId: 1 }).lean();
    const nextDisplayId = (latest?.displayId ?? 0) + 1;

    let recordData: Record<string, unknown>;

    if (isImport) {
      const parsed = parseIntegrationBuilderImportSchema(body.importSchema!);
      if (!parsed.ok) {
        return NextResponse.json({ message: parsed.message }, { status: 400 });
      }

      recordData = {
        displayId: nextDisplayId,
        name: importName,
        status: body.status ?? "Active",
        verticalRef: importVerticalId,
        ...buildIntegrationBuilderImportCreateData(parsed.schema),
      };
    } else {
      recordData = {
        displayId: nextDisplayId,
        name: body.name!.trim(),
        status: body.status ?? "Active",
        verticalRef: importVerticalId,
        configFields: DEFAULT_CONFIG_FIELDS.map((field) => ({ ...field })),
      };
    }

    const record = await IntegrationBuilderModel.create(recordData);

    const { verticalNameById, verticalIndexById } = await getVerticalMaps();

    return NextResponse.json(
      toIntegrationBuilderRecord(record.toObject() as IntegrationBuilderDoc, verticalNameById, verticalIndexById),
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ message: "Failed to create integration builder record." }, { status: 500 });
  }
}
