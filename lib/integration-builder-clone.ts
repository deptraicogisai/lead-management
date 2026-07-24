import { Types } from "mongoose";
import {
  DEFAULT_CONFIG_FIELDS,
  normalizeIntegrationPostModel,
  type IntegrationBuilderArrayMappingEntry,
  type IntegrationBuilderConfigField,
  type IntegrationBuilderRequestMapping,
  type IntegrationBuilderResponseMapping,
  type IntegrationBuilderStatus,
  type IntegrationPostModel,
} from "@/lib/integration-builder";

export type IntegrationBuilderCloneCreateData = {
  name: string;
  status: IntegrationBuilderStatus;
  postModel: IntegrationPostModel;
  verticalRef: Types.ObjectId;
  arrayMappings: IntegrationBuilderArrayMappingEntry[];
  requestMapping: IntegrationBuilderRequestMapping | undefined;
  pingRequestMapping: IntegrationBuilderRequestMapping | undefined;
  responseMapping: IntegrationBuilderResponseMapping | undefined;
  pingResponseMapping: IntegrationBuilderResponseMapping | undefined;
  configFields: IntegrationBuilderConfigField[];
};

type CloneableIntegrationBuilder = {
  status: IntegrationBuilderStatus;
  postModel?: string | null;
  verticalRef?: Types.ObjectId | { toString(): string } | string | null;
  arrayMappings?: unknown;
  requestMapping?: unknown;
  pingRequestMapping?: unknown;
  responseMapping?: unknown;
  pingResponseMapping?: unknown;
  configFields?: unknown;
};

function cloneValue<T>(value: T | null | undefined, fallback: T): T {
  if (value === null || value === undefined) {
    return fallback;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function resolveVerticalRef(verticalRef: CloneableIntegrationBuilder["verticalRef"]): Types.ObjectId {
  if (verticalRef instanceof Types.ObjectId) {
    return verticalRef;
  }

  if (verticalRef && typeof verticalRef === "object" && "toString" in verticalRef) {
    return new Types.ObjectId(verticalRef.toString());
  }

  if (typeof verticalRef === "string" && Types.ObjectId.isValid(verticalRef)) {
    return new Types.ObjectId(verticalRef);
  }

  throw new Error("Source record is missing a valid verticalRef.");
}

export function buildClonedIntegrationBuilderPayload(
  source: CloneableIntegrationBuilder,
  name: string
): IntegrationBuilderCloneCreateData {
  const postModel = normalizeIntegrationPostModel(source.postModel);
  return {
    name: name.trim(),
    status: source.status,
    postModel,
    verticalRef: resolveVerticalRef(source.verticalRef),
    arrayMappings: cloneValue(
      source.arrayMappings as IntegrationBuilderArrayMappingEntry[] | null | undefined,
      []
    ),
    requestMapping: cloneValue(
      source.requestMapping as IntegrationBuilderRequestMapping | null | undefined,
      undefined
    ),
    pingRequestMapping:
      postModel === "Ping Post"
        ? cloneValue(
            source.pingRequestMapping as IntegrationBuilderRequestMapping | null | undefined,
            undefined
          )
        : undefined,
    responseMapping: cloneValue(
      source.responseMapping as IntegrationBuilderResponseMapping | null | undefined,
      undefined
    ),
    pingResponseMapping:
      postModel === "Ping Post"
        ? cloneValue(
            source.pingResponseMapping as IntegrationBuilderResponseMapping | null | undefined,
            undefined
          )
        : undefined,
    configFields: cloneValue(
      source.configFields as IntegrationBuilderConfigField[] | null | undefined,
      DEFAULT_CONFIG_FIELDS.map((field) => ({ ...field }))
    ),
  };
}
