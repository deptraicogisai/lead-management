import PDFDocument from "pdfkit";
import {
  CODE_THEME_BY_LANGUAGE,
  buildErrorRows,
  buildOverviewParagraphs,
  buildSuccessResponse,
  describeFieldCondition,
  getFieldsWithConditions,
  getCodeTokenPdfColor,
  tokenizeCode,
  tokenizeJson,
  type CodeLanguage,
  type DocumentationErrorRow,
} from "@/lib/api-documentation-content";

export type DocumentationField = {
  id: string;
  fieldName: string;
  description: string;
  type: string;
  required: boolean;
  format?: string;
  emailDuplicateRule?: {
    mode: "days" | "forever";
    days?: number;
  };
  ignoreValues?: string[];
};

export type DocumentationContext = {
  sellerId: string;
  verticalId: string;
  verticalName: string;
  endpointUrl: string;
  apiKey: string;
  method: string;
  sellerName?: string;
  baseUrl?: string;
};
const SAMPLE_REQUEST_OVERRIDES: Record<string, unknown> = {
  fname: "Jim",
  zip_code: "550000",
};

// Use PDFKit's built-in fonts so PDF generation works on serverless
// environments like Vercel without depending on OS font files.
const FONT_REGULAR = "Helvetica";
const FONT_BOLD = "Helvetica-Bold";
const FONT_MONO = "Courier";

function normalizeType(type: string) {
  return type.trim().toLowerCase();
}

export function prettyType(type: string) {
  const normalized = normalizeType(type);
  if (normalized === "numberic") return "numeric";
  return normalized || "string";
}

function toCSharpHttpMethod(method: string) {
  const normalized = method.trim().toUpperCase();
  if (normalized === "POST") return "Post";
  if (normalized === "GET") return "Get";
  if (normalized === "PUT") return "Put";
  if (normalized === "DELETE") return "Delete";
  if (normalized === "PATCH") return "Patch";
  return "Post";
}

function buildExampleValue(field: DocumentationField): unknown {
  if (field.fieldName in SAMPLE_REQUEST_OVERRIDES) {
    return SAMPLE_REQUEST_OVERRIDES[field.fieldName];
  }

  const normalizedType = normalizeType(field.type);
  const normalizedFormat = field.format?.trim().toLowerCase();

  if (normalizedFormat === "email") return "jim@example.com";
  if (normalizedFormat === "e.164") return "+15551234567";
  if (normalizedType === "boolean") return true;
  if (normalizedType === "date") return "2026-04-25";
  if (normalizedType === "number" || normalizedType === "numeric" || normalizedType === "numberic") return 1000;

  if (field.fieldName.toLowerCase().includes("zip")) return "550000";
  if (field.fieldName.toLowerCase().includes("phone")) return "+15551234567";
  if (field.fieldName.toLowerCase().includes("email")) return "jim@example.com";
  if (field.fieldName.toLowerCase().includes("name")) return "Jim";

  return "sample_value";
}

export function buildExampleRequest(fields: DocumentationField[]) {
  return fields.reduce<Record<string, unknown>>((payload, field) => {
    payload[field.fieldName] = buildExampleValue(field);
    return payload;
  }, {});
}

function buildRequestFieldTable(fields: DocumentationField[]) {
  const header = [
    "| Parameter | Type | Required | Description | Condition | Sample Value |",
    "| --- | --- | --- | --- | --- | --- |",
  ];

  const rows = fields.map((field) => {
    const exampleValue = buildExampleValue(field);
    return `| \`${field.fieldName}\` | \`${prettyType(field.type)}\` | ${field.required ? "Yes" : "No"} | ${field.description || "-"} | ${describeFieldCondition(field)} | \`${JSON.stringify(exampleValue)}\` |`;
  });

  return [...header, ...rows].join("\n");
}

export function buildPythonSnippet(context: DocumentationContext, exampleRequest: Record<string, unknown>) {
  return `import requests

url = "${context.endpointUrl}"
headers = {
    "Content-Type": "application/json",
    "x-api-key": "${context.apiKey}"
}
payload = ${JSON.stringify(exampleRequest, null, 4)}

response = requests.request("${context.method}", url, headers=headers, json=payload, timeout=30)

print("Status:", response.status_code)
try:
    print(response.json())
except ValueError:
    print(response.text)`;
}

