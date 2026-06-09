import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated } from "@/lib/models/industry";
import { parseVerticalFieldImport } from "@/lib/vertical-field";
import { isValidVerticalId } from "@/lib/vertical-db";
import { importVerticalFields } from "@/lib/vertical-field-import";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: Params) {
  try {
    const { id } = await context.params;

    if (!isValidVerticalId(id)) {
      return NextResponse.json({ message: "Invalid vertical id." }, { status: 400 });
    }

    const payload = (await req.json()) as unknown;
    const parsed = parseVerticalFieldImport(payload);

    if ("error" in parsed) {
      return NextResponse.json({ message: parsed.error }, { status: 400 });
    }

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();

    return importVerticalFields(id, parsed.fields);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to import vertical fields.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
