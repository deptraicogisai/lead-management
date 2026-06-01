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

export type DocumentationErrorRow = {
  status: string;
  scenario: string;
  message: string;
};

export type CodeLanguage = "python" | "csharp" | "javascript" | "json";

export type CodeTokenStyleKey =
  | "default"
  | "comment"
  | "string"
  | "keyword"
  | "library"
  | "className"
  | "callable"
  | "number"
  | "jsonKey";

export type CodeToken = {
  text: string;
  styleKey?: CodeTokenStyleKey;
};

const CODE_TOKEN_STYLE_MAP: Record<CodeTokenStyleKey, { className: string; pdfColor: string }> = {
  default: { className: "text-slate-800", pdfColor: "#1E293B" },
  comment: { className: "text-slate-500 italic", pdfColor: "#64748B" },
  string: { className: "text-emerald-700", pdfColor: "#047857" },
  keyword: { className: "text-violet-700", pdfColor: "#6D28D9" },
  library: { className: "text-sky-700", pdfColor: "#0369A1" },
  className: { className: "text-cyan-700", pdfColor: "#0F766E" },
  callable: { className: "text-amber-700", pdfColor: "#B45309" },
  number: { className: "text-orange-700", pdfColor: "#C2410C" },
  jsonKey: { className: "text-blue-700", pdfColor: "#1D4ED8" },
};

export const CODE_THEME_BY_LANGUAGE: Record<
  CodeLanguage,
  {
    headerClassName: string;
    bodyClassName: string;
    headerBg: string;
    headerText: string;
    bodyBg: string;
    bodyText: string;
    borderColor: string;
  }
> = {
  python: {
    headerClassName: "bg-[#3776AB] text-white",
    bodyClassName: "bg-[#F4F9FF] text-slate-800",
    headerBg: "#3776AB",
    headerText: "#FFFFFF",
    bodyBg: "#F4F9FF",
    bodyText: "#1E293B",
    borderColor: "#E2E8F0",
  },
  csharp: {
    headerClassName: "bg-[#68217A] text-white",
    bodyClassName: "bg-[#FAF5FF] text-slate-800",
    headerBg: "#68217A",
    headerText: "#FFFFFF",
    bodyBg: "#FAF5FF",
    bodyText: "#1E293B",
    borderColor: "#E2E8F0",
  },
  javascript: {
    headerClassName: "bg-[#F7DF1E] text-slate-900",
    bodyClassName: "bg-[#FFFBEB] text-slate-800",
    headerBg: "#F7DF1E",
    headerText: "#0F172A",
    bodyBg: "#FFFBEB",
    bodyText: "#1E293B",
    borderColor: "#E2E8F0",
  },
  json: {
    headerClassName: "bg-slate-700 text-white",
    bodyClassName: "bg-slate-50 text-slate-800",
    headerBg: "#334155",
    headerText: "#FFFFFF",
    bodyBg: "#F8FAFC",
    bodyText: "#1E293B",
    borderColor: "#E2E8F0",
  },
};

const SAMPLE_REQUEST_OVERRIDES: Record<string, unknown> = {
  fname: "Jim",
  zip_code: "550000",
};

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

export function describeFieldCondition(field: DocumentationField) {
  if (field.type.trim().toLowerCase() === "email") {
    if (field.emailDuplicateRule?.mode === "forever") {
      return "Email must be unique forever";
    }

    if (field.emailDuplicateRule?.mode === "days" && typeof field.emailDuplicateRule.days === "number") {
      return `Email must be unique within ${field.emailDuplicateRule.days} day(s)`;
    }
  }

  if ((field.ignoreValues?.length ?? 0) > 0) {
    return `Ignore values: ${field.ignoreValues?.join(", ")}`;
  }

  return "-";
}