export function buildCSharpSnippet(context: DocumentationContext, exampleRequest: Record<string, unknown>) {
  const jsonBody = JSON.stringify(exampleRequest, null, 2).replace(/"/g, '\\"');

  return `using System;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;

class Program
{
    static async Task Main()
    {
        using var client = new HttpClient();
        using var request = new HttpRequestMessage(HttpMethod.${toCSharpHttpMethod(context.method)}, "${context.endpointUrl}");
        request.Headers.Add("Accept", "application/json");
        request.Headers.Add("x-api-key", "${context.apiKey}");
        request.Content = new StringContent("${jsonBody}", Encoding.UTF8, "application/json");

        using var response = await client.SendAsync(request);
        var responseBody = await response.Content.ReadAsStringAsync();

        Console.WriteLine($"Status: {(int)response.StatusCode}");
        Console.WriteLine(responseBody);
    }
}`;
}

export function buildJavaScriptSnippet(context: DocumentationContext, exampleRequest: Record<string, unknown>) {
  return `const url = "${context.endpointUrl}";
const payload = ${JSON.stringify(exampleRequest, null, 2)};

async function sendLead() {
  const response = await fetch(url, {
    method: "${context.method}",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": "${context.apiKey}",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();

  console.log("Status:", response.status);
  try {
    console.log(JSON.parse(text));
  } catch {
    console.log(text);
  }
}

sendLead().catch((error) => {
  console.error("Request failed:", error);
});`;
}

export function buildApiDocumentationMarkdown(context: DocumentationContext, fields: DocumentationField[]) {
  const exampleRequest = buildExampleRequest(fields);
  const successResponse = {
    status: "success",
  };
  const errorResponse = {
    status: "error",
    reasons: [{ message: `${fields[0]?.description || fields[0]?.fieldName || "Required field"} is required.` }],
  };
  const conditionedFields = getFieldsWithConditions(fields);
  const fieldConditionsSection =
    conditionedFields.length > 0
      ? `## Field Conditions

${conditionedFields
  .map((field) => `- \`${field.fieldName}\`: ${describeFieldCondition(field)}`)
  .join("\n")}

`
      : "";
  const conditionNotes = conditionedFields
    .map((field) => `- Field condition for \`${field.fieldName}\`: ${describeFieldCondition(field)}.`)
    .join("\n");

  return `## Overview

The ${context.verticalName} lead ingestion endpoint accepts HTTP POST requests and validates the incoming JSON payload before the lead is stored for downstream processing.

In a real-world workflow, this endpoint is used by partner systems, landing pages, or lead providers to submit lead data into the Lead Management platform in a predictable and validated format. After each submission, the server stores the lead in the \`leads\` collection and makes it available in the \`Lead Menu\` for operational review.

## Endpoint Information

- **HTTP Method:** \`POST\`
- **Endpoint URL:** \`${context.endpointUrl}\`
- **API Key:** \`${context.apiKey}\`
- **Content-Type:** \`application/json\`

## Request Body

${buildRequestFieldTable(fields)}

${fieldConditionsSection}## Example JSON Request

\`\`\`json
${JSON.stringify(exampleRequest, null, 2)}
\`\`\`

## Code Snippets

### Python (requests)

\`\`\`python
${buildPythonSnippet(context, exampleRequest)}
\`\`\`

### C# (HttpClient)

\`\`\`csharp
${buildCSharpSnippet(context, exampleRequest)}
\`\`\`

### JavaScript (fetch)

\`\`\`javascript
${buildJavaScriptSnippet(context, exampleRequest)}
\`\`\`

## Example Response

### Success Response

\`\`\`json
${JSON.stringify(successResponse, null, 2)}
\`\`\`

### Error Response

\`\`\`json
${JSON.stringify(errorResponse, null, 2)}
\`\`\`

## Processing Notes

- Every submitted lead is stored in the \`leads\` collection, including failed validations for auditability.
- Saved leads are displayed in the \`Lead Menu\` inside the dashboard.
- The server automatically captures the post time as \`postedAt\`.
- The server automatically captures the request \`User-Agent\` header as \`userAgent\`.
${conditionNotes ? `${conditionNotes}
` : ""}

## Error Handling

- **400 Bad Request**: The JSON payload is malformed, a required field is missing, or a field value does not match the configured type or format.
- **401 Unauthorized**: The request was rejected by the authentication layer because the API key or authorization credentials are missing or invalid.
- **500 Internal Server Error**: The server encountered an unexpected issue while validating or storing the lead.

## Notes / Best Practices

- Validate required fields before calling the API to reduce avoidable 400 responses.
- Match each value to the configured field type and format, especially for dates, email addresses, phone numbers, and numeric fields.
- Send requests over HTTPS only and store your API key securely on the server side.
- Avoid exposing API credentials in browser code, public repositories, client logs, or analytics tools.`;
}

