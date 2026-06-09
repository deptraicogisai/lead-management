import {
  LEAD_SYSTEM_TEMPLATE_VARIABLES,
  buildLeadTemplateSuggestions,
  toLeadFieldTemplate,
} from "@/lib/lead-template";

export type TwigTemplateSuggestion = {
  token: string;
  description: string;
  group: "lead-system" | "lead-payload" | "config-field" | "mapped-slug" | "response-field";
};

export const RESPONSE_TEMPLATE_VARIABLES: TwigTemplateSuggestion[] = [
  { token: "{{ response.message }}", description: "Response message", group: "response-field" },
  { token: '{{ response.message == "Approved" }}', description: "Approved status check", group: "response-field" },
  { token: '{{ response.message == "Declined" }}', description: "Declined status check", group: "response-field" },
  { token: "{{ response.result.price }}", description: "Result price", group: "response-field" },
  { token: "{{ response.result.redirect_url }}", description: "Redirect URL", group: "response-field" },
];

export function buildResponseTemplateSuggestions(): TwigTemplateSuggestion[] {
  return RESPONSE_TEMPLATE_VARIABLES.map((item) => ({ ...item }));
}

export type IntegrationConfigTemplateField = {
  variableName: string;
  label: string;
};

export type ArrayMappingTemplateSlug = {
  slug: string;
  fieldName: string;
};

export function toMappedSlugTemplate(slug: string) {
  const normalized = slug.trim();
  if (!normalized) return "{{ mapped. }}";
  return `{{ mapped.${normalized} }}`;
}

export function buildMappedTemplateSuggestions(
  arrayMappingSlugs: ArrayMappingTemplateSlug[]
): TwigTemplateSuggestion[] {
  const seen = new Set<string>();

  const suggestions: TwigTemplateSuggestion[] = [];

  for (const entry of arrayMappingSlugs) {
    const slug = entry.slug.trim();
    if (!slug) continue;

    const token = toMappedSlugTemplate(slug);
    if (seen.has(token)) continue;

    const fieldName = entry.fieldName.trim() || slug;
    suggestions.push({
      token,
      description: fieldName,
      group: "mapped-slug",
    });
    seen.add(token);
  }

  return suggestions;
}

export function toConfigFieldTemplate(variableName: string) {
  const normalized = variableName.trim();
  if (!normalized) return "{{ config. }}";
  return `{{ config.${normalized} }}`;
}

export function buildConfigTemplateSuggestions(
  integrationConfigFields: IntegrationConfigTemplateField[]
): TwigTemplateSuggestion[] {
  const seen = new Set<string>();

  const suggestions: TwigTemplateSuggestion[] = [];

  for (const field of integrationConfigFields) {
    const variableName = field.variableName.trim();
    if (!variableName) continue;

    const token = toConfigFieldTemplate(variableName);
    if (seen.has(token)) continue;

    const label = field.label.trim() || variableName;
    suggestions.push({ token, description: label, group: "config-field" });
    seen.add(token);
  }

  return suggestions;
}

export type BuildTwigTemplateSuggestionsOptions = {
  includeResponse?: boolean;
};

export function buildTwigTemplateSuggestions(
  leadFieldNames: string[],
  integrationConfigFields: IntegrationConfigTemplateField[],
  arrayMappingSlugs: ArrayMappingTemplateSlug[] = [],
  options: BuildTwigTemplateSuggestionsOptions = {}
) {
  const leadSuggestions = buildLeadTemplateSuggestions(leadFieldNames).map((item) => ({
    token: item.token,
    description: item.description,
    group: item.group === "system" ? ("lead-system" as const) : ("lead-payload" as const),
  }));

  const configSuggestions = buildConfigTemplateSuggestions(integrationConfigFields);
  const mappedSuggestions = buildMappedTemplateSuggestions(arrayMappingSlugs);
  const responseSuggestions = options.includeResponse ? buildResponseTemplateSuggestions() : [];

  const seen = new Set<string>();

  return [...leadSuggestions, ...configSuggestions, ...mappedSuggestions, ...responseSuggestions].filter((item) => {
    if (seen.has(item.token)) return false;
    seen.add(item.token);
    return true;
  });
}

