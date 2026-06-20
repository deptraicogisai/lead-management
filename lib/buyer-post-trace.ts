export type BuyerPostTraceStepStatus = "pass" | "fail" | "skip" | "info" | "error";

export type BuyerPostValidationCheck = {
  category: string;
  passed: boolean;
  messages: string[];
};

export type BuyerPostStepResult = {
  success: boolean;
  message?: string;
  error?: string;
};

export type BuyerPostTraceStep = {
  key: string;
  label: string;
  status: BuyerPostTraceStepStatus;
  summary?: string;
  result?: BuyerPostStepResult;
  validationChecks?: BuyerPostValidationCheck[];
};

export function successStepResult(message?: string): BuyerPostStepResult {
  return { success: true, message };
}

export function errorStepResult(error: string, message?: string): BuyerPostStepResult {
  return { success: false, error, message };
}

export function skippedStepResult(message: string): BuyerPostStepResult {
  return { success: true, message };
}

export function resolveStepResult(step: BuyerPostTraceStep): BuyerPostStepResult {
  if (step.result) {
    return step.result;
  }

  if (step.validationChecks && step.validationChecks.length > 0) {
    const failedChecks = step.validationChecks.filter((check) => !check.passed);
    if (failedChecks.length === 0) {
      return successStepResult(step.summary ?? "All validation checks passed.");
    }

    const errorMessages = failedChecks.flatMap((check) =>
      check.messages.filter((message) => !/passed|no duplicate/i.test(message))
    );

    return errorStepResult(
      errorMessages.length > 0 ? errorMessages.join(" | ") : step.summary ?? "Validation failed.",
      "Validation failed."
    );
  }

  if (step.status === "pass") {
    return successStepResult(step.summary ?? "Success.");
  }

  if (step.status === "skip" || step.status === "info") {
    return skippedStepResult(step.summary ?? (step.status === "skip" ? "Skipped." : "Info."));
  }

  return errorStepResult(step.summary ?? "Step failed.");
}

export function appendBuyerPostTraceStep(
  steps: BuyerPostTraceStep[],
  step: BuyerPostTraceStep
): BuyerPostTraceStep[] {
  return [...steps, step];
}

export function buildPublisherIntakeTraceStep(
  checks: BuyerPostValidationCheck[],
  passed: boolean,
  reasons: string[]
): BuyerPostTraceStep {
  return {
    key: "publisher-intake-validation",
    label: "Publisher Intake Validation",
    status: passed ? "pass" : "fail",
    summary: passed
      ? "Publisher intake validation passed (fields, duplicates, filters, schedule)."
      : reasons.join(" | "),
    validationChecks: checks,
    result: passed
      ? successStepResult("Publisher intake validation passed.")
      : errorStepResult(reasons.join(" | ") || "Publisher intake validation failed."),
  };
}

export function buildValidationTraceStep(
  passed: boolean,
  validationChecks: BuyerPostValidationCheck[],
  reasons: string[]
): BuyerPostTraceStep {
  return {
    key: "campaign-validation",
    label: "Campaign Validation",
    status: passed ? "pass" : "fail",
    summary: passed ? "All campaign validation checks passed." : reasons.join(" | "),
    validationChecks,
    result: passed
      ? successStepResult("Campaign validation passed.")
      : errorStepResult(reasons.join(" | ") || "Campaign validation failed."),
  };
}
