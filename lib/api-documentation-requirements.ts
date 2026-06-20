import {
  getMultiSelectFilterFieldLabel,
  type CampaignDuplicatesSettings,
  type CampaignGeneralFilter,
  type CampaignScheduleRule,
} from "@/lib/campaign";
import type { DocumentationField } from "@/lib/api-documentation-content";
import { getFieldsWithConditions, prettyType } from "@/lib/api-documentation-content";
import type { MappingIntakeSettingsRecord } from "@/lib/mapping-intake-settings";

export type DocumentationRequirementRow = {
  category: string;
  requirements: string[];
};

export type DocumentationRequestTableRow = {
  parameter: string;
  type: string;
  required: string;
  description: string;
  acceptedValues: string;
  requirement: string;
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
  const identityLabel = byEmail ? "email" : "SSN and email";

  lines.push(`Duplicate method: ${duplicates.duplicateMethod}.`);

  if (isDuplicateRuleEnabled(duplicates.duplicatePosted)) {
    lines.push(`Posted ${identityLabel} cannot be duplicated within ${duplicates.duplicatePosted.trim()}.`);
  } else {
    lines.push(`Posted ${identityLabel} cannot be duplicated (all historical leads).`);
  }

  return lines;
}

function describeFilterLine(filter: CampaignGeneralFilter): string | null {
  const name = getMultiSelectFilterFieldLabel(filter.description?.trim() || filter.fieldName);

  if (filter.dataTypeFilter === "Text" && filter.textValue?.trim()) {
    return `${name} must be "${filter.textValue.trim()}".`;
  }

  if (filter.dataTypeFilter === "Range" && filter.minValue && filter.maxValue) {
    return `${name} must be between ${filter.minValue} and ${filter.maxValue}.`;
  }

  if (filter.dataTypeFilter === "Checkbox" && (filter.selectedValues?.length ?? 0) > 0) {
    return `${name} must be one of: ${filter.selectedValues?.join(", ")}.`;
  }

  if (filter.dataTypeFilter === "Multi Select" && (filter.selectedValues?.length ?? 0) > 0) {
    if (filter.multiSelectMode === "excluded") {
      return `${name} (Excluded): must not contain: ${filter.selectedValues?.join(", ")}.`;
    }

    return `${name} (Included): must contain one of: ${filter.selectedValues?.join(", ")}.`;
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

function buildFieldRequirementText(field: DocumentationField, settings: MappingIntakeSettingsRecord) {
  const lines: string[] = [];
  const fieldRequirement = describeFieldRequirement(field);
  if (fieldRequirement) lines.push(fieldRequirement);

  const filters = settings.generalFilters.filter(
    (item) => item.enabled && item.fieldName === field.fieldName
  );
  filters
    .map(describeFilterLine)
    .filter((line): line is string => Boolean(line))
    .forEach((filterLine) => lines.push(filterLine));

  return lines.length > 0 ? lines.join("\n") : "-";
}

export function buildDocumentationRequestTableRows(
  settings: MappingIntakeSettingsRecord,
  fields: DocumentationField[],
  formatAcceptedValues: (field: DocumentationField) => string | null
): DocumentationRequestTableRow[] {
  const rows: DocumentationRequestTableRow[] = fields.map((field) => ({
    parameter: field.fieldName,
    type: prettyType(field.type),
    required: field.required ? "Yes" : "No",
    description: field.description || "-",
    acceptedValues: formatAcceptedValues(field) ?? "-",
    requirement: buildFieldRequirementText(field, settings),
  }));

  describeDuplicateLines(settings.duplicates).forEach((requirement) => {
    rows.push({
      parameter: "Duplicates",
      type: "-",
      required: "-",
      description: "-",
      acceptedValues: "-",
      requirement,
    });
  });

  describeScheduleLines(
    settings.scheduleRules.filter((rule) => rule.active),
    settings.timezone
  ).forEach((requirement) => {
    rows.push({
      parameter: "Schedule",
      type: "-",
      required: "-",
      description: "-",
      acceptedValues: "-",
      requirement,
    });
  });

  return rows;
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

  const flattened = rows.flatMap((row) =>
    row.requirements.map((requirement) => `[${row.category}] ${requirement}`)
  );

  const header = "| Requirement |\n| --- |";
  const body = flattened.map((requirement) => `| ${requirement.replace(/\|/g, "\\|")} |`).join("\n");
  return `${header}\n${body}`;
}
