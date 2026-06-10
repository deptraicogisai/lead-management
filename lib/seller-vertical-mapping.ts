import { Types } from "mongoose";
import { VerticalModel } from "@/lib/models/industry";
import { SellerModel } from "@/lib/models/seller";
import { VerticalMappingModel } from "@/lib/models/vertical-mapping";
import {
  buildSeededMappingFields,
  mappingFieldsNeedSeeding,
  type MappingFieldSource,
  type VerticalFieldSource,
} from "@/lib/mapping-fields";

export async function findSellerVerticalMappingById(sellerId: string, mappingId: string) {
  if (!Types.ObjectId.isValid(sellerId) || !Types.ObjectId.isValid(mappingId)) {
    return null;
  }

  const seller = await SellerModel.findById(sellerId, { _id: 1 }).lean();
  if (!seller) {
    return null;
  }

  return VerticalMappingModel.findOne({
    _id: mappingId,
    sellerRef: seller._id,
  });
}

/** @deprecated Use findSellerVerticalMappingById when multiple APIs per seller+vertical are supported. */
export async function findSellerVerticalMapping(sellerId: string, verticalId: string) {
  if (!Types.ObjectId.isValid(sellerId) || !Types.ObjectId.isValid(verticalId)) {
    return null;
  }

  const seller = await SellerModel.findById(sellerId, { _id: 1 }).lean();
  if (!seller) {
    return null;
  }

  return VerticalMappingModel.findOne({
    sellerRef: seller._id,
    verticalRef: new Types.ObjectId(verticalId),
  });
}

export async function loadSellerVerticalFieldContextById(sellerId: string, mappingId: string) {
  const mapping = await findSellerVerticalMappingById(sellerId, mappingId);
  if (!mapping) {
    return null;
  }

  const vertical = mapping.verticalRef ? await VerticalModel.findById(mapping.verticalRef).lean() : null;
  if (!vertical) {
    return null;
  }

  const verticalFields = (vertical.fields as VerticalFieldSource[] | undefined) ?? [];
  const mappingFields = (mapping.fields as MappingFieldSource[] | undefined) ?? [];

  return { mapping, vertical, verticalFields, mappingFields };
}

export async function ensureSellerVerticalMappingFieldsSeededById(sellerId: string, mappingId: string) {
  const context = await loadSellerVerticalFieldContextById(sellerId, mappingId);
  if (!context) {
    return null;
  }

  const { mapping, verticalFields, mappingFields } = context;

  if (mappingFieldsNeedSeeding(mappingFields, verticalFields)) {
    const seededFields = buildSeededMappingFields(verticalFields, mappingFields);
    mapping.set("fields", seededFields);
    await mapping.save();
  }

  return {
    mapping,
    verticalFields,
    mappingFields: (mapping.fields as MappingFieldSource[] | undefined) ?? [],
  };
}

/** @deprecated Use ensureSellerVerticalMappingFieldsSeededById. */
export async function loadSellerVerticalFieldContext(sellerId: string, verticalId: string) {
  const mapping = await findSellerVerticalMapping(sellerId, verticalId);
  if (!mapping) {
    return null;
  }

  const vertical = mapping.verticalRef ? await VerticalModel.findById(mapping.verticalRef).lean() : null;
  if (!vertical) {
    return null;
  }

  const verticalFields = (vertical.fields as VerticalFieldSource[] | undefined) ?? [];
  const mappingFields = (mapping.fields as MappingFieldSource[] | undefined) ?? [];

  return { mapping, vertical, verticalFields, mappingFields };
}

/** @deprecated Use ensureSellerVerticalMappingFieldsSeededById. */
export async function ensureSellerVerticalMappingFieldsSeeded(sellerId: string, verticalId: string) {
  const context = await loadSellerVerticalFieldContext(sellerId, verticalId);
  if (!context) {
    return null;
  }

  const { mapping, verticalFields, mappingFields } = context;

  if (mappingFieldsNeedSeeding(mappingFields, verticalFields)) {
    const seededFields = buildSeededMappingFields(verticalFields, mappingFields);
    mapping.set("fields", seededFields);
    await mapping.save();
  }

  return {
    mapping,
    verticalFields,
    mappingFields: (mapping.fields as MappingFieldSource[] | undefined) ?? [],
  };
}
