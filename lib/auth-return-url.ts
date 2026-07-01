export const DEFAULT_POST_LOGIN_PATH = "/dashboard";

export function getSafeReturnUrl(value?: string | null): string | null {
  if (!value?.trim()) {
    return null;
  }

  const trimmed = value.trim();

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("//") ||
    !trimmed.startsWith("/")
  ) {
    return null;
  }

  if (trimmed === "/login" || trimmed.startsWith("/login?")) {
    return null;
  }

  return trimmed;
}

export function buildLoginPath(returnPath?: string | null) {
  const safeReturn = getSafeReturnUrl(returnPath);

  if (!safeReturn) {
    return "/login";
  }

  return `/login?returnUrl=${encodeURIComponent(safeReturn)}`;
}

export function resolvePostLoginPath(returnPath?: string | null) {
  return getSafeReturnUrl(returnPath) ?? DEFAULT_POST_LOGIN_PATH;
}
