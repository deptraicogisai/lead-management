import type { MappingIntakeSettingsRecord } from "@/lib/mapping-intake-settings";
import { buildDocumentationRequirementRows } from "@/lib/api-documentation-requirements";

export type TestLeadIntakeRuleGroup = {
  category: "Duplicates" | "Filters" | "Schedule";
  rules: string[];
};

export function buildTestLeadIntakeRuleGroups(settings: MappingIntakeSettingsRecord): TestLeadIntakeRuleGroup[] {
  const rows = buildDocumentationRequirementRows(settings, []);
  const categories: TestLeadIntakeRuleGroup["category"][] = ["Duplicates", "Filters", "Schedule"];

  return categories.map((category) => ({
    category,
    rules: rows.find((row) => row.category === category)?.requirements ?? [],
  }));
}

export type TestLeadValidationCheck = {
  category: "Fields" | "Duplicates" | "Filters" | "Schedule";
  passed: boolean;
  messages: string[];
};

export function buildTestLeadValidationChecks(
  breakdown: {
    fields: string[];
    duplicates: string[];
    filters: string[];
    schedule: string[];
  },
  intakeRuleGroups: TestLeadIntakeRuleGroup[]
): TestLeadValidationCheck[] {
  const configuredCategories = new Set(
    intakeRuleGroups.filter((group) => group.rules.length > 0).map((group) => group.category)
  );

  return [
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
  ].map((check) => {
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
