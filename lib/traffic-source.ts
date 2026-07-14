/**
 * Resolve the traffic source from a lead payload field named `source`
 * (case-insensitive; separators ignored so `Source`, `SOURCE` match).
 */
export function extractSource(payload: Record<string, unknown>): string | null {
  for (const [key, value] of Object.entries(payload)) {
    const normalizedKey = key.trim().toLowerCase().replace(/[\s_-]/g, "");
    if (normalizedKey !== "source") {
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
