import type { MappingIntakeSettingsRecord } from "@/lib/mapping-intake-settings";
import { buildDocumentationRequirementRows } from "@/lib/api-documentation-requirements";

export type TestLeadIntakeRuleGroup = {
  category: "Duplicates" | "Filters" | "Schedule" | "PL/DNPL";
  rules: string[];
};

export function buildTestLeadIntakeRuleGroups(
  settings: MappingIntakeSettingsRecord,
  plDnplRules: string[] = []
): TestLeadIntakeRuleGroup[] {
  const rows = buildDocumentationRequirementRows(settings, []);
  const categories: Array<"Duplicates" | "Filters" | "Schedule"> = ["Duplicates", "Filters", "Schedule"];

  return [
    ...categories.map((category) => ({
      category,
      rules: rows.find((row) => row.category === category)?.requirements ?? [],
    })),
    {
      category: "PL/DNPL" as const,
      rules: plDnplRules,
    },
  ];
}

export function buildTestLeadMultiSelectFilters(settings: MappingIntakeSettingsRecord): Record<string, string[]> {
  const filters: Record<string, string[]> = {};

  for (const filter of settings.generalFilters) {
    if (
      filter.enabled &&
      filter.dataTypeFilter === "Multi Select" &&
      filter.multiSelectMode !== "excluded" &&
      (filter.selectedValues?.length ?? 0) > 0
    ) {
      filters[filter.fieldName] = filter.selectedValues ?? [];
    }
  }

  return filters;
}

export type TestLeadValidationCheck = {
  category: "Fields" | "Duplicates" | "Filters" | "Schedule" | "PL/DNPL";
  passed: boolean;
  messages: string[];
};

export function buildTestLeadValidationChecks(
  breakdown: {
    fields: string[];
    duplicates: string[];
    filters: string[];
    schedule: string[];
    plDnpl?: string[];
  },
  intakeRuleGroups: TestLeadIntakeRuleGroup[]
): TestLeadValidationCheck[] {
  const configuredCategories = new Set(
    intakeRuleGroups.filter((group) => group.rules.length > 0).map((group) => group.category)
  );

  const plDnplReasons = breakdown.plDnpl ?? [];

  const checks: TestLeadValidationCheck[] = [
    {
      category: "Fields",
      passed: breakdown.fields.length === 0,
      messages: breakdown.fields,
    },
    {
      category: "Duplicates",
      passed: breakdown.duplicates.length === 0,
      messages: breakdown.duplicates,
    },
    {
      category: "Filters",
      passed: breakdown.filters.length === 0,
      messages: breakdown.filters,
    },
    {
      category: "Schedule",
      passed: breakdown.schedule.length === 0,
      messages: breakdown.schedule,
    },
    {
      category: "PL/DNPL",
      passed: plDnplReasons.length === 0,
      messages: plDnplReasons,
    },
  ];

  return checks.map((check): TestLeadValidationCheck => {
    if (check.category === "Fields") {
      return check.passed
        ? { ...check, messages: ["Passed."] }
        : check;
    }

    if (!configuredCategories.has(check.category)) {
      return {
        ...check,
        passed: true,
        messages: ["No active rules configured."],
      };
    }

    if (check.passed) {
      return {
        ...check,
        messages: ["Passed."],
      };
    }

    return check;
  });
}
