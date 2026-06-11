import { buildFieldExampleRequest, buildFieldExampleValue, getFieldOptionValues } from "@/lib/lead-field-value";

export type DocumentationFieldOption = {
  label: string;
  value: string;
};

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
  options?: DocumentationFieldOption[];
};

export function formatAcceptedValues(field: DocumentationField) {
  const values = getFieldOptionValues(field.options ?? []);
  return values.length > 0 ? values.join(", ") : null;
}

export function fieldHasAcceptedValues(field: DocumentationField) {
  return (field.options?.length ?? 0) > 0;
}

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

export type CodeLanguage = "python" | "csharp" | "javascript" | "php" | "java" | "json";

export type DocumentationCodeSnippet = {
  id: string;
  title: string;
  markdownLanguage: string;
  language: CodeLanguage;
  code: string;
};

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
  php: {
    headerClassName: "bg-[#777BB4] text-white",
    bodyClassName: "bg-[#F5F6FF] text-slate-800",
    headerBg: "#777BB4",
    headerText: "#FFFFFF",
    bodyBg: "#F5F6FF",
    bodyText: "#1E293B",
    borderColor: "#E2E8F0",
  },
  java: {
    headerClassName: "bg-[#ED8B00] text-white",
    bodyClassName: "bg-[#FFF7ED] text-slate-800",
    headerBg: "#ED8B00",
    headerText: "#FFFFFF",
    bodyBg: "#FFF7ED",
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

export function buildExampleRequest(fields: DocumentationField[]) {
  return buildFieldExampleRequest(fields);
}

function buildExampleValue(field: DocumentationField): unknown {
  return buildFieldExampleValue(field);
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

export function buildPhpSnippet(context: DocumentationContext, exampleRequest: Record<string, unknown>) {
  const payload = JSON.stringify(exampleRequest, null, 4);
  const method = context.method.trim().toUpperCase();

  return `<?php

$url = "${context.endpointUrl}";
$payload = <<<'JSON'
${payload}
JSON;

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "${method}");
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Content-Type: application/json",
    "x-api-key: ${context.apiKey}",
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);

$response = curl_exec($ch);
$statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "Status: {$statusCode}" . PHP_EOL;
echo $response;`;
}

export function buildJavaSnippet(context: DocumentationContext, exampleRequest: Record<string, unknown>) {
  const payloadLiteral = JSON.stringify(JSON.stringify(exampleRequest, null, 2));

  return `import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class LeadSubmission {
    public static void main(String[] args) throws Exception {
        String url = "${context.endpointUrl}";
        String payload = ${payloadLiteral};

        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Content-Type", "application/json")
            .header("x-api-key", "${context.apiKey}")
            .method("${context.method.trim().toUpperCase()}", HttpRequest.BodyPublishers.ofString(payload))
            .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        System.out.println("Status: " + response.statusCode());
        System.out.println(response.body());
    }
}`;
}

export function buildDocumentationCodeSnippets(
  context: DocumentationContext,
  exampleRequest: Record<string, unknown>
): DocumentationCodeSnippet[] {
  return [
    {
      id: "python",
      title: "Python (requests)",
      markdownLanguage: "python",
      language: "python",
      code: buildPythonSnippet(context, exampleRequest),
    },
    {
      id: "csharp",
      title: "C# (HttpClient)",
      markdownLanguage: "csharp",
      language: "csharp",
      code: buildCSharpSnippet(context, exampleRequest),
    },
    {
      id: "javascript",
      title: "JavaScript (fetch)",
      markdownLanguage: "javascript",
      language: "javascript",
      code: buildJavaScriptSnippet(context, exampleRequest),
    },
    {
      id: "php",
      title: "PHP (cURL)",
      markdownLanguage: "php",
      language: "php",
      code: buildPhpSnippet(context, exampleRequest),
    },
    {
      id: "java",
      title: "Java (HttpClient)",
      markdownLanguage: "java",
      language: "java",
      code: buildJavaSnippet(context, exampleRequest),
    },
  ];
}

export function buildCodeSnippetsMarkdown(context: DocumentationContext, exampleRequest: Record<string, unknown>) {
  return buildDocumentationCodeSnippets(context, exampleRequest)
    .map(
      (snippet) => `### ${snippet.title}

\`\`\`${snippet.markdownLanguage}
${snippet.code}
\`\`\``
    )
    .join("\n\n");
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
    php: [
      { pattern: /#[^\n]*/y, styleKey: "comment" },
      { pattern: /\/\/[^\n]*/y, styleKey: "comment" },
      { pattern: /"[^"\n]*"|'[^'\n]*'/y, styleKey: "string" },
      { pattern: /<<<'JSON'[\s\S]*?JSON;/y, styleKey: "string" },
      {
        pattern: /\b(function|echo|true|false|null|array|return|if|else|public|private|protected|class)\b/y,
        styleKey: "keyword",
      },
      { pattern: /\b(curl_init|curl_setopt|curl_exec|curl_getinfo|curl_close|PHP_EOL)\b/y, styleKey: "library" },
      { pattern: /\b[A-Za-z_][A-Za-z0-9_]*(?=\s*\()/y, styleKey: "callable" },
      { pattern: /\b\d+\b/y, styleKey: "number" },
    ],
    java: [
      { pattern: /\/\/[^\n]*/y, styleKey: "comment" },
      { pattern: /"[^"\n]*"/y, styleKey: "string" },
      {
        pattern: /\b(import|public|static|void|class|throws|new|return|String|Exception)\b/y,
        styleKey: "keyword",
      },
      {
        pattern: /\b(HttpClient|HttpRequest|HttpResponse|URI|System|BodyPublishers|BodyHandlers)\b/y,
        styleKey: "library",
      },
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

export type DocumentationSectionHeading = {
  number: string;
  title: string;
  label: string;
};

export type LeadResponseStatusDefinition = {
  statusCode: number;
  title: string;
  description: string;
  example: Record<string, unknown>;
};

export type DocumentationResponseStatusHeading = DocumentationSectionHeading & {
  definition: LeadResponseStatusDefinition;
};

export type DocumentationOutline = {
  overview: DocumentationSectionHeading;
  endpointInformation: DocumentationSectionHeading;
  requestBody: DocumentationSectionHeading;
  requirements: DocumentationSectionHeading;
  exampleJsonRequest: DocumentationSectionHeading;
  codeSnippets: DocumentationSectionHeading;
  responseStatus: DocumentationSectionHeading;
  responseStatusItems: DocumentationResponseStatusHeading[];
  errorResponses: DocumentationSectionHeading;
};

function nextSectionHeading(counter: { value: number }, title: string): DocumentationSectionHeading {
  counter.value += 1;
  const number = String(counter.value);

  return {
    number,
    title,
    label: `${number}. ${title}`,
  };
}

export function buildDocumentationOutline(): DocumentationOutline {
  const counter = { value: 0 };

  const overview = nextSectionHeading(counter, "Overview");
  const endpointInformation = nextSectionHeading(counter, "Endpoint Information");
  const requestBody = nextSectionHeading(counter, "Request Body");
  const requirements = nextSectionHeading(counter, "Requirements");
  const exampleJsonRequest = nextSectionHeading(counter, "Example JSON Request");
  const codeSnippets = nextSectionHeading(counter, "Code Snippets");
  const responseStatus = nextSectionHeading(counter, "Response Status");
  const responseStatusItems: DocumentationResponseStatusHeading[] = LEAD_RESPONSE_STATUS_DEFINITIONS.map(
    (definition, index) => {
      const number = `${responseStatus.number}.${index + 1}`;

      return {
        number,
        title: definition.title,
        label: `${number} ${definition.title}`,
        definition,
      };
    }
  );
  const errorResponses = nextSectionHeading(counter, "Error Responses");

  return {
    overview,
    endpointInformation,
    requestBody,
    requirements,
    exampleJsonRequest,
    codeSnippets,
    responseStatus,
    responseStatusItems,
    errorResponses,
  };
}

export const LEAD_RESPONSE_STATUS_DEFINITIONS: LeadResponseStatusDefinition[] = [
  {
    statusCode: 1,
    title: "Accepted",
    description: "The lead was accepted successfully. The response includes a redirect URL for the consumer.",
    example: {
      status: 1,
      status_text: "Accepted",
      redirect_url: "https://leads.system.com/redirect?id=81649f87d4e596a711d449970392ed67",
    },
  },
  {
    statusCode: 2,
    title: "Reject",
    description: "The lead was rejected and will not be sold.",
    example: {
      status: 2,
      status_text: "reject",
      reasons: [
        { message: "Email is required." },
        { message: "State filter rejected. Allowed: AK. Received: AL." },
      ],
    },
  },
  {
    statusCode: 3,
    title: "In Progress",
    description: "The lead is still being processed.",
    example: {
      status: 3,
      status_text: "In Progress",
    },
  },
  {
    statusCode: 4,
    title: "Authorization Failed",
    description: "The request failed authorization. The API key is missing or invalid.",
    example: {
      status: 4,
      errors: [
        {
          "Authorization Failed": "",
        },
      ],
    },
  },
];

export function buildSoldLeadResponse() {
  return LEAD_RESPONSE_STATUS_DEFINITIONS[0].example;
}

export function buildRejectLeadResponse() {
  return LEAD_RESPONSE_STATUS_DEFINITIONS[1].example;
}

export function buildInProgressLeadResponse() {
  return LEAD_RESPONSE_STATUS_DEFINITIONS[2].example;
}

export function buildAuthorizationFailedLeadResponse() {
  return LEAD_RESPONSE_STATUS_DEFINITIONS[3].example;
}

export function buildSuccessResponse() {
  return buildSoldLeadResponse();
}

export function buildLeadResponseStatusMarkdown(outline: DocumentationOutline) {
  const summaryTable = [
    "| Status | Name | Description |",
    "| --- | --- | --- |",
    ...LEAD_RESPONSE_STATUS_DEFINITIONS.map(
      (definition) => `| \`${definition.statusCode}\` | ${definition.title} | ${definition.description} |`
    ),
  ].join("\n");

  const examples = outline.responseStatusItems
    .map(
      (item) => `### ${item.label}

${item.definition.description}

\`\`\`json
${JSON.stringify(item.definition.example, null, 2)}
\`\`\``
    )
    .join("\n\n");

  return `${summaryTable}

${examples}`;
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
      message: '{"status":4,"errors":[{"Authorization Failed":""}]}',
    },
    {
      status: "500 Internal Server Error",
      scenario: "Unexpected server-side failure",
      message: "Unexpected server error while processing lead.",
    },
  ];
}