function ensureSpace(doc: PDFKit.PDFDocument, height: number) {
  const bottomMargin = doc.page.margins.bottom;
  if (doc.y + height > doc.page.height - bottomMargin) {
    doc.addPage();
  }
}

function resetTextCursor(doc: PDFKit.PDFDocument) {
  doc.x = doc.page.margins.left;
}

function writeSectionHeading(doc: PDFKit.PDFDocument, text: string) {
  ensureSpace(doc, 28);
  resetTextCursor(doc);
  doc.moveDown(0.35);
  doc.font(FONT_BOLD).fontSize(16).fillColor("#0F172A").text(text);
  doc.moveDown(0.1);
  resetTextCursor(doc);
}

function writeParagraph(doc: PDFKit.PDFDocument, text: string) {
  resetTextCursor(doc);
  doc.font(FONT_REGULAR).fontSize(10.5).fillColor("#334155").text(text, {
    lineGap: 2,
  });
  doc.moveDown(0.35);
  resetTextCursor(doc);
}

function writeBullet(doc: PDFKit.PDFDocument, text: string) {
  resetTextCursor(doc);
  doc.font(FONT_REGULAR).fontSize(10.5).fillColor("#334155").text(`• ${text}`, {
    indent: 10,
    lineGap: 2,
  });
  doc.moveDown(0.15);
  resetTextCursor(doc);
}

function getCodeTokens(code: string, language: CodeLanguage) {
  return language === "json" ? tokenizeJson(code) : tokenizeCode(code, language);
}

function measureHighlightedCodeHeight(
  doc: PDFKit.PDFDocument,
  code: string,
  language: CodeLanguage,
  maxWidth: number,
  fontSize: number,
  lineGap: number
) {
  doc.font(FONT_MONO).fontSize(fontSize);
  const tokens = getCodeTokens(code, language);
  const lineHeight = doc.currentLineHeight() + lineGap;
  const startX = 0;
  let x = startX;
  let y = 0;

  for (const token of tokens) {
    for (const char of token.text) {
      if (char === "\n") {
        x = startX;
        y += lineHeight;
        continue;
      }

      const width = doc.widthOfString(char);
      if (x > startX && x + width > maxWidth) {
        x = startX;
        y += lineHeight;
      }

      x += width;
    }
  }

  return y + doc.currentLineHeight();
}

function drawHighlightedCode(
  doc: PDFKit.PDFDocument,
  code: string,
  language: CodeLanguage,
  startX: number,
  startY: number,
  maxWidth: number,
  defaultColor: string,
  fontSize: number,
  lineGap: number
) {
  doc.font(FONT_MONO).fontSize(fontSize);
  const tokens = getCodeTokens(code, language);
  const lineHeight = doc.currentLineHeight() + lineGap;
  const lineStartX = startX;
  let x = lineStartX;
  let y = startY;

  for (const token of tokens) {
    const color = getCodeTokenPdfColor(token.styleKey) ?? defaultColor;

    for (const char of token.text) {
      if (char === "\n") {
        x = lineStartX;
        y += lineHeight;
        continue;
      }

      const width = doc.widthOfString(char);
      if (x > lineStartX && x + width > lineStartX + maxWidth) {
        x = lineStartX;
        y += lineHeight;
      }

      doc.fillColor(color).text(char, x, y, { lineBreak: false });
      x += width;
    }
  }
}

function writeTintedCodeBlock(doc: PDFKit.PDFDocument, title: string, code: string, language: CodeLanguage) {
  const padding = 10;
  const fontSize = 9;
  const lineGap = 2;
  const blockWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const theme = CODE_THEME_BY_LANGUAGE[language];
  const textHeight = measureHighlightedCodeHeight(doc, code, language, blockWidth - padding * 2, fontSize, lineGap);
  const headerHeight = 26;
  const totalHeight = headerHeight + textHeight + padding * 2;

  ensureSpace(doc, totalHeight + 4);

  const startX = doc.page.margins.left;
  const startY = doc.y;
  doc.roundedRect(startX, startY, blockWidth, totalHeight, 16).fillAndStroke(theme.bodyBg, theme.borderColor);
  doc.save();
  doc.roundedRect(startX, startY, blockWidth, headerHeight, 16).clip();
  doc.rect(startX, startY, blockWidth, headerHeight).fill(theme.headerBg);
  doc.restore();
  doc.fillColor(theme.headerText).font(FONT_BOLD).fontSize(10).text(title, startX + padding, startY + 8, {
    width: blockWidth - padding * 2,
  });
  drawHighlightedCode(
    doc,
    code,
    language,
    startX + padding,
    startY + headerHeight + padding,
    blockWidth - padding * 2,
    theme.bodyText,
    fontSize,
    lineGap
  );
  doc.y = startY + totalHeight + 5;
  resetTextCursor(doc);
}

