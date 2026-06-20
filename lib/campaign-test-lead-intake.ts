import type { CampaignDuplicatesSettings } from "@/lib/campaign";
import { buildDocumentationRequirementRows } from "@/lib/api-documentation-requirements";
import type { MappingIntakeSettingsRecord } from "@/lib/mapping-intake-settings";

export type CampaignIntakeRuleGroup = {
  category: "Duplicates" | "Filters" | "Schedule" | "PL/DNPL";
  rules: string[];
};

function isDuplicateRuleEnabled(period: string | undefined) {
  const trimmed = period?.trim() ?? "";
  return Boolean(trimmed) && trimmed.toUpperCase() !== "OFF";
}

export function hasActiveCampaignDuplicateRules(duplicates: CampaignDuplicatesSettings) {
  return (
    isDuplicateRuleEnabled(duplicates.duplicatePosted) || isDuplicateRuleEnabled(duplicates.duplicateSold)
  );
}

function buildCampaignDuplicateRequirementLines(duplicates: CampaignDuplicatesSettings): string[] {
  if (!hasActiveCampaignDuplicateRules(duplicates)) {
    return [];
  }

  const byEmail = duplicates.duplicateMethod === "Email";
  const identityLabel = byEmail ? "email" : "SSN and email";
  const lines: string[] = [`Duplicate method: ${duplicates.duplicateMethod}.`];

  if (isDuplicateRuleEnabled(duplicates.duplicatePosted)) {
    lines.push(`Posted ${identityLabel} cannot be duplicated within ${duplicates.duplicatePosted.trim()}.`);
  }

  if (isDuplicateRuleEnabled(duplicates.duplicateSold)) {
    lines.push(`Sold ${identityLabel} cannot be duplicated within ${duplicates.duplicateSold.trim()}.`);
  }

  return lines;
}

export function buildCampaignIntakeRuleGroups(
  intakeSettings: MappingIntakeSettingsRecord,
  plDnplRules: string[] = []
): CampaignIntakeRuleGroup[] {
  const rows = buildDocumentationRequirementRows(intakeSettings, []);

  return [
    {
      category: "Duplicates",
      rules: buildCampaignDuplicateRequirementLines(intakeSettings.duplicates),
    },
    {
      category: "Filters",
      rules: rows.find((row) => row.category === "Filters")?.requirements ?? [],
    },
    {
      category: "Schedule",
      rules: rows.find((row) => row.category === "Schedule")?.requirements ?? [],
    },
    {
      category: "PL/DNPL",
      rules: plDnplRules,
    },
  ];
}

export function finalizeCampaignValidationCheckMessages(
  category: CampaignIntakeRuleGroup["category"],
  passed: boolean,
  failureMessages: string[],
  ruleGroups: CampaignIntakeRuleGroup[]
): string[] {
  if (!passed && failureMessages.length > 0) {
    return failureMessages;
  }

  const configuredRules = ruleGroups.find((group) => group.category === category)?.rules ?? [];
  if (configuredRules.length === 0) {
    return ["No active rules configured."];
  }

  return ["Passed."];
}