export type ActiveTwigTemplateQuery = {
  openIndex: number;
  partial: string;
  replaceStart: number;
  replaceEnd: number;
};

export function getActiveTwigTemplateQuery(value: string, cursor: number): ActiveTwigTemplateQuery | null {
  const before = value.slice(0, cursor);
  const openIndex = before.lastIndexOf("{{");
  if (openIndex === -1) return null;

  const afterOpen = before.slice(openIndex + 2);
  if (afterOpen.includes("}}")) return null;

  const partial = afterOpen.replace(/^\s+/, "");

  return {
    openIndex,
    partial,
    replaceStart: openIndex,
    replaceEnd: cursor,
  };
}

function matchesTemplateQuery(item: TwigTemplateSuggestion, query: string) {
  const inner = item.token
    .replace(/^\{\{\s*/, "")
    .replace(/\s*\}\}$/, "")
    .toLowerCase();

  return (
    inner.includes(query) ||
    item.token.toLowerCase().includes(query) ||
    item.description.toLowerCase().includes(query)
  );
}

const TWIG_BLOCK_PATTERN = /\{\{([^{}]*)\}\}/g;
const TWIG_EXPRESSION_PATTERN = /^(lead|config|mapped)\.([a-zA-Z][a-zA-Z0-9_]*)$/;

const LEAD_SYSTEM_PATHS = new Set(
  LEAD_SYSTEM_TEMPLATE_VARIABLES.map((item) =>
    item.token
      .replace(/^\{\{\s*lead\./, "")
      .replace(/\s*\}\}$/, "")
      .trim()
  )
);

export type TwigValidationContext = {
  leadFieldNames: string[];
  integrationConfigFields: IntegrationConfigTemplateField[];
  arrayMappingSlugs: ArrayMappingTemplateSlug[];
};

function validateTwigExpression(
  inner: string,
  fieldLabel: string,
  context: TwigValidationContext
): string | null {
  const expression = inner.trim();

  if (!expression) {
    return `${fieldLabel}: Twig expression cannot be empty.`;
  }

  const match = expression.match(TWIG_EXPRESSION_PATTERN);
  if (!match) {
    return `${fieldLabel}: invalid Twig expression "${expression}". Use {{ lead.<field> }}, {{ config.<variable> }}, or {{ mapped.<slug> }}.`;
  }

  const namespace = match[1];
  const path = match[2];

  if (namespace === "lead") {
    if (LEAD_SYSTEM_PATHS.has(path)) return null;

    if (context.leadFieldNames.includes(path)) return null;

    return `${fieldLabel}: unknown lead field "${path}".`;
  }

  if (namespace === "mapped") {
    const mappedSlug = context.arrayMappingSlugs.find((entry) => entry.slug === path);
    if (!mappedSlug) {
      return `${fieldLabel}: unknown mapped slug "${path}". Add it in the Array Mapping tab.`;
    }

    return null;
  }

  const configVariable = context.integrationConfigFields.find((field) => field.variableName === path);
  if (!configVariable) {
    return `${fieldLabel}: unknown config variable "${path}". Add it in the Integration Config tab.`;
  }

  return null;
}

export type ValidateTwigTemplateOptions = {
  allowResponseExpressions?: boolean;
};

function validateTwigBlockInner(
  inner: string,
  fieldLabel: string,
  context: TwigValidationContext,
  options: ValidateTwigTemplateOptions
): string | null {
  const expression = inner.trim();

  if (!expression) {
    return `${fieldLabel}: Twig expression cannot be empty.`;
  }

  const strictMatch = expression.match(TWIG_EXPRESSION_PATTERN);
  if (strictMatch) {
    return validateTwigExpression(expression, fieldLabel, context);
  }

  if (options.allowResponseExpressions) {
    return null;
  }

  return `${fieldLabel}: invalid Twig expression "${expression}". Use {{ lead.<field> }}, {{ config.<variable> }}, or {{ mapped.<slug> }}.`;
}