function writeRequestBodyTable(doc: PDFKit.PDFDocument, fields: DocumentationField[]) {
  const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const startX = doc.page.margins.left;
  const columnWidths = [112, 72, 58, 150, tableWidth - 112 - 72 - 58 - 150];
  const headers = ["Parameter", "Type", "Required", "Description", "Condition"];
  const rows = fields.map((field) => [
    field.fieldName,
    prettyType(field.type),
    field.required ? "Yes" : "No",
    field.description || "-",
    describeFieldCondition(field),
  ]);

  const getRowHeight = (values: string[], isHeader = false) => {
    const paddingY = isHeader ? 8 : 7;
    const fontSize = isHeader ? 9.5 : 9;
    doc.font(isHeader ? FONT_BOLD : FONT_REGULAR).fontSize(fontSize);

    const contentHeight = values.reduce((max, value, index) => {
      const height = doc.heightOfString(value, {
        width: columnWidths[index] - 12,
        lineGap: 2,
      });
      return Math.max(max, height);
    }, 0);

    return contentHeight + paddingY * 2;
  };

  const drawRow = (values: string[], y: number, isHeader = false) => {
    const rowHeight = getRowHeight(values, isHeader);
    let currentX = startX;

    values.forEach((value, index) => {
      doc
        .rect(currentX, y, columnWidths[index], rowHeight)
        .fillAndStroke(isHeader ? "#E2E8F0" : "#FFFFFF", "#CBD5E1");

      doc
        .font(isHeader ? FONT_BOLD : FONT_REGULAR)
        .fontSize(isHeader ? 9.5 : 9)
        .fillColor(isHeader ? "#0F172A" : "#334155")
        .text(value, currentX + 6, y + (isHeader ? 8 : 7), {
          width: columnWidths[index] - 12,
          lineGap: 2,
        });

      currentX += columnWidths[index];
    });

    return rowHeight;
  };

  let cursorY = doc.y;
  const headerHeight = getRowHeight(headers, true);
  const rowsHeight = rows.reduce((total, row) => total + getRowHeight(row), 0);
  ensureSpace(doc, headerHeight + rowsHeight + 8);

  cursorY += drawRow(headers, cursorY, true);
  rows.forEach((row, index) => {
    const rowHeight = getRowHeight(row);
    let currentX = startX;

    row.forEach((value, cellIndex) => {
      doc
        .rect(currentX, cursorY, columnWidths[cellIndex], rowHeight)
        .fillAndStroke(index % 2 === 0 ? "#FFFFFF" : "#F8FAFC", "#E2E8F0");

      doc
        .font(FONT_REGULAR)
        .fontSize(9)
        .fillColor("#334155")
        .text(value, currentX + 6, cursorY + 7, {
          width: columnWidths[cellIndex] - 12,
          lineGap: 2,
        });

      currentX += columnWidths[cellIndex];
    });

    cursorY += rowHeight;
  });

  doc.y = cursorY + 5;
  resetTextCursor(doc);
}