export function getFieldsWithConditions(fields: DocumentationField[]) {
  return fields.filter((field) => describeFieldCondition(field) !== "-");
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

export function getCodeTokenClassName(styleKey?: CodeTokenStyleKey) {
  return styleKey ? CODE_TOKEN_STYLE_MAP[styleKey].className : undefined;
}

export function getCodeTokenPdfColor(styleKey?: CodeTokenStyleKey) {
  return styleKey ? CODE_TOKEN_STYLE_MAP[styleKey].pdfColor : undefined;
}

export function tokenizeCode(code: string, language: Exclude<CodeLanguage, "json">): CodeToken[] {
  const tokenPatterns: Record<
    Exclude<CodeLanguage, "json">,
    Array<{ pattern: RegExp; styleKey: CodeTokenStyleKey }>
  > = {
    python: [
      { pattern: /#[^\n]*/y, styleKey: "comment" },
      { pattern: /"[^"\n]*"|'[^'\n]*'/y, styleKey: "string" },
      {
        pattern: /\b(import|from|as|async|await|try|except|print|return|def|class|if|elif|else|for|in|while|with|raise|True|False|None)\b/y,
        styleKey: "keyword",
      },
      { pattern: /\b(requests|response|headers|payload|url)\b/y, styleKey: "library" },
      { pattern: /\b[A-Z][A-Za-z0-9_]*\b/y, styleKey: "className" },
      { pattern: /\b[A-Za-z_][A-Za-z0-9_]*(?=\s*\()/y, styleKey: "callable" },
      { pattern: /\b\d+\b/y, styleKey: "number" },
    ],
    csharp: [
      { pattern: /\/\/[^\n]*/y, styleKey: "comment" },
      { pattern: /"[^"\n]*"/y, styleKey: "string" },
      {
        pattern: /\b(using|class|static|async|await|var|new|return|public|private|internal|protected|void|string|int|bool|true|false)\b/y,
        styleKey: "keyword",
      },
      {
        pattern: /\b(HttpClient|HttpRequestMessage|HttpMethod|StringContent|Console|Encoding)\b/y,
        styleKey: "library",
      },
      { pattern: /\b[A-Z][A-Za-z0-9_]*\b/y, styleKey: "className" },
      { pattern: /\b[A-Za-z_][A-Za-z0-9_]*(?=\s*\()/y, styleKey: "callable" },
      { pattern: /\b\d+\b/y, styleKey: "number" },
    ],
    javascript: [
      { pattern: /\/\/[^\n]*/y, styleKey: "comment" },
      { pattern: /"[^"\n]*"|'[^'\n]*'|`[^`\n]*`/y, styleKey: "string" },
      { pattern: /\b(const|let|async|await|try|catch|return|true|false|function|if|else|throw|new)\b/y, styleKey: "keyword" },
      { pattern: /\b(fetch|response|payload|headers|console|JSON)\b/y, styleKey: "library" },
      { pattern: /\b[A-Z][A-Za-z0-9_]*\b/y, styleKey: "className" },
      { pattern: /\b[A-Za-z_][A-Za-z0-9_]*(?=\s*\()/y, styleKey: "callable" },
      { pattern: /\b\d+\b/y, styleKey: "number" },
    ],
  };

  const patterns = tokenPatterns[language];
  const tokens: CodeToken[] = [];
  let cursor = 0;

  while (cursor < code.length) {
    let matched = false;

    for (const { pattern, styleKey } of patterns) {
      pattern.lastIndex = cursor;
      const result = pattern.exec(code);
      if (result && result.index === cursor) {
        tokens.push({ text: result[0], styleKey });
        cursor += result[0].length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      tokens.push({ text: code[cursor] });
      cursor += 1;
    }
  }

  return tokens;
}

export function tokenizeJson(code: string): CodeToken[] {
  const patterns: Array<{ pattern: RegExp; styleKey: CodeTokenStyleKey }> = [
    { pattern: /\/\/[^\n]*/y, styleKey: "comment" },
    { pattern: /"(?:[^"\\]|\\.)*"(?=\s*:)/y, styleKey: "jsonKey" },
    { pattern: /"(?:[^"\\]|\\.)*"/y, styleKey: "string" },
    { pattern: /\b(true|false|null)\b/y, styleKey: "keyword" },
    { pattern: /\b-?\d+(?:\.\d+)?\b/y, styleKey: "number" },
  ];

  const tokens: CodeToken[] = [];
  let cursor = 0;

  while (cursor < code.length) {
    let matched = false;

    for (const { pattern, styleKey } of patterns) {
      pattern.lastIndex = cursor;
      const result = pattern.exec(code);
      if (result && result.index === cursor) {
        tokens.push({ text: result[0], styleKey });
        cursor += result[0].length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      tokens.push({ text: code[cursor] });
      cursor += 1;
    }
  }

  return tokens;
}

export function buildOverviewParagraphs(verticalName: string) {
  return [
    `The ${verticalName} lead ingestion endpoint accepts HTTP POST requests and validates the incoming JSON payload before the lead is stored for downstream processing.`,
    "In a real-world workflow, this endpoint is used by partner systems, landing pages, or lead providers to submit lead data into the Lead Management platform in a predictable and validated format.",
  ];
}

export function buildSuccessResponse() {
  return {
    status: "success",
  };
}

export function buildErrorRows(fields: DocumentationField[]): DocumentationErrorRow[] {
  return [
    {
      status: "400 Bad Request",
      scenario: "Missing required field or invalid field value",
      message: `${fields[0]?.description || fields[0]?.fieldName || "Required field"} is required.`,
    },
    {
      status: "401 Unauthorized",
      scenario: "Missing or invalid API key",
      message: "Authentication failed. API key is required or invalid.",
    },
    {
      status: "500 Internal Server Error",
      scenario: "Unexpected server-side failure",
      message: "Unexpected server error while processing lead.",
    },
  ];
}
