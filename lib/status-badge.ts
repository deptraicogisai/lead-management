import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export type StatusBadgeVariant = "pill" | "solid" | "outline";

type StatusTokens = {
  background: string;
  text: string;
  border: string;
};

type StatusStyleSet = Record<StatusBadgeVariant, StatusTokens>;

const BASE_CLASS: Record<StatusBadgeVariant, string> = {
  pill: "rounded-full border-2 font-semibold",
  solid: "rounded border-2 font-bold",
  outline: "rounded-full border font-semibold",
};

function softenOutlineBorder(color: string) {
  if (color.startsWith("#") && color.length === 7) {
    return `${color}66`;
  }

  return color;
}

/** Vivid, high-contrast palette — easy to scan on white grid rows */
const STATUS_STYLES: Record<string, StatusStyleSet> = {
  active: {
    pill: { background: "#bbf7d0", text: "#14532d", border: "#16a34a" },
    solid: { background: "#16a34a", text: "#ffffff", border: "#15803d" },
    outline: { background: "#ecfdf5", text: "#14532d", border: "#16a34a" },
  },
  deleted: {
    pill: { background: "#fecaca", text: "#7f1d1d", border: "#dc2626" },
    solid: { background: "#dc2626", text: "#ffffff", border: "#b91c1c" },
    outline: { background: "#fef2f2", text: "#991b1b", border: "#dc2626" },
  },
  inactive: {
    pill: { background: "#e2e8f0", text: "#1e293b", border: "#475569" },
    solid: { background: "#475569", text: "#ffffff", border: "#334155" },
    outline: { background: "#f8fafc", text: "#334155", border: "#475569" },
  },
  paused: {
    pill: { background: "#fde68a", text: "#78350f", border: "#d97706" },
    solid: { background: "#d97706", text: "#ffffff", border: "#b45309" },
    outline: { background: "#fffbeb", text: "#92400e", border: "#d97706" },
  },
  disabled: {
    pill: { background: "#fed7aa", text: "#7c2d12", border: "#ea580c" },
    solid: { background: "#ea580c", text: "#ffffff", border: "#c2410c" },
    outline: { background: "#fff7ed", text: "#9a3412", border: "#ea580c" },
  },
  draft: {
    pill: { background: "#bae6fd", text: "#0c4a6e", border: "#0284c7" },
    solid: { background: "#0284c7", text: "#ffffff", border: "#0369a1" },
    outline: { background: "#f0f9ff", text: "#075985", border: "#0284c7" },
  },
  pending: {
    pill: { background: "#fef08a", text: "#713f12", border: "#ca8a04" },
    solid: { background: "#ca8a04", text: "#ffffff", border: "#a16207" },
    outline: { background: "#fefce8", text: "#854d0e", border: "#ca8a04" },
  },
  enabled: {
    pill: { background: "#86efac", text: "#14532d", border: "#22c55e" },
    solid: { background: "#22c55e", text: "#ffffff", border: "#16a34a" },
    outline: { background: "#f0fdf4", text: "#166534", border: "#22c55e" },
  },
  accept: {
    pill: { background: "#bbf7d0", text: "#14532d", border: "#16a34a" },
    solid: { background: "#16a34a", text: "#ffffff", border: "#15803d" },
    outline: { background: "#ecfdf5", text: "#14532d", border: "#16a34a" },
  },
  accepted: {
    pill: { background: "#bbf7d0", text: "#14532d", border: "#16a34a" },
    solid: { background: "#16a34a", text: "#ffffff", border: "#15803d" },
    outline: { background: "#ecfdf5", text: "#14532d", border: "#16a34a" },
  },
  sold: {
    pill: { background: "#5eead4", text: "#134e4a", border: "#0d9488" },
    solid: { background: "#0d9488", text: "#ffffff", border: "#0f766e" },
    outline: { background: "#f0fdfa", text: "#115e59", border: "#0d9488" },
  },
  success: {
    pill: { background: "#86efac", text: "#14532d", border: "#22c55e" },
    solid: { background: "#22c55e", text: "#ffffff", border: "#16a34a" },
    outline: { background: "#f0fdf4", text: "#166534", border: "#22c55e" },
  },
  completed: {
    pill: { background: "#bef264", text: "#365314", border: "#65a30d" },
    solid: { background: "#65a30d", text: "#ffffff", border: "#4d7c0f" },
    outline: { background: "#f7fee7", text: "#3f6212", border: "#65a30d" },
  },
  redirected: {
    pill: { background: "#93c5fd", text: "#1e3a8a", border: "#2563eb" },
    solid: { background: "#2563eb", text: "#ffffff", border: "#1d4ed8" },
    outline: { background: "#eff6ff", text: "#1e40af", border: "#2563eb" },
  },
  reject: {
    pill: { background: "#fca5a5", text: "#7f1d1d", border: "#ef4444" },
    solid: { background: "#ef4444", text: "#ffffff", border: "#dc2626" },
    outline: { background: "#fef2f2", text: "#b91c1c", border: "#ef4444" },
  },
  fail: {
    pill: { background: "#fca5a5", text: "#7f1d1d", border: "#ef4444" },
    solid: { background: "#ef4444", text: "#ffffff", border: "#dc2626" },
    outline: { background: "#fef2f2", text: "#b91c1c", border: "#ef4444" },
  },
  error: {
    pill: { background: "#fda4af", text: "#881337", border: "#f43f5e" },
    solid: { background: "#e11d48", text: "#ffffff", border: "#be123c" },
    outline: { background: "#fff1f2", text: "#9f1239", border: "#f43f5e" },
  },
  "post error": {
    pill: { background: "#fdba74", text: "#7c2d12", border: "#ea580c" },
    solid: { background: "#ea580c", text: "#ffffff", border: "#c2410c" },
    outline: { background: "#fff7ed", text: "#9a3412", border: "#ea580c" },
  },
  "not redirected": {
    pill: { background: "#d8b4fe", text: "#581c87", border: "#a855f7" },
    solid: { background: "#9333ea", text: "#ffffff", border: "#7e22ce" },
    outline: { background: "#faf5ff", text: "#6b21a8", border: "#a855f7" },
  },
  yes: {
    pill: { background: "#bbf7d0", text: "#14532d", border: "#16a34a" },
    solid: { background: "#16a34a", text: "#ffffff", border: "#15803d" },
    outline: { background: "#ecfdf5", text: "#14532d", border: "#16a34a" },
  },
  no: {
    pill: { background: "#fdba74", text: "#7c2d12", border: "#ea580c" },
    solid: { background: "#ea580c", text: "#ffffff", border: "#c2410c" },
    outline: { background: "#fff7ed", text: "#9a3412", border: "#ea580c" },
  },
  required: {
    pill: { background: "#fda4af", text: "#881337", border: "#f43f5e" },
    solid: { background: "#e11d48", text: "#ffffff", border: "#be123c" },
    outline: { background: "#fff1f2", text: "#9f1239", border: "#f43f5e" },
  },
  optional: {
    pill: { background: "#c4b5fd", text: "#4c1d95", border: "#8b5cf6" },
    solid: { background: "#7c3aed", text: "#ffffff", border: "#6d28d9" },
    outline: { background: "#f5f3ff", text: "#5b21b6", border: "#8b5cf6" },
  },
  pl: {
    pill: { background: "#6ee7b7", text: "#064e3b", border: "#10b981" },
    solid: { background: "#059669", text: "#ffffff", border: "#047857" },
    outline: { background: "#ecfdf5", text: "#065f46", border: "#10b981" },
  },
  dnpl: {
    pill: { background: "#fdba74", text: "#7c2d12", border: "#f97316" },
    solid: { background: "#f97316", text: "#ffffff", border: "#ea580c" },
    outline: { background: "#fff7ed", text: "#9a3412", border: "#f97316" },
  },
  "seller intake": {
    pill: { background: "#93c5fd", text: "#1e3a8a", border: "#3b82f6" },
    solid: { background: "#2563eb", text: "#ffffff", border: "#1d4ed8" },
    outline: { background: "#eff6ff", text: "#1e40af", border: "#3b82f6" },
  },
  "buyer delivery": {
    pill: { background: "#c4b5fd", text: "#4c1d95", border: "#8b5cf6" },
    solid: { background: "#7c3aed", text: "#ffffff", border: "#6d28d9" },
    outline: { background: "#f5f3ff", text: "#5b21b6", border: "#8b5cf6" },
  },
  "direct post": {
    pill: { background: "#a5b4fc", text: "#312e81", border: "#6366f1" },
    solid: { background: "#4f46e5", text: "#ffffff", border: "#4338ca" },
    outline: { background: "#eef2ff", text: "#3730a3", border: "#6366f1" },
  },
  "ping post": {
    pill: { background: "#67e8f9", text: "#164e63", border: "#06b6d4" },
    solid: { background: "#0891b2", text: "#ffffff", border: "#0e7490" },
    outline: { background: "#ecfeff", text: "#155e75", border: "#06b6d4" },
  },
  custom: {
    pill: { background: "#d8b4fe", text: "#581c87", border: "#a855f7" },
    solid: { background: "#9333ea", text: "#ffffff", border: "#7e22ce" },
    outline: { background: "#faf5ff", text: "#6b21a8", border: "#a855f7" },
  },
  "copied from vertical": {
    pill: { background: "#7dd3fc", text: "#0c4a6e", border: "#0ea5e9" },
    solid: { background: "#0284c7", text: "#ffffff", border: "#0369a1" },
    outline: { background: "#f0f9ff", text: "#075985", border: "#0ea5e9" },
  },
  unassigned: {
    pill: { background: "#f9a8d4", text: "#831843", border: "#ec4899" },
    solid: { background: "#db2777", text: "#ffffff", border: "#be185d" },
    outline: { background: "#fdf2f8", text: "#9d174d", border: "#ec4899" },
  },
};

