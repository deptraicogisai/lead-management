export function normalizeDecimalInputValue(value: string) {
  return value.replace(/,/g, ".");
}

function allowsDecimalStep(step: string | number | undefined) {
  if (step === "any") {
    return true;
  }

  if (step === undefined) {
    return false;
  }

  const numericStep = Number(step);
  return Number.isFinite(numericStep) && numericStep > 0 && numericStep < 1;
}

export function sanitizeDecimalInputValue(
  value: string,
  options?: { allowDecimal?: boolean; allowNegative?: boolean }
): string | null {
  const normalized = normalizeDecimalInputValue(value);
  const allowDecimal = options?.allowDecimal ?? true;
  const allowNegative = options?.allowNegative ?? false;

  if (normalized === "") {
    return "";
  }

  const pattern = allowDecimal
    ? allowNegative
      ? /^-?\d*\.?\d*$/
      : /^\d*\.?\d*$/
    : allowNegative
      ? /^-?\d*$/
      : /^\d*$/;

  if (!pattern.test(normalized)) {
    return null;
  }

  return normalized;
}

export function sanitizeNumberInputValue(
  value: string,
  options?: { step?: string | number; min?: string | number }
): string | null {
  const minValue = options?.min != null ? Number(options.min) : 0;
  const allowNegative = Number.isFinite(minValue) && minValue < 0;

  return sanitizeDecimalInputValue(value, {
    allowDecimal: allowsDecimalStep(options?.step),
    allowNegative,
  });
}

export function formatDecimalInputDisplayValue(
  value: string | number | readonly string[] | undefined
): string | number | readonly string[] | undefined {
  if (typeof value === "string") {
    return normalizeDecimalInputValue(value);
  }

  return value;
}
