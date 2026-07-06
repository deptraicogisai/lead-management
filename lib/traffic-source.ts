/** Payload keys that are treated as the publisher sub id (Traffic Source name). */
const SUB_ID_KEYS = ["subid", "sub_id", "sub-id", "sub"];

/**
 * Resolve the sub id from a lead payload.
 * Matching is case-insensitive and ignores common separators so `subId`, `sub_id`,
 * `SubID`, etc. all map to the same value.
 */
export function extractSubId(payload: Record<string, unknown>): string | null {
  for (const [key, value] of Object.entries(payload)) {
    const normalizedKey = key.trim().toLowerCase().replace(/[\s_-]/g, "");
    if (normalizedKey !== "subid" && !SUB_ID_KEYS.includes(key.trim().toLowerCase())) {
      continue;
    }

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
}