const FALLBACK_KEYS = [
  "seller intake",
  "buyer delivery",
  "custom",
  "draft",
  "pending",
  "redirected",
  "not redirected",
  "unassigned",
] as const;

const STATUS_LABELS: Record<string, string> = {
  success: "Success",
  fail: "Fail",
  accept: "Accept",
  accepted: "Accepted",
  reject: "Reject",
  "post error": "Post Error",
  pl: "PL",
  dnpl: "DNPL",
  unassigned: "Unassigned",
};

export function normalizeStatusKey(status: string) {
  return status.trim().toLowerCase().replace(/\s+/g, " ");
}

function isEmptyStatusKey(key: string) {
  return !key || key === "-" || key === "—" || key === "n/a" || key === "na" || key === "none";
}

function hashStatus(status: string) {
  let hash = 0;

  for (let index = 0; index < status.length; index += 1) {
    hash = (hash * 31 + status.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function resolveStatusStyles(status: string): StatusStyleSet {
  const key = normalizeStatusKey(status);

  if (isEmptyStatusKey(key)) {
    return STATUS_STYLES.unassigned;
  }

  if (STATUS_STYLES[key]) {
    return STATUS_STYLES[key];
  }

  return STATUS_STYLES[FALLBACK_KEYS[hashStatus(key) % FALLBACK_KEYS.length]];
}

export function getStatusDisplayLabel(status: string) {
  const key = normalizeStatusKey(status);

  if (isEmptyStatusKey(key)) {
    return "Unassigned";
  }

  return STATUS_LABELS[key] ?? status;
}

export function getStatusBadgePresentation(
  status: string,
  variant: StatusBadgeVariant = "outline"
): { className: string; style: CSSProperties } {
  const tokens = resolveStatusStyles(status)[variant];
  const borderColor = variant === "outline" ? softenOutlineBorder(tokens.border) : tokens.border;

  return {
    className: cn(BASE_CLASS[variant], "inline-flex items-center whitespace-nowrap border-solid"),
    style: {
      backgroundColor: tokens.background,
      color: tokens.text,
      borderColor,
    },
  };
}
