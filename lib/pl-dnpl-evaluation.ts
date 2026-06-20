import { Types } from "mongoose";
import { PresentListModel } from "@/lib/models/present-list";

export type PlDnplEvaluationResult = {
  blocked: boolean;
  reasons: string[];
};

export function normalizePlDnplValue(value: unknown) {
  if (value === undefined || value === null) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value).trim().toLowerCase();
  }
  return String(value).trim().toLowerCase();
}

export function resolvePayloadFieldValue(payload: Record<string, unknown>, fieldName: string) {
  const trimmedFieldName = fieldName.trim();
  if (!trimmedFieldName) {
    return { raw: undefined as unknown, normalized: "" };
  }

  if (Object.prototype.hasOwnProperty.call(payload, trimmedFieldName)) {
    const raw = payload[trimmedFieldName];
    return { raw, normalized: normalizePlDnplValue(raw) };
  }

  const targetField = trimmedFieldName.toLowerCase();
  for (const [key, value] of Object.entries(payload)) {
    if (key.trim().toLowerCase() === targetField) {
      return { raw: value, normalized: normalizePlDnplValue(value) };
    }
  }

  return { raw: undefined as unknown, normalized: "" };
}

export function resolveEffectivePlDnplListIds(buyerPlDnplListIds: string[], campaignPlDnplListIds: string[]) {
  if (buyerPlDnplListIds.length > 0) {
    return buyerPlDnplListIds;
  }
  return campaignPlDnplListIds;
}

function getActiveListValues(
  values: Array<{ value?: string | null; expirationDate?: Date | string | null }> | undefined,
  now: number
) {
  return (values ?? [])
    .filter((entry) => {
      if (!entry.expirationDate) return true;
      return new Date(entry.expirationDate).getTime() >= now;
    })
    .map((entry) => normalizePlDnplValue(entry.value))
    .filter(Boolean);
}

function formatLeadValueForMessage(raw: unknown) {
  if (raw === undefined || raw === null || raw === "") {
    return "(empty)";
  }
  return String(raw);
}

export function evaluatePlDnplListRule(params: {
  listName: string;
  listType: "PL" | "DNPL";
  applyToField: string;
  leadRawValue: unknown;
  leadNormalizedValue: string;
  activeValues: string[];
}): string | null {
  const displayValue = formatLeadValueForMessage(params.leadRawValue);

  if (params.activeValues.length === 0) {
    return null;
  }

  if (!params.leadNormalizedValue) {
    if (params.listType === "PL") {
      return `${params.listName}: field "${params.applyToField}" is empty or missing. PL requires the posted value to be in the list.`;
    }
    return null;
  }

  const isInList = params.activeValues.includes(params.leadNormalizedValue);

  if (params.listType === "PL" && !isInList) {
    return `${params.listName}: value "${displayValue}" for field "${params.applyToField}" is not on the PL list.`;
  }

  if (params.listType === "DNPL" && isInList) {
    return `${params.listName}: value "${displayValue}" for field "${params.applyToField}" is on the DNPL list.`;
  }

  return null;
}

async function loadEffectivePlDnplLists(buyerPlDnplListIds: string[], campaignPlDnplListIds: string[]) {
  const listIds = resolveEffectivePlDnplListIds(buyerPlDnplListIds, campaignPlDnplListIds);
  if (listIds.length === 0) {
    return [];
  }

  const objectIds = listIds.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
  if (objectIds.length === 0) {
    return [];
  }

  return PresentListModel.find({ _id: { $in: objectIds } })
    .select({ name: 1, listType: 1, applyToField: 1, values: 1 })
    .lean();
}

export async function describePlDnplRuleLines(params: {
  buyerPlDnplListIds: string[];
  campaignPlDnplListIds: string[];
}): Promise<string[]> {
  const lists = await loadEffectivePlDnplLists(params.buyerPlDnplListIds, params.campaignPlDnplListIds);
  if (lists.length === 0) {
    return [];
  }

  const now = Date.now();
  const lines: string[] = [];

  for (const list of lists) {
    const applyToField = list.applyToField?.trim() ?? "";
    if (!applyToField) continue;

    const listType = list.listType === "PL" ? "PL" : "DNPL";
    const listName = list.name?.trim() || listType;
    const activeValues = getActiveListValues(list.values, now);

    if (listType === "PL") {
      lines.push(
        `${listName} (PL): field "${applyToField}" must be in the list (${activeValues.length} active value(s)).`
      );
      continue;
    }

    lines.push(
      `${listName} (DNPL): field "${applyToField}" must not be on the list (${activeValues.length} active value(s)).`
    );
  }

  return lines;
}

export async function evaluatePlDnplForCampaign(params: {
  buyerPlDnplListIds: string[];
  campaignPlDnplListIds: string[];
  payload: Record<string, unknown>;
}): Promise<PlDnplEvaluationResult> {
  const lists = await loadEffectivePlDnplLists(params.buyerPlDnplListIds, params.campaignPlDnplListIds);
  if (lists.length === 0) {
    return { blocked: false, reasons: [] };
  }

  const reasons: string[] = [];
  const now = Date.now();

  for (const list of lists) {
    const applyToField = list.applyToField?.trim() ?? "";
    if (!applyToField) continue;

    const { raw: leadRawValue, normalized: leadNormalizedValue } = resolvePayloadFieldValue(
      params.payload,
      applyToField
    );
    const activeValues = getActiveListValues(list.values, now);
    const listType = list.listType === "PL" ? "PL" : "DNPL";
    const listName = list.name?.trim() || listType;

    const reason = evaluatePlDnplListRule({
      listName,
      listType,
      applyToField,
      leadRawValue,
      leadNormalizedValue,
      activeValues,
    });

    if (reason) {
      reasons.push(reason);
    }
  }

  return {
    blocked: reasons.length > 0,
    reasons,
  };
}
