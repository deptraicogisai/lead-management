import type {
  CampaignDuplicatesSettings,
  CampaignGeneralFilter,
  CampaignScheduleRule,
} from "@/lib/campaign";
import type { DocumentationField } from "@/lib/api-documentation-content";
import { getFieldsWithConditions } from "@/lib/api-documentation-content";
import type { MappingIntakeSettingsRecord } from "@/lib/mapping-intake-settings";

export type DocumentationRequirementRow = {
  category: string;
  requirements: string[];
};

function groupRequirementsByCategory(items: Array<{ category: string; requirement: string }>) {
  const grouped = new Map<string, string[]>();
  const order: string[] = [];

  for (const item of items) {
    if (!grouped.has(item.category)) {
      grouped.set(item.category, []);
      order.push(item.category);
    }
    grouped.get(item.category)!.push(item.requirement);
  }

  return order.map((category) => ({
    category,
    requirements: grouped.get(category) ?? [],
  }));
}

function isDuplicateRuleEnabled(period: string | undefined) {
  const trimmed = period?.trim() ?? "";
  return Boolean(trimmed) && trimmed !== "OFF";
}

function describeDuplicateLines(duplicates: CampaignDuplicatesSettings): string[] {
  const lines: string[] = [];
  const byEmail = duplicates.duplicateMethod === "Email";

  if (isDuplicateRuleEnabled(duplicates.duplicatePosted)) {
    lines.push(byEmail ? "Email cannot be duplicated." : "SSN and email cannot be duplicated.");
  } else if (!byEmail) {
    lines.push("SSN and email cannot be duplicated.");
  }

  if (isDuplicateRuleEnabled(duplicates.duplicateSold)) {
    lines.push(
      byEmail ? "Sold email cannot be duplicated." : "Sold SSN and email cannot be duplicated."
    );
  }

  return lines;
}

function describeFilterLine(filter: CampaignGeneralFilter): string | null {
  const name = filter.description?.trim() || filter.fieldName;

  if (filter.dataTypeFilter === "Text" && filter.textValue?.trim()) {
    return `${name} must be "${filter.textValue.trim()}".`;
  }

  if (filter.dataTypeFilter === "Range" && filter.minValue && filter.maxValue) {
    return `${name} must be between ${filter.minValue} and ${filter.maxValue}.`;
  }

  if (filter.dataTypeFilter === "Checkbox" && (filter.selectedValues?.length ?? 0) > 0) {
    return `${name} must be one of: ${filter.selectedValues?.join(", ")}.`;
  }

  return null;
}

function formatScheduleDays(days: string[]) {
  if (days.length === 0) return "selected days";
  return days.join(", ");
}

function formatScheduleTime(hour: string, minute: string) {
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

function describeScheduleLines(rules: CampaignScheduleRule[], timezone: string): string[] {
  const lines: string[] = [];

  for (const rule of rules) {
    const days = formatScheduleDays(rule.days);
    const from = formatScheduleTime(rule.startHour, rule.startMinute);
    const to = formatScheduleTime(rule.endHour, rule.endMinute);

    if (rule.action === "Do not post") {
      lines.push(`Leads are not accepted on ${days} between ${from} and ${to} (${timezone}).`);
    } else {
      lines.push(`Leads are only accepted on ${days} between ${from} and ${to} (${timezone}).`);
    }

    if (rule.dailyPostLeadsLimit != null && rule.dailyPostLeadsLimit >= 0) {
      lines.push(`Daily post limit: ${rule.dailyPostLeadsLimit} lead(s) per day (${timezone}).`);
    }

    if (rule.dailySoldLeadsLimit != null && rule.dailySoldLeadsLimit >= 0) {
      lines.push(`Daily sold limit: ${rule.dailySoldLeadsLimit} sold lead(s) per day (${timezone}).`);
    }
  }

  return lines;
}

function describeFieldRequirement(field: DocumentationField): string | null {
  if ((field.ignoreValues?.length ?? 0) > 0) {
    const label = field.description?.trim() || field.fieldName;
    return `${label} cannot be: ${field.ignoreValues?.join(", ")}.`;
  }

  return null;
}

export function buildDocumentationRequirementRows(
  settings: MappingIntakeSettingsRecord,
  fields: DocumentationField[] = []
): DocumentationRequirementRow[] {
  const items: Array<{ category: string; requirement: string }> = [];

  describeDuplicateLines(settings.duplicates).forEach((requirement) => {
    items.push({ category: "Duplicates", requirement });
  });

  settings.generalFilters
    .filter((filter) => filter.enabled)
    .map(describeFilterLine)
    .filter((line): line is string => Boolean(line))
    .forEach((requirement) => {
      items.push({ category: "Filters", requirement });
    });

  describeScheduleLines(
    settings.scheduleRules.filter((rule) => rule.active),
    settings.timezone
  ).forEach((requirement) => {
    items.push({ category: "Schedule", requirement });
  });

  getFieldsWithConditions(fields).forEach((field) => {
    const requirement = describeFieldRequirement(field);
    if (!requirement) return;

    items.push({
      category: field.description?.trim() || field.fieldName,
      requirement,
    });
  });

  return groupRequirementsByCategory(items);
}

export function formatRequirementCell(requirements: string[]) {
  return requirements.join("\n");
}

export function buildDocumentationRequirementsMarkdown(rows: DocumentationRequirementRow[]) {
  if (rows.length === 0) {
    return "No requirements are configured for this API.";
  }

  const header = "| Category | Requirement |\n| --- | --- |";
  const body = rows
    .map((row) => `| ${row.category} | ${formatRequirementCell(row.requirements).replace(/\n/g, "<br>")} |`)
    .join("\n");
  return `${header}\n${body}`;
}
