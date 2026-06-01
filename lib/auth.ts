export const AUTH_COOKIE_NAME = "lead-management-session";
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 8;

export type AuthSession = {
  name: string;
  email: string;
  role: string;
  initials: string;
  loginAt: string;
};

function toTitleCase(value: string) {
  return value
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function getNameFromEmail(email: string) {
  const localPart = email.split("@")[0]?.trim() ?? "";

  if (!localPart) {
    return "Admin User";
  }

  const normalizedName = toTitleCase(localPart);
  return normalizedName || "Admin User";
}

function getInitials(name: string) {
  const letters = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return letters || "AU";
}

type CreateAuthSessionInput = {
  name?: string | null;
  email?: string | null;
  username?: string | null;
  role?: string | null;
};

export function createAuthSession(input: CreateAuthSessionInput): AuthSession {
  const normalizedEmail = input.email?.trim().toLowerCase() || input.username?.trim() || "unknown-user";
  const normalizedName =
    input.name?.trim() || (input.email ? getNameFromEmail(input.email) : input.username?.trim()) || "Admin User";
  const normalizedRole = input.role?.trim() || "Administrator";

  return {
    name: normalizedName,
    email: normalizedEmail,
    role: normalizedRole,
    initials: getInitials(normalizedName),
    loginAt: new Date().toISOString(),
  };
}

export function encodeAuthSession(session: AuthSession) {
  return encodeURIComponent(JSON.stringify(session));
}

export function decodeAuthSession(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<AuthSession>;

    if (
      typeof parsed.name !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.role !== "string" ||
      typeof parsed.initials !== "string" ||
      typeof parsed.loginAt !== "string"
    ) {
      return null;
    }

    return parsed as AuthSession;
  } catch {
    return null;
  }
}

export function buildAuthCookieString(session: AuthSession) {
  return `${AUTH_COOKIE_NAME}=${encodeAuthSession(session)}; Path=/; Max-Age=${AUTH_COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function buildExpiredAuthCookieString() {
  return `${AUTH_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}