function writeErrorResponsesTable(doc: PDFKit.PDFDocument, rows: DocumentationErrorRow[]) {
  const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const startX = doc.page.margins.left;
  const columnWidths = [110, 180, tableWidth - 110 - 180];
  const headers = ["HTTP Status", "Scenario", "Example Message"];

  const getRowHeight = (values: string[], isHeader = false) => {
    const paddingY = isHeader ? 8 : 7;
    const fontSize = isHeader ? 9.5 : 9;
    doc.font(isHeader ? FONT_BOLD : FONT_REGULAR).fontSize(fontSize);

    const contentHeight = values.reduce((max, value, index) => {
      const height = doc.heightOfString(value, {
        width: columnWidths[index] - 12,
        lineGap: 2,
      });
      return Math.max(max, height);
    }, 0);

    return contentHeight + paddingY * 2;
  };

  let cursorY = doc.y;
  const headerHeight = getRowHeight(headers, true);
  const tableRows = rows.map((row) => [row.status, row.scenario, row.message]);
  const rowsHeight = tableRows.reduce((total, row) => total + getRowHeight(row), 0);
  ensureSpace(doc, headerHeight + rowsHeight + 8);

  const drawRow = (values: string[], y: number, isHeader = false, index = 0) => {
    const rowHeight = getRowHeight(values, isHeader);
    let currentX = startX;

    values.forEach((value, cellIndex) => {
      doc
        .rect(currentX, y, columnWidths[cellIndex], rowHeight)
        .fillAndStroke(isHeader ? "#E2E8F0" : index % 2 === 0 ? "#FFFFFF" : "#F8FAFC", "#E2E8F0");

      doc
        .font(isHeader ? FONT_BOLD : FONT_REGULAR)
        .fontSize(isHeader ? 9.5 : 9)
        .fillColor(isHeader ? "#0F172A" : "#334155")
        .text(value, currentX + 6, y + (isHeader ? 8 : 7), {
          width: columnWidths[cellIndex] - 12,
          lineGap: 2,
        });

      currentX += columnWidths[cellIndex];
    });

    return rowHeight;
  };

  cursorY += drawRow(headers, cursorY, true);
  tableRows.forEach((row, index) => {
    cursorY += drawRow(row, cursorY, false, index);
  });

  doc.y = cursorY + 5;
  resetTextCursor(doc);
}

export async function generateApiDocumentationPdfBuffer(
  context: DocumentationContext,
  fields: DocumentationField[]
) {
  const exampleRequest = buildExampleRequest(fields);
  const successResponse = buildSuccessResponse();
  const errorRows = buildErrorRows(fields);
  const overviewParagraphs = buildOverviewParagraphs(context.verticalName);
  const conditionedFields = getFieldsWithConditions(fields);

  const doc = new PDFDocument({
    size: "A4",
    font: FONT_REGULAR,
    margins: { top: 56, right: 52, bottom: 56, left: 52 },
    info: {
      Title: `${context.verticalName} API Documentation`,
      Author: "Cursor",
      Subject: "API Documentation",
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));

  const completion = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.rect(0, 0, doc.page.width, 120).fill("#1D4ED8");
  doc.fillColor("#FFFFFF").font(FONT_BOLD).fontSize(22).text("API Documentation", 52, 42);
  doc
    .font(FONT_REGULAR)
    .fontSize(10.5)
    .text(`Seller: ${context.sellerName ?? context.sellerId}  |  Vertical: ${context.verticalName}`, 52, 76);
  doc.moveDown(2.2);
  resetTextCursor(doc);

  writeSectionHeading(doc, "Overview");
  overviewParagraphs.forEach((paragraph) => writeParagraph(doc, paragraph));

  writeSectionHeading(doc, "Endpoint Information");
  writeBullet(doc, `HTTP Method: ${context.method}`);
  writeBullet(doc, `Base URL: ${context.baseUrl ?? "-"}`);
  writeBullet(doc, `Endpoint URL: ${context.endpointUrl}`);
  writeBullet(doc, `API Key: ${context.apiKey}`);

  writeSectionHeading(doc, "Request Body");
  writeRequestBodyTable(doc, fields);

  if (conditionedFields.length > 0) {
    writeSectionHeading(doc, "Field Conditions");
    conditionedFields.forEach((field) => {
      writeBullet(doc, `${field.fieldName}: ${describeFieldCondition(field)}`);
    });
  }

  writeSectionHeading(doc, "Example JSON Request");
  writeTintedCodeBlock(doc, "JSON", JSON.stringify(exampleRequest, null, 2), "json");

  writeSectionHeading(doc, "Code Snippets");
  writeTintedCodeBlock(doc, "Python", buildPythonSnippet(context, exampleRequest), "python");
  writeTintedCodeBlock(doc, "C#", buildCSharpSnippet(context, exampleRequest), "csharp");
  writeTintedCodeBlock(doc, "JavaScript", buildJavaScriptSnippet(context, exampleRequest), "javascript");

  writeSectionHeading(doc, "Example Response");
  doc.font(FONT_BOLD).fontSize(12).fillColor("#0F172A").text("Success Response");
  doc.moveDown(0.1);
  writeTintedCodeBlock(doc, "JSON", JSON.stringify(successResponse, null, 2), "json");

  writeSectionHeading(doc, "Error Responses");
  writeErrorResponsesTable(doc, errorRows);

  doc.end();
  return completion;
}
