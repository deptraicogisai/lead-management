import { Types } from "mongoose";
import { VerticalModel } from "@/lib/models/industry";

export function isValidVerticalId(id: string) {
  return Types.ObjectId.isValid(id);
}

export async function findVerticalById(id: string) {
  if (!isValidVerticalId(id)) {
    return null;
  }

  return VerticalModel.findById(id);
}

export async function findVerticalByIdLean(id: string) {
  if (!isValidVerticalId(id)) {
    return null;
  }

  return VerticalModel.findById(id).lean();
}
