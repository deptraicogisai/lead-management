export type LeadTemplateVariable = {
  token: string;
  description: string;
  group: "system" | "payload";
};

export const LEAD_SYSTEM_TEMPLATE_VARIABLES: LeadTemplateVariable[] = [
  { token: "{{ lead._id }}", description: "Lead document id", group: "system" },
  { token: "{{ lead.postedAt }}", description: "Posted timestamp", group: "system" },
  { token: "{{ lead.validationStatus }}", description: "Validation status (success / fail)", group: "system" },
  { token: "{{ lead.userAgent }}", description: "Request user agent", group: "system" },
  { token: "{{ lead.createdAt }}", description: "Created timestamp", group: "system" },
  { token: "{{ lead.updatedAt }}", description: "Updated timestamp", group: "system" },
  { token: "{{ lead.payload }}", description: "Full lead payload object", group: "system" },
];

export function toLeadFieldTemplate(fieldName: string) {
  const normalized = fieldName.trim();
  if (!normalized) return "{{ lead. }}";
  return `{{ lead.${normalized} }}`;
}

export function buildLeadTemplateSuggestions(fieldNames: string[]) {
  const payloadVariables = fieldNames
    .map((fieldName) => fieldName.trim())
    .filter(Boolean)
    .map((fieldName) => ({
      token: toLeadFieldTemplate(fieldName),
      description: `Lead payload field: ${fieldName}`,
      group: "payload" as const,
    }));

  const seen = new Set<string>();
  const combined = [...LEAD_SYSTEM_TEMPLATE_VARIABLES, ...payloadVariables];

  return combined.filter((item) => {
    if (seen.has(item.token)) return false;
    seen.add(item.token);
    return true;
  });
}

export function buildLeadTemplateSuggestionValues(fieldNames: string[]) {
  return buildLeadTemplateSuggestions(fieldNames).map((item) => item.token);
}
