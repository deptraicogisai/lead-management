export type PublisherFilterOption = {
  value: string;
  label: string;
};

export function parseCommaSeparatedFilter(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function serializeCommaSeparatedFilter(values: string[]): string {
  return values.map((value) => value.trim()).filter(Boolean).join(",");
}

export type PublisherChannelSourceOptions = {
  channels: PublisherFilterOption[];
  sources: PublisherFilterOption[];
};

/**
 * Load Publisher Channel (API mappings) and Publisher Source (traffic sources)
 * options for a given seller/publisher.
 */
export async function fetchPublisherChannelSourceOptions(
  publisherId: string
): Promise<PublisherChannelSourceOptions> {
  const id = publisherId.trim();
  if (!id) {
    return { channels: [], sources: [] };
  }

  const [channelsResponse, sourcesResponse] = await Promise.all([
    fetch(`/api/sellers/${encodeURIComponent(id)}/verticals?status=Active`, { cache: "no-store" }),
    fetch(`/api/sellers/${encodeURIComponent(id)}/traffic-sources?status=All`, { cache: "no-store" }),
  ]);

  const channels: PublisherFilterOption[] = [];
  const channelSeen = new Set<string>();

  if (channelsResponse.ok) {
    const data = (await channelsResponse.json()) as Array<{
      apiName?: string;
      displayId?: number | null;
    }>;
    for (const item of data) {
      const name = item.apiName?.trim() || "";
      if (!name || channelSeen.has(name.toLowerCase())) continue;
      channelSeen.add(name.toLowerCase());
      channels.push({
        value: name,
        label: item.displayId != null ? `[${item.displayId}] ${name}` : name,
      });
    }
  }

  channels.sort((left, right) =>
    left.label.localeCompare(right.label, undefined, { sensitivity: "base", numeric: true })
  );

  const sources: PublisherFilterOption[] = [];
  const sourceSeen = new Set<string>();

  if (sourcesResponse.ok) {
    const data = (await sourcesResponse.json()) as Array<{
      sourceName?: string;
      displayId?: number | null;
      status?: string;
    }>;
    for (const item of data) {
      if (item.status === "Deleted") continue;
      const name = item.sourceName?.trim() || "";
      if (!name || sourceSeen.has(name.toLowerCase())) continue;
      sourceSeen.add(name.toLowerCase());
      sources.push({
        value: name,
        label: item.displayId != null ? `[${item.displayId}] ${name}` : name,
      });
    }
  }

  sources.sort((left, right) =>
    left.label.localeCompare(right.label, undefined, { sensitivity: "base", numeric: true })
  );

  return { channels, sources };
}

export function buildMultiValuePayloadMatch(
  values: string[],
  fields: string[],
  escapeRegex: (value: string) => string
) {
  if (values.length === 0) return null;

  return {
    $or: values.flatMap((value) => {
      const regex = { $regex: escapeRegex(value), $options: "i" };
      return fields.map((field) => ({ [field]: regex }));
    }),
  };
}
