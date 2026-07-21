import { Types } from "mongoose";
import { VerticalMappingModel } from "@/lib/models/vertical-mapping";
import { normalizeMappingApiType, type MappingApiType } from "@/lib/mapping-api-type";

export async function loadMappingApiTypeByIds(
  mappingIds: Iterable<string>
): Promise<Map<string, MappingApiType>> {
  const ids = [
    ...new Set(
      [...mappingIds].filter((id) => id && Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id))
    ),
  ];
  if (ids.length === 0) {
    return new Map();
  }

  const mappings = await VerticalMappingModel.find({ _id: { $in: ids } })
    .select({ apiType: 1 })
    .lean();

  return new Map(
    mappings.map((mapping) => [mapping._id.toString(), normalizeMappingApiType(mapping.apiType)])
  );
}
