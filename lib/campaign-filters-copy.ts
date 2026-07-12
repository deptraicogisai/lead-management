import {
  normalizeGeneralFiltersForStorage,
  syncGeneralFiltersWithFields,
  type CampaignGeneralFilter,
} from "@/lib/campaign";

type FieldLike = {
  id?: string;
  _id?: { toString(): string };
  fieldName: string;
  description: string;
  dataTypeFilter?: string | null;
};

/** Clone source filter values onto a target field list (matched by field name / mode). */
export function cloneGeneralFiltersForTarget(
  sourceFilters: CampaignGeneralFilter[],
  targetFields: FieldLike[]
): CampaignGeneralFilter[] {
  return normalizeGeneralFiltersForStorage(
    syncGeneralFiltersWithFields(normalizeGeneralFiltersForStorage(sourceFilters), targetFields)
  );
}
