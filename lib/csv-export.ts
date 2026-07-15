/** UTF-8 BOM so Excel on Windows opens the file as Unicode instead of ANSI. */
const UTF8_BOM = "\uFEFF";

function toCsvText(value: unknown) {
  if (value == null) return "";
  return typeof value === "string" ? value : String(value);
}

/**
 * Normalize characters that commonly mojibake when CSV is opened as Windows-1252.
 * Used by every `downloadCsv` caller (current page + all pages).
 */
export function normalizeCsvCell(value: unknown) {
  return toCsvText(value)
    .replace(/\u2014/g, "-") // em dash —
    .replace(/\u2013/g, "-") // en dash –
    .replace(/\u2212/g, "-") // minus −
    .replace(/\u00A0/g, " ") // non-breaking space
    .replace(/\u2026/g, "...") // ellipsis …
    .replace(/[\u2018\u2019]/g, "'") // curly single quotes
    .replace(/[\u201C\u201D]/g, '"'); // curly double quotes
}

export function escapeCsvValue(value: unknown) {
  const normalized = normalizeCsvCell(value);
  if (
    normalized.includes(",") ||
    normalized.includes('"') ||
    normalized.includes("\n") ||
    normalized.includes("\r")
  ) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

export function buildCsvContent(headers: Array<string | number>, rows: Array<Array<string | number | null | undefined>>) {
  const lines = [headers.map(escapeCsvValue).join(",")];
  for (const row of rows) {
    lines.push(row.map((cell) => escapeCsvValue(cell)).join(","));
  }
  return lines.join("\n");
}

/**
 * Shared CSV download for all list/report exports (including All Page to CSV).
 * Always writes UTF-8 with BOM + sanitized punctuation.
 */
export function downloadCsv(
  filename: string,
  headers: Array<string | number>,
  rows: Array<Array<string | number | null | undefined>>
) {
  const content = `${UTF8_BOM}${buildCsvContent(headers, rows)}`;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