export function validateTwigTemplateValue(
  value: string,
  fieldLabel: string,
  context: TwigValidationContext,
  options: ValidateTwigTemplateOptions = {}
): string | null {
  if (!value.includes("{{")) return null;

  const stripped = value.replace(TWIG_BLOCK_PATTERN, "");
  if (stripped.includes("{{") || stripped.includes("}}")) {
    return `${fieldLabel}: invalid Twig format (unmatched "{{" or "}}").`;
  }

  const blocks = [...value.matchAll(TWIG_BLOCK_PATTERN)];
  if (blocks.length === 0) {
    return `${fieldLabel}: invalid Twig format.`;
  }

  for (const block of blocks) {
    const exprError = validateTwigBlockInner(block[1] ?? "", fieldLabel, context, options);
    if (exprError) return exprError;
  }

  return null;
}

export function validateTwigTemplateValues(
  fields: Array<{ label: string; value: string }>,
  context: TwigValidationContext,
  options: ValidateTwigTemplateOptions = {}
): string | null {
  for (const field of fields) {
    const error = validateTwigTemplateValue(field.value, field.label, context, options);
    if (error) return error;
  }

  return null;
}

export function validateResponseMappingTwigPayload(
  responseMapping: {
    fields: Array<{ key: string; value: string }>;
  },
  context: TwigValidationContext
): string | null {
  return validateTwigTemplateValues(
    responseMapping.fields.map((field) => ({
      label: field.key.trim() || "Response field",
      value: field.value,
    })),
    context,
    { allowResponseExpressions: true }
  );
}

export function validateRequestMappingTwigPayload(
  requestMapping: {
    requestUrl?: string;
    headers?: Array<{ key: string; value: string }>;
    dataRows?: Array<{ name: string; value: string }>;
  },
  context: TwigValidationContext
): string | null {
  const fields: Array<{ label: string; value: string }> = [];

  if (requestMapping.requestUrl !== undefined) {
    fields.push({ label: "Request URL", value: requestMapping.requestUrl });
  }

  requestMapping.headers?.forEach((row, index) => {
    const rowLabel = row.key.trim() || `row ${index + 1}`;
    fields.push({ label: `Header key (${rowLabel})`, value: row.key });
    fields.push({ label: `Header value (${rowLabel})`, value: row.value });
  });

  requestMapping.dataRows?.forEach((row, index) => {
    const rowLabel = row.name.trim() || `row ${index + 1}`;
    fields.push({ label: `Data name (${rowLabel})`, value: row.name });
    fields.push({ label: `Data value (${rowLabel})`, value: row.value });
  });

  return validateTwigTemplateValues(fields, context);
}

export function filterTwigTemplateSuggestions(suggestions: TwigTemplateSuggestion[], partial: string) {
  const query = partial.trim().toLowerCase();
  let scoped = suggestions;

  if (query === "config" || query.startsWith("config.")) {
    scoped = suggestions.filter((item) => item.group === "config-field");
    const subQuery = query === "config" ? "" : query.slice("config.".length);
    if (!subQuery) return scoped;
    return scoped.filter((item) => matchesTemplateQuery(item, `config.${subQuery}`) || matchesTemplateQuery(item, subQuery));
  }

  if (query === "lead" || query.startsWith("lead.")) {
    scoped = suggestions.filter((item) => item.group === "lead-system" || item.group === "lead-payload");
    const subQuery = query === "lead" ? "" : query.slice("lead.".length);
    if (!subQuery) return scoped;
    return scoped.filter((item) => matchesTemplateQuery(item, `lead.${subQuery}`) || matchesTemplateQuery(item, subQuery));
  }

  if (query === "mapped" || query.startsWith("mapped.")) {
    scoped = suggestions.filter((item) => item.group === "mapped-slug");
    const subQuery = query === "mapped" ? "" : query.slice("mapped.".length);
    if (!subQuery) return scoped;
    return scoped.filter((item) => matchesTemplateQuery(item, `mapped.${subQuery}`) || matchesTemplateQuery(item, subQuery));
  }

  if (query === "response" || query.startsWith("response.")) {
    scoped = suggestions.filter((item) => item.group === "response-field");
    const subQuery = query === "response" ? "" : query.slice("response.".length);
    if (!subQuery) return scoped;
    return scoped.filter((item) => matchesTemplateQuery(item, `response.${subQuery}`) || matchesTemplateQuery(item, subQuery));
  }

  if (!query) return suggestions;

  return suggestions.filter((item) => matchesTemplateQuery(item, query));
}

export { toLeadFieldTemplate };
