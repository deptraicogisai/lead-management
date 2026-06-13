import PDFDocument from "pdfkit";
import {
  CODE_THEME_BY_LANGUAGE,
  buildCodeSnippetsMarkdown,
  buildDocumentationCodeSnippets,
  buildErrorRows,
  buildOverviewParagraphs,
  buildDocumentationOutline,
  buildLeadResponseStatusMarkdown,
  formatAcceptedValues,
  getCodeTokenPdfColor,
  tokenizeCode,
  tokenizeJson,
  type CodeLanguage,
  type CodeToken,
  type DocumentationErrorRow,
} from "@/lib/api-documentation-content";
import {
  buildDocumentationRequestTableRows,
  type DocumentationRequestTableRow,
} from "@/lib/api-documentation-requirements";
import type { MappingIntakeSettingsRecord } from "@/lib/mapping-intake-settings";
import { buildFieldExampleRequest, buildFieldExampleValue } from "@/lib/lead-field-value";

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
  options?: Array<{ label: string; value: string }>;
};

export type DocumentationContext = {
  sellerId: string;
  verticalId: string;
  verticalName: string;
  endpointUrl: string;
  apiKey: string;
  method: string;
  sellerName?: string;
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

function buildExampleValue(field: DocumentationField): unknown {
  return buildFieldExampleValue(field);
}

export function buildExampleRequest(fields: DocumentationField[]) {
  return buildFieldExampleRequest(fields);
}

function buildRequestFieldTable(
  settings: MappingIntakeSettingsRecord,
  fields: DocumentationField[]
) {
  const header = [
    "| Parameter | Type | Required | Description | Accepted Values | Requirement |",
    "| --- | --- | --- | --- | --- | --- |",
  ];

  const rows = buildDocumentationRequestTableRows(settings, fields, formatAcceptedValues).map((row) => {
    const requirement = row.requirement.replace(/\n/g, "<br>").replace(/\|/g, "\\|");
    return `| \`${row.parameter}\` | \`${row.type}\` | ${row.required} | ${row.description} | ${row.acceptedValues} | ${requirement} |`;
  });

  return [...header, ...rows].join("\n");
}

export function buildApiDocumentationMarkdown(
  context: DocumentationContext,
  fields: DocumentationField[],
  intakeSettings: MappingIntakeSettingsRecord
) {
  const exampleRequest = buildExampleRequest(fields);
  const outline = buildDocumentationOutline();
  const errorResponse = {
    status: "error",
    reasons: [{ message: `${fields[0]?.description || fields[0]?.fieldName || "Required field"} is required.` }],
  };
  const leadResponseStatusSection = buildLeadResponseStatusMarkdown(outline);

  return `## ${outline.overview.label}

The ${context.verticalName} lead ingestion endpoint accepts HTTP POST requests and validates the incoming JSON payload before the lead is stored for downstream processing.

In a real-world workflow, this endpoint is used by partner systems, landing pages, or lead providers to submit lead data into the Lead Management platform in a predictable and validated format. After each submission, the server stores the lead in the \`leads\` collection and makes it available in the \`Lead Menu\` for operational review.

## ${outline.endpointInformation.label}

- **HTTP Method:** \`POST\`
- **Endpoint URL:** \`${context.endpointUrl}\`
- **API Key:** \`${context.apiKey}\`
- **Content-Type:** \`application/json\`

## ${outline.requestBody.label}

${buildRequestFieldTable(intakeSettings, fields)}

## ${outline.exampleJsonRequest.label}

\`\`\`json
${JSON.stringify(exampleRequest, null, 2)}
\`\`\`

## ${outline.codeSnippets.label}

${buildCodeSnippetsMarkdown(context, exampleRequest)}

## ${outline.responseStatus.label}

The API returns a JSON body with a numeric \`status\` field indicating the lead processing result.

${leadResponseStatusSection}

## Validation Error Response

When request validation fails before lead processing, the API may return an error payload similar to:

\`\`\`json
${JSON.stringify(errorResponse, null, 2)}
\`\`\`

## Processing Notes

- Every submitted lead is stored in the \`leads\` collection, including failed validations for auditability.
- Saved leads are displayed in the \`Lead Menu\` inside the dashboard.
- The server automatically captures the post time as \`postedAt\`.
- The server automatically captures the request \`User-Agent\` header as \`userAgent\`.

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
  const pageBottom = doc.page.height - doc.page.margins.bottom;

  while (doc.y + height > pageBottom) {
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

function writeSubheading(doc: PDFKit.PDFDocument, text: string) {
  ensureSpace(doc, 24);
  resetTextCursor(doc);
  doc.font(FONT_BOLD).fontSize(12).fillColor("#0F172A").text(text);
  doc.moveDown(0.2);
  resetTextCursor(doc);
}

function getCodeLines(code: string) {
  return code.replace(/\r\n/g, "\n").split("\n");
}

function getLineTokens(line: string, language: CodeLanguage): CodeToken[] {
  if (language === "json") {
    return tokenizeJson(line);
  }

  return tokenizeCode(line, language);
}

function measureCodeLineHeight(
  doc: PDFKit.PDFDocument,
  line: string,
  maxWidth: number,
  fontSize: number,
  lineGap: number
) {
  doc.font(FONT_MONO).fontSize(fontSize);
  if (!line) {
    return doc.currentLineHeight() + lineGap;
  }

  return doc.heightOfString(line, { width: maxWidth, lineGap }) + lineGap;
}

function drawSyntaxHighlightedLine(
  doc: PDFKit.PDFDocument,
  line: string,
  language: CodeLanguage,
  x: number,
  y: number,
  maxWidth: number,
  defaultColor: string,
  fontSize: number
) {
  doc.font(FONT_MONO).fontSize(fontSize);

  if (!line.trim()) {
    doc.fillColor(defaultColor).text(" ", x, y, { lineBreak: false });
    return;
  }

  const tokens = getLineTokens(line, language);
  let cursorX = x;
  const rightEdge = x + maxWidth;

  for (const token of tokens) {
    const color = getCodeTokenPdfColor(token.styleKey) ?? defaultColor;
    doc.fillColor(color);

    for (const char of token.text) {
      if (char === "\n") {
        continue;
      }

      const charWidth = doc.widthOfString(char);
      if (cursorX + charWidth > rightEdge) {
        return;
      }

      doc.text(char, cursorX, y, { lineBreak: false });
      cursorX += charWidth;
    }
  }
}

function writeTintedCodeBlock(doc: PDFKit.PDFDocument, title: string, code: string, language: CodeLanguage) {
  const theme = CODE_THEME_BY_LANGUAGE[language];
  const padding = 10;
  const headerHeight = 24;
  const fontSize = 8;
  const lineGap = 1;
  const blockWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const contentWidth = blockWidth - padding * 2;
  const startX = doc.page.margins.left;
  const lines = getCodeLines(code);
  const pageBottom = () => doc.page.height - doc.page.margins.bottom;

  doc.font(FONT_MONO).fontSize(fontSize);

  let lineIndex = 0;
  let showHeader = true;

  while (lineIndex < lines.length) {
    const blockTitle = showHeader ? title : `${title} (continued)`;
    const headerSpace = showHeader ? headerHeight : 0;

    ensureSpace(doc, headerSpace + padding * 2 + doc.currentLineHeight() + lineGap);

    const blockTop = doc.y;
    let cursorY = blockTop;

    doc.save();
    doc.rect(startX, cursorY, blockWidth, headerHeight).fill(theme.headerBg);
    doc.restore();

    doc
      .fillColor(theme.headerText)
      .font(FONT_BOLD)
      .fontSize(9.5)
      .text(blockTitle, startX + padding, cursorY + 7, { width: contentWidth });

    cursorY += headerHeight;
    showHeader = false;

    const bodyTop = cursorY + padding;
    const availableHeight = pageBottom() - bodyTop - padding;
    const lineHeights: number[] = [];
    let usedHeight = 0;

    while (lineIndex + lineHeights.length < lines.length) {
      const nextLine = lines[lineIndex + lineHeights.length];
      const nextLineHeight = measureCodeLineHeight(doc, nextLine, contentWidth, fontSize, lineGap);

      if (lineHeights.length > 0 && usedHeight + nextLineHeight > availableHeight) {
        break;
      }

      if (lineHeights.length === 0 && nextLineHeight > availableHeight) {
        lineHeights.push(nextLineHeight);
        usedHeight += nextLineHeight;
        break;
      }

      lineHeights.push(nextLineHeight);
      usedHeight += nextLineHeight;
    }

    const bodyHeight = usedHeight + padding * 2;

    doc.save();
    doc.rect(startX, cursorY, blockWidth, bodyHeight).fill(theme.bodyBg);
    doc.rect(startX, blockTop, blockWidth, headerHeight + bodyHeight).lineWidth(1).stroke(theme.borderColor);
    doc.restore();

    let lineY = bodyTop;
    lineHeights.forEach((lineHeight, index) => {
      const line = lines[lineIndex + index];
      const fitsInline = doc.heightOfString(line || " ", { width: contentWidth, lineGap }) <= lineHeight + 0.5;

      if (fitsInline && line.length <= 110) {
        drawSyntaxHighlightedLine(doc, line, language, startX + padding, lineY, contentWidth, theme.bodyText, fontSize);
      } else {
        doc.fillColor(theme.bodyText).font(FONT_MONO).fontSize(fontSize).text(line || " ", startX + padding, lineY, {
          width: contentWidth,
          lineGap,
          lineBreak: true,
        });
      }

      lineY += lineHeight;
    });

    lineIndex += lineHeights.length;
    doc.y = cursorY + bodyHeight + 10;
    doc.x = startX;
    resetTextCursor(doc);
  }
}

function writeRequestBodyTable(doc: PDFKit.PDFDocument, rows: DocumentationRequestTableRow[]) {
  const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const startX = doc.page.margins.left;
  const columnWidths = [72, 44, 40, 96, 84, tableWidth - 72 - 44 - 40 - 96 - 84];
  const headers = ["Parameter", "Type", "Required", "Description", "Accepted Values", "Requirement"];
  const tableRows = rows.map((row) => [
    row.parameter,
    row.type,
    row.required,
    row.description,
    row.acceptedValues,
    row.requirement,
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
  ensureSpace(doc, getRowHeight(headers, true));

  cursorY = doc.y;
  cursorY += drawRow(headers, cursorY, true);

  tableRows.forEach((row, index) => {
    const rowHeight = getRowHeight(row);
    ensureSpace(doc, rowHeight);
    cursorY = doc.y;

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

    doc.y = cursorY + rowHeight;
    cursorY = doc.y;
  });

  doc.y = cursorY + 5;
  resetTextCursor(doc);
}

function writeErrorResponsesTable(doc: PDFKit.PDFDocument, rows: DocumentationErrorRow[]) {
  const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const startX = doc.page.margins.left;
  const columnWidths = [110, 180, tableWidth - 110 - 180];
  const headers = ["HTTP Status", "Scenario", "Example Message"];
  const tableRows = rows.map((row) => [row.status, row.scenario, row.message]);

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

  let cursorY = doc.y;
  ensureSpace(doc, getRowHeight(headers, true));

  cursorY = doc.y;
  cursorY += drawRow(headers, cursorY, true);

  tableRows.forEach((row, index) => {
    const rowHeight = getRowHeight(row);
    ensureSpace(doc, rowHeight);
    cursorY = doc.y;
    cursorY += drawRow(row, cursorY, false, index);
    doc.y = cursorY;
  });

  doc.y = cursorY + 5;
  resetTextCursor(doc);
}

export async function generateApiDocumentationPdfBuffer(
  context: DocumentationContext,
  fields: DocumentationField[],
  intakeSettings: MappingIntakeSettingsRecord
) {
  const exampleRequest = buildExampleRequest(fields);
  const errorRows = buildErrorRows(fields);
  const overviewParagraphs = buildOverviewParagraphs(context.verticalName);
  const outline = buildDocumentationOutline();
  const requestTableRows = buildDocumentationRequestTableRows(intakeSettings, fields, formatAcceptedValues);

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
  doc.y = 128;
  doc.x = doc.page.margins.left;

  writeSectionHeading(doc, outline.overview.label);
  overviewParagraphs.forEach((paragraph) => writeParagraph(doc, paragraph));

  writeSectionHeading(doc, outline.endpointInformation.label);
  writeBullet(doc, `HTTP Method: ${context.method}`);
  writeBullet(doc, `Endpoint URL: ${context.endpointUrl}`);
  writeBullet(doc, `API Key: ${context.apiKey}`);

  writeSectionHeading(doc, outline.requestBody.label);
  writeRequestBodyTable(doc, requestTableRows);

  writeSectionHeading(doc, outline.exampleJsonRequest.label);
  writeTintedCodeBlock(doc, "JSON — Example Request", JSON.stringify(exampleRequest, null, 2), "json");

  writeSectionHeading(doc, outline.codeSnippets.label);
  buildDocumentationCodeSnippets(context, exampleRequest).forEach((snippet) => {
    writeTintedCodeBlock(doc, snippet.title, snippet.code, snippet.language);
  });

  writeSectionHeading(doc, outline.responseStatus.label);
  writeParagraph(
    doc,
    "The API returns a JSON body with a numeric status field indicating the lead processing result."
  );
  writeBullet(doc, "1 — Sold: lead sold successfully; includes redirect_url.");
  writeBullet(doc, "2 — Reject: lead rejected.");
  writeBullet(doc, "3 — In Progress: lead is still being processed.");
  writeBullet(doc, "4 — Authorization Failed: API key or authorization credentials are missing or invalid.");

  outline.responseStatusItems.forEach((item) => {
    writeSubheading(doc, item.label);
    writeParagraph(doc, item.definition.description);
    writeTintedCodeBlock(
      doc,
      `${item.label} — JSON Response`,
      JSON.stringify(item.definition.example, null, 2),
      "json"
    );
  });

  writeSectionHeading(doc, outline.errorResponses.label);
  writeErrorResponsesTable(doc, errorRows);

  doc.end();
  return completion;
}
