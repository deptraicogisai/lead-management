import type { IntegrationBuilderConfigField } from "@/lib/integration-builder";

export const DEFAULT_POST_TIMEOUT_SECONDS = 90;

export type CampaignIntegrationConfigValues = Record<string, string>;
type StoredIntegrationSettings = {
  postUrl?: string | null;
  postTimeout?: number | null;
  postTimeoutMs?: number | null;
  configValues?: CampaignIntegrationConfigValues | null;
} | null | undefined;

export function normalizeCampaignIntegrationConfigValues(
  settings?: StoredIntegrationSettings
): CampaignIntegrationConfigValues {
  const configValues: CampaignIntegrationConfigValues = {
    ...(settings?.configValues ?? {}),
  };

  if (!configValues.url?.trim() && settings?.postUrl?.trim()) {
    configValues.url = settings.postUrl.trim();
  }

  if (!configValues.timeout?.trim()) {
    if (settings?.postTimeout != null && Number.isFinite(Number(settings.postTimeout))) {
      configValues.timeout = String(settings.postTimeout);
    } else if (settings?.postTimeoutMs != null && Number.isFinite(Number(settings.postTimeoutMs))) {
      configValues.timeout = String(Math.round(Number(settings.postTimeoutMs) / 1000));
    } else {
      configValues.timeout = String(DEFAULT_POST_TIMEOUT_SECONDS);
    }
  }

  return configValues;
}

export function resolvePostTimeoutMs(
  config: Record<string, string>,
  fallbackSeconds = DEFAULT_POST_TIMEOUT_SECONDS
): number {
  const raw =
    config.post_timeout?.trim() ||
    config.timeout?.trim() ||
    config.postTimeout?.trim();
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallbackSeconds * 1000;
  }
  return parsed * 1000;
}

export function resolvePingTimeoutMs(
  config: Record<string, string>,
  fallbackSeconds = DEFAULT_POST_TIMEOUT_SECONDS
): number {
  const raw = config.ping_timeout?.trim() || config.pingTimeout?.trim();
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return resolvePostTimeoutMs(config, fallbackSeconds);
  }
  return parsed * 1000;
}

export function buildIntegrationConfigDefaults(
  configFields: IntegrationBuilderConfigField[],
  savedValues?: CampaignIntegrationConfigValues
): CampaignIntegrationConfigValues {
  const values: CampaignIntegrationConfigValues = {};

  for (const field of configFields) {
    const savedValue = savedValues?.[field.variableName];
    if (savedValue !== undefined) {
      values[field.variableName] = savedValue;
    } else if (field.variableName === "timeout") {
      values[field.variableName] = String(DEFAULT_POST_TIMEOUT_SECONDS);
    } else {
      values[field.variableName] = "";
    }
  }

  return values;
}

export function collectIntegrationConfigFieldErrors(
  configFields: IntegrationBuilderConfigField[],
  values: CampaignIntegrationConfigValues
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const field of configFields) {
    const rawValue = values[field.variableName] ?? "";
    const trimmedValue = rawValue.trim();

    if (field.required && !trimmedValue) {
      errors[field.variableName] = `${field.label} is required.`;
      continue;
    }

    if (!trimmedValue) continue;

    if (field.type === "number" && !Number.isFinite(Number(trimmedValue))) {
      errors[field.variableName] = `${field.label} must be a number.`;
      continue;
    }

    if (field.type === "boolean" && trimmedValue !== "true" && trimmedValue !== "false") {
      errors[field.variableName] = `${field.label} must be true or false.`;
    }
  }

  return errors;
}

export function validateIntegrationConfigFields(
  configFields: IntegrationBuilderConfigField[],
  values: CampaignIntegrationConfigValues
): string | null {
  const errors = collectIntegrationConfigFieldErrors(configFields, values);
  const firstError = Object.values(errors)[0];
  return firstError ?? null;
}

export function sanitizeIntegrationConfigValues(
  configFields: IntegrationBuilderConfigField[],
  values: CampaignIntegrationConfigValues
): CampaignIntegrationConfigValues {
  const allowedVariables = new Set(configFields.map((field) => field.variableName));
  const sanitized: CampaignIntegrationConfigValues = {};

  for (const [variableName, value] of Object.entries(values)) {
    if (!allowedVariables.has(variableName)) continue;
    sanitized[variableName] = typeof value === "string" ? value.trim() : String(value ?? "");
  }

  return sanitized;
}
