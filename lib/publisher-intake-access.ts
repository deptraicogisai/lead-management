export const PUBLISHER_INTAKE_ACCESS_DENIED_MESSAGES = {
  publisherPaused: "The publisher is currently paused",
  publisherSourcePaused: "The publisher source is currently paused",
} as const;

/** Publisher + Publisher Channel use Active/Inactive (Inactive = paused). */
export function isPublisherIntakePaused(status?: string | null) {
  const normalized = (status ?? "").trim().toLowerCase();
  return normalized === "inactive" || normalized === "paused";
}
