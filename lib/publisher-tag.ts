export const PUBLISHER_TAG_SUGGEST_MIN_LENGTH = 2;

export function normalizePublisherTag(value?: string | null) {
  return value?.trim() ?? "";
}

export function shouldShowPublisherTagSuggestions(query: string) {
  return normalizePublisherTag(query).length >= PUBLISHER_TAG_SUGGEST_MIN_LENGTH;
}

export function filterPublisherTagSuggestions(tags: string[], query: string) {
  const normalizedQuery = normalizePublisherTag(query).toLowerCase();
  if (!shouldShowPublisherTagSuggestions(query)) return [];

  return tags
    .filter((tag) => tag.toLowerCase().includes(normalizedQuery))
    .slice(0, 8);
}