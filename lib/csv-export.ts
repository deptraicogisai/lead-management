export function escapeCsvValue(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

export function buildCsvContent(headers: string[], rows: string[][]) {
  const lines = [headers.map(escapeCsvValue).join(",")];
  for (const row of rows) {
    lines.push(row.map((cell) => escapeCsvValue(cell)).join(","));
  }
  return lines.join("\n");
}

export function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const content = buildCsvContent(headers, rows);
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
