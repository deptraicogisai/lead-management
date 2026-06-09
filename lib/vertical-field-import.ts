import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { VerticalModel } from "@/lib/models/industry";
import type { VerticalFieldRecord } from "@/lib/vertical-field";

type ImportField = Omit<VerticalFieldRecord, "id">;

export async function importVerticalFields(id: string, fields: ImportField[]) {
  const importedFields = fields.map((field) => ({
    _id: new Types.ObjectId(),
    fieldName: field.fieldName,
    description: field.description,
    type: field.type,
    required: field.required ?? false,
    format: field.format,
    emailDuplicateRule: field.emailDuplicateRule,
    ignoreValues: field.ignoreValues ?? [],
    displayArrayMapping: field.displayArrayMapping,
    dataTypeFilter: field.dataTypeFilter ?? null,
    options: field.options,
  }));

  const updated = await VerticalModel.findByIdAndUpdate(
    id,
    { $set: { fields: importedFields } },
    { new: true }
  ).lean();

  if (!updated) {
    return NextResponse.json({ message: "Vertical not found." }, { status: 404 });
  }

  return NextResponse.json({
    message: "Fields imported successfully.",
    count: updated.fields?.length ?? importedFields.length,
  });
}
