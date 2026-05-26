# SpecAudit: OpenAPI Contract Auditor
## Finalized Implementation Blueprint
**Agent Target:** DeepSeek V4 Flash via OpenCode  
**Stack:** .NET 10 Minimal APIs · ReactJS 19 (Vite + Tailwind CSS) · Any OpenAI-compatible AI Provider  
**AI Integration:** Provider-agnostic via the OpenAI C# client. Switch providers by changing three lines in `appsettings.json` and one user-secret — zero code changes required.

---

> **Agent Instructions:** Execute all ten steps in strict chronological order. Do not begin a step until the previous step's completion condition is verified. Steps marked with 🔍 **Review Gate** require the generated code to be reviewed by a secondary agent or human before proceeding. Never store an API key in source code. All code blocks in this blueprint are architectural contracts — implement them exactly unless a note explicitly allows deviation.

---

## Part 1: Monorepo Directory Structure

Create this structure before writing any code. All paths in subsequent steps are relative to `spec-audit/`.

```
spec-audit/
├── .opencode/
│   └── agents/
│       ├── reviewer.md
│       └── tester.md
│
├── backend/
│   ├── src/
│   │   ├── Configuration/
│   │   │   └── AiOptions.cs
│   │   ├── Endpoints/
│   │   │   └── AuditEndpoints.cs
│   │   ├── Models/
│   │   │   ├── Requests/
│   │   │   │   └── AuditRequest.cs
│   │   │   └── Responses/
│   │   │       └── AuditResponse.cs
│   │   └── Services/
│   │       └── SpecAuditService.cs
│   ├── backend.csproj
│   ├── Program.cs
│   ├── appsettings.json
│   └── appsettings.Development.json
│
├── backend.Tests/
│   ├── EndpointValidationTests.cs
│   ├── AiOptionsValidationTests.cs
│   ├── UserMessageBuilderTests.cs
│   └── backend.Tests.csproj
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── auditClient.ts
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   └── Spinner.tsx
│   │   │   └── features/
│   │   │       ├── InputPanel.tsx
│   │   │       └── ResultPanel.tsx
│   │   ├── hooks/
│   │   │   └── useAudit.ts
│   │   ├── types/
│   │   │   └── audit.ts
│   │   ├── utils/
│   │   │   ├── parseSSEChunks.ts
│   │   │   ├── parseSeverity.ts
│   │   │   └── __tests__/
│   │   │       ├── parseSSEChunks.test.ts
│   │   │       └── parseSeverity.test.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── .gitignore
├── docker-compose.yml
├── opencode.json
├── SpecAudit_Implementation_Blueprint.md
└── README.md
```

---

## Part 2: Backend Architecture Reference

The agent must implement these constraints exactly. This section is the authoritative reference for all backend code generated in Steps 1–3.

### 2.1 Configuration Model (`AiOptions.cs`)

```csharp
namespace SpecAudit.Configuration;

public sealed class AiOptions
{
    public string ApiKey { get; init; } = string.Empty;
    public string BaseUrl { get; init; } = string.Empty;   // Required — no default, must be set in appsettings.json
    public string ModelId { get; init; } = string.Empty;   // Required — no default, must be set in appsettings.json
    public string ProviderName { get; init; } = "Custom";  // Display/logging only — does not affect runtime behavior
    public int MaxTokens { get; init; } = 4096;
    public int MaxInputLength { get; init; } = 100_000;    // ~25k tokens; safe ceiling for large OpenAPI payloads
}
```

**Design note:** `BaseUrl` and `ModelId` have no hardcoded defaults. This is intentional — the class makes no assumption about the provider. If either is missing at startup, the `OpenAIClient` will fail fast on the first request with a clear error rather than silently sending to the wrong endpoint.

**Startup validation (add to `Program.cs` before `app.Run()`):**
```csharp
var aiOptions = app.Services.GetRequiredService<IOptions<AiOptions>>().Value;
if (string.IsNullOrWhiteSpace(aiOptions.BaseUrl) || string.IsNullOrWhiteSpace(aiOptions.ModelId))
    throw new InvalidOperationException("Ai:BaseUrl and Ai:ModelId must be configured in appsettings.json.");
```

**Critical note on `MaxInputLength`:** Set at 100,000 characters (~25k tokens). This is a safe ceiling for enterprise-grade OpenAPI specs and fits comfortably within the context windows of all supported providers (Groq: 128k, NVIDIA NIM: 32k, OpenRouter: model-dependent). Payloads exceeding this limit must be rejected with HTTP 413 before reaching the AI client.

### 2.2 Request/Response DTOs

```csharp
// Models/Requests/AuditRequest.cs
namespace SpecAudit.Models.Requests;

public sealed record AuditRequest(
    string Spec,           // Raw OpenAPI YAML or JSON string
    string? SpecFormat     // "yaml" | "json" — optional hint, defaults to auto-detect
);
```

```csharp
// Models/Responses/AuditResponse.cs
namespace SpecAudit.Models.Responses;

public sealed record AuditResponse(string Content);
```

### 2.3 `Program.cs` — Composition Root Only

`Program.cs` must contain only service registration and middleware pipeline setup. No business logic.

```csharp
using SpecAudit.Configuration;
using SpecAudit.Endpoints;
using SpecAudit.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<AiOptions>(builder.Configuration.GetSection("Ai"));
builder.Services.AddSingleton<SpecAuditService>();
builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyMethod()
              .AllowAnyHeader());
});

var app = builder.Build();
app.UseCors("FrontendPolicy");
app.MapAuditEndpoints();
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

// Fail fast if provider is not configured
var aiOptions = app.Services.GetRequiredService<IOptions<AiOptions>>().Value;
if (string.IsNullOrWhiteSpace(aiOptions.BaseUrl) || string.IsNullOrWhiteSpace(aiOptions.ModelId))
    throw new InvalidOperationException("Ai:BaseUrl and Ai:ModelId must be configured in appsettings.json.");

app.Run("http://+:5000");
// http://+:5000 binds all interfaces — works for local dev (localhost:5000) and Docker.
// Do NOT use http://localhost:5000 — that only binds loopback and breaks Docker networking.
```

### 2.4 Endpoint Registration (`AuditEndpoints.cs`)

```csharp
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using SpecAudit.Models.Requests;
using SpecAudit.Services;

namespace SpecAudit.Endpoints;

public static class AuditEndpoints
{
    public static void MapAuditEndpoints(this WebApplication app)
    {
        app.MapPost("/api/audit", async (
            [FromBody] AuditRequest request,
            SpecAuditService auditService,
            HttpContext httpContext,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(request.Spec))
                return Results.BadRequest(new { error = "Spec payload cannot be empty." });

            if (request.Spec.Length > auditService.MaxInputLength)
                return Results.StatusCode(413);  // Payload Too Large

            httpContext.Response.ContentType = "text/event-stream";
            httpContext.Response.Headers.CacheControl = "no-cache";
            httpContext.Response.Headers.Connection = "keep-alive";

            // Each chunk is JSON-encoded before being written to the SSE frame.
            // LLM tokens frequently contain \n characters (e.g. markdown line breaks).
            // Raw \n in a `data:` field breaks the SSE protocol — our frontend parser
            // splits on \n and would silently drop everything after the embedded newline.
            // JSON.Serialize escapes \n → \\n, making the payload safe to transport.
            try
            {
                await foreach (var chunk in auditService.AuditAsync(request, ct))
                {
                    var encoded = JsonSerializer.Serialize(chunk);
                    await httpContext.Response.WriteAsync($"data: {encoded}\n\n", ct);
                    await httpContext.Response.Body.FlushAsync(ct);
                }
            }
            catch (OperationCanceledException)
            {
                // Client disconnected — normal abort, do not write error sentinel.
            }
            catch (Exception ex)
            {
                // Emit the error sentinel so the frontend can display a typed error
                // rather than seeing an abrupt TCP close and showing a generic network error.
                var sentinel = JsonSerializer.Serialize(
                    $"[SPECAUDIT_ERROR] {ex.Message}");
                await httpContext.Response.WriteAsync($"data: {sentinel}\n\n", ct);
                await httpContext.Response.Body.FlushAsync(ct);
            }

            return Results.Empty;
        });

        // Returns the active provider name for display in the frontend header.
        // This is the only endpoint that exposes configuration — it never returns the API key.
        app.MapGet("/api/config", (IOptions<AiOptions> options) =>
            Results.Ok(new { providerName = options.Value.ProviderName }));
    }
}
```

### 2.5 API Key Handling

- **Development only:** `dotnet user-secrets init` then `dotnet user-secrets set "Ai:ApiKey" "your-key-here"`
- **Production:** Environment variable `Ai__ApiKey` (double underscore = nested config in .NET)
- `appsettings.json` must contain `BaseUrl`, `ModelId`, `ProviderName`, `MaxTokens`, `MaxInputLength` only — never the key
- `appsettings.Development.json` must be empty `{}`

---

## Part 3: Frontend Architecture Reference

### 3.1 Vite Proxy Configuration (`vite.config.ts`)

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:5000'
    }
  }
});
```

The frontend must never contain a hardcoded backend URL. All `/api/*` calls go through this proxy during development.

### 3.2 Shared Types (`types/audit.ts`)

```typescript
export interface AuditRequest {
  spec: string;
  specFormat?: 'yaml' | 'json';
}

export type AuditStatus = 'idle' | 'loading' | 'streaming' | 'complete' | 'error';

export interface AuditState {
  status: AuditStatus;
  result: string;
  error: string | null;
}

// Severity levels parsed from the streamed markdown output
export type SeverityLevel = 'CRITICAL' | 'WARNING' | 'INFO';
```

### 3.3 API Client (`api/auditClient.ts`)

```typescript
import type { AuditRequest } from '../types/audit';
import { parseSSEChunks } from '../utils/parseSSEChunks';

export async function auditStream(
  payload: AuditRequest,
  onChunk: (chunk: string) => void,
  signal: AbortSignal
): Promise<void> {
  const response = await fetch('/api/audit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Audit failed (${response.status}): ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Response body is not readable.');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const { chunks, remainingBuffer } = parseSSEChunks(
      buffer,
      decoder.decode(value, { stream: true })
    );
    buffer = remainingBuffer;

    for (const rawChunk of chunks) {
      if (!rawChunk.trim()) continue;

      // Each SSE payload is JSON-encoded by the backend to safely transport
      // newline characters embedded in LLM markdown tokens.
      // JSON.parse here is the counterpart to JsonSerializer.Serialize on the backend.
      const chunk: string = JSON.parse(rawChunk);

      if (chunk.startsWith('[SPECAUDIT_ERROR]')) {
        throw new Error(chunk.replace('[SPECAUDIT_ERROR]', '').trim());
      }
      onChunk(chunk);
    }
  }
}
```

### 3.6 Pure Utility Functions (`utils/`)

These two functions are extracted from their consumer components specifically to make them independently testable. They contain no I/O, no React, no side effects.

**`utils/parseSSEChunks.ts`**

```typescript
export interface SSEParseResult {
  chunks: string[];
  remainingBuffer: string;
}

/**
 * Extracts complete SSE "data: ..." lines from a streaming buffer.
 * Holds the last incomplete line in the buffer for the next call.
 * This is a pure function — deterministic, no side effects, no I/O.
 */
export function parseSSEChunks(buffer: string, incoming: string): SSEParseResult {
  const combined = buffer + incoming;
  const lines = combined.split('\n');
  const remainingBuffer = lines.pop() ?? '';

  const chunks: string[] = [];
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      chunks.push(line.slice(6));
    }
  }

  return { chunks, remainingBuffer };
}
```

**`utils/parseSeverity.ts`**

```typescript
import type { SeverityLevel } from '../types/audit';

/**
 * Identifies severity level from a react-markdown h3 heading string.
 * Returns null for any heading that is not a finding block.
 * Pure function — extracted from ResultPanel for testability.
 */
export function parseSeverity(text: string): SeverityLevel | null {
  if (text.includes('[CRITICAL]')) return 'CRITICAL';
  if (text.includes('[WARNING]'))  return 'WARNING';
  if (text.includes('[INFO]'))     return 'INFO';
  return null;
}
```

**Update `ResultPanel.tsx`:** Import `parseSeverity` from `'../utils/parseSeverity'` rather than defining it inline. The function body in Part 3.5 is replaced by this import.

### 3.4 Custom Hook (`hooks/useAudit.ts`)

```typescript
import { useCallback, useRef, useState } from 'react';
import { auditStream } from '../api/auditClient';
import type { AuditRequest, AuditState } from '../types/audit';

export function useAudit() {
  const [state, setState] = useState<AuditState>({
    status: 'idle',
    result: '',
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);

  const audit = useCallback(async (payload: AuditRequest) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setState({ status: 'loading', result: '', error: null });

    try {
      setState(s => ({ ...s, status: 'streaming' }));
      await auditStream(
        payload,
        (chunk) => setState(s => ({ ...s, result: s.result + chunk })),
        abortRef.current.signal
      );
      setState(s => ({ ...s, status: 'complete' }));
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setState(s => ({ ...s, status: 'idle' }));
      } else {
        setState(s => ({
          ...s,
          status: 'error',
          error: (err as Error).message,
        }));
      }
    }
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({ status: 'idle', result: '', error: null });
  }, []);

  return { state, audit, abort, reset };
}
```

### 3.5 Severity Tag Parsing and Tailwind Styling

The model output uses `### [CRITICAL]`, `### [WARNING]`, and `### [INFO]` as section headers.
`ResultPanel.tsx` must intercept H3 nodes from `react-markdown` and apply conditional Tailwind styling.

**Install required packages:**
```bash
npm install react-markdown remark-gfm
```

**Severity style map (implement exactly):**

| Tag | Border | Background | Badge text | Badge bg |
|---|---|---|---|---|
| `[CRITICAL]` | `border-red-500` | `bg-red-950/40` | `text-red-300` | `bg-red-500/20` |
| `[WARNING]` | `border-amber-500` | `bg-amber-950/40` | `text-amber-300` | `bg-amber-500/20` |
| `[INFO]` | `border-blue-400` | `bg-blue-950/40` | `text-blue-300` | `bg-blue-400/20` |

**`ResultPanel.tsx` implementation:**

```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { SeverityLevel } from '../../types/audit';

interface Props {
  content: string;
  isStreaming: boolean;
}

const SEVERITY_STYLES: Record<SeverityLevel, {
  wrapper: string;
  badge: string;
  label: string;
}> = {
  CRITICAL: {
    wrapper: 'border-l-4 border-red-500 bg-red-950/40 rounded-r-lg px-4 py-3 mb-3',
    badge:   'inline-block text-xs font-bold text-red-300 bg-red-500/20 px-2 py-0.5 rounded mr-2',
    label:   'text-red-300',
  },
  WARNING: {
    wrapper: 'border-l-4 border-amber-500 bg-amber-950/40 rounded-r-lg px-4 py-3 mb-3',
    badge:   'inline-block text-xs font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded mr-2',
    label:   'text-amber-300',
  },
  INFO: {
    wrapper: 'border-l-4 border-blue-400 bg-blue-950/40 rounded-r-lg px-4 py-3 mb-3',
    badge:   'inline-block text-xs font-bold text-blue-300 bg-blue-400/20 px-2 py-0.5 rounded mr-2',
    label:   'text-blue-300',
  },
};

function parseSeverity(text: string): SeverityLevel | null {
  if (text.includes('[CRITICAL]')) return 'CRITICAL';
  if (text.includes('[WARNING]'))  return 'WARNING';
  if (text.includes('[INFO]'))     return 'INFO';
  return null;
}

export function ResultPanel({ content, isStreaming }: Props) {
  return (
    <div className="w-full mt-6 font-mono text-sm text-slate-200">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h3({ children }) {
            const text = String(children);
            const severity = parseSeverity(text);
            const cleanTitle = text
              .replace('[CRITICAL]', '')
              .replace('[WARNING]', '')
              .replace('[INFO]', '')
              .trim();

            if (severity) {
              const styles = SEVERITY_STYLES[severity];
              return (
                <div className={styles.wrapper}>
                  <span className={styles.badge}>{severity}</span>
                  <span className={`font-semibold ${styles.label}`}>{cleanTitle}</span>
                </div>
              );
            }
            // Default H3 (e.g., "## Summary" section headers)
            return <h3 className="text-slate-100 font-semibold text-base mt-6 mb-2">{children}</h3>;
          },
          code({ children, className }) {
            const isBlock = className?.includes('language-');
            return isBlock
              ? <pre className="bg-slate-900 border border-slate-700 rounded-lg p-4 overflow-x-auto my-3 text-xs text-slate-300"><code>{children}</code></pre>
              : <code className="bg-slate-800 text-amber-300 px-1.5 py-0.5 rounded text-xs">{children}</code>;
          },
          hr() {
            return <hr className="border-slate-700 my-4" />;
          },
          strong({ children }) {
            return <strong className="text-slate-100 font-semibold">{children}</strong>;
          },
          p({ children }) {
            return <p className="text-slate-400 text-sm leading-relaxed mb-2">{children}</p>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-2 h-4 bg-slate-400 animate-pulse ml-1 align-text-bottom" />
      )}
    </div>
  );
}
```

---

## Part 4: The NIM System Prompt (Step 3 Core Asset)

This prompt is the most critical artifact in the entire project. It must be stored as a `private const string` inside `SpecAuditService`. It must not be configurable via `appsettings.json`. Do not truncate or paraphrase it during implementation.

```
You are a strict API Governance Architect performing a formal security and design audit of an OpenAPI specification. Your role is regulatory, not advisory. You identify violations, not suggestions.

Analyze the provided OpenAPI YAML or JSON specification and produce a structured audit report. You must examine every path, method, parameter, response, schema, and security definition present in the spec.

Check for ALL of the following categories without exception:

SECURITY CHECKS:
- Absence of a global or operation-level securitySchemes definition
- Endpoints that mutate state (POST, PUT, PATCH, DELETE) with no security requirement
- Use of HTTP instead of HTTPS in server URLs
- API keys passed as query parameters instead of headers
- Missing or overly permissive CORS definitions
- Absence of rate limiting headers in response definitions (X-RateLimit-*)
- JWT/OAuth scopes that are too broad or undefined

REST CONVENTION CHECKS:
- Resource names using verbs instead of nouns (e.g., /getUser instead of /users/{id})
- Incorrect HTTP method usage (e.g., GET used for state-changing operations)
- Missing plural resource naming for collection endpoints
- Nested resource paths exceeding 3 levels of depth
- Non-standard success status codes (e.g., 200 returned for resource creation instead of 201)
- Missing 404 response definition on endpoints with path parameters
- Missing 400 response definition on endpoints that accept a request body
- Missing 401 and 403 response definitions on secured endpoints
- Absence of a 500 response definition

SCHEMA AND DOCUMENTATION CHECKS:
- Request body with no schema defined
- Response body with no schema defined (especially 200/201 responses)
- Schema properties with no type defined
- Missing `description` field on any path, operation, or parameter
- Missing `summary` field on any operation
- Absence of an `info.contact` block
- No `tags` defined on operations (inhibits SDK generation grouping)
- `additionalProperties: true` on response schemas (breaks strict deserialization)

NAMING AND CONSISTENCY CHECKS:
- Inconsistent casing in path parameters (e.g., mixing camelCase and snake_case)
- Inconsistent casing in query parameter names across the spec
- Inconsistent response envelope structure across endpoints
- Duplicate operation IDs

Respond ONLY in the following exact Markdown format. Do not include any preamble, greeting, or closing statement. Do not deviate from this structure:

---

# SpecAudit Report

## Summary
**Total Findings:** {N} | **Critical:** {N} | **Warnings:** {N} | **Info:** {N}

**Spec Format:** {OpenAPI 3.x / Swagger 2.0}
**Endpoints Analyzed:** {N}
**Audit Verdict:** {FAIL | PASS WITH WARNINGS | PASS}

---

## Findings

{For each finding, use one of the three blocks below. Order findings by severity: all CRITICAL first, then WARNING, then INFO.}

### [CRITICAL] {Finding Title}
**Category:** {Security | REST Violation | Schema | Naming | Consistency}
**Location:** `{path/method or "Global"}` 
**Issue:** {One to two sentences describing the exact problem and why it is a violation.}
**Recommendation:** {Concrete, implementable fix. Include a YAML snippet if a schema or definition change is required.}

---

### [WARNING] {Finding Title}
**Category:** {Security | REST Violation | Schema | Naming | Consistency}
**Location:** `{path/method or "Global"}`
**Issue:** {One to two sentences.}
**Recommendation:** {Concrete fix.}

---

### [INFO] {Finding Title}
**Category:** {Security | REST Violation | Schema | Naming | Consistency}
**Location:** `{path/method or "Global"}`
**Issue:** {One to two sentences.}
**Recommendation:** {Concrete fix.}

---

## Governance Score

**API Governance Score: {0–100}/100**

| Dimension | Score |
|---|---|
| Security | {0–25}/25 |
| REST Conformance | {0–25}/25 |
| Schema Completeness | {0–25}/25 |
| Documentation Quality | {0–25}/25 |

**Rationale:** {Two to three sentences explaining the score, referencing the most severe findings.}
```

---

## Part 5: Chronological Execution Plan

> Each step lists its **Reference** (which blueprint sections to consult), **Files produced**, **Actions**, and a single verifiable **Completion condition**. Do not begin a step until the previous step's completion condition is confirmed.

---

### Step 1 — Initialize the Monorepo

**Reference:** Part 1 (directory structure)  
**Files produced:** `spec-audit/` root, `backend/backend.csproj`, `frontend/package.json`, `docker-compose.yml`, `.gitignore`

**Actions:**
1. Create root directory `spec-audit/`.
2. Inside `backend/`: run `dotnet new web -o . --no-restore`. Delete the default weather forecast scaffold entirely. Run `dotnet restore`.
3. Add NuGet packages: `dotnet add package OpenAI` and `dotnet add package Microsoft.Extensions.AI.OpenAI`.
4. Inside `frontend/`: run `npm create vite@latest . -- --template react-ts`. Install Tailwind CSS v4: `npm install tailwindcss @tailwindcss/vite`. Add the `@tailwindcss/vite` plugin to `vite.config.ts`. Add `@import "tailwindcss"` to the main CSS entry file (`src/index.css`). **Do not create `tailwind.config.ts`** — Tailwind v4 uses CSS-first configuration; a separate config file is not part of the standard v4 setup.
5. Run `npm install react-markdown remark-gfm` in `frontend/`.
6. Create `.gitignore` at repo root covering: `bin/`, `obj/`, `node_modules/`, `.env`, `.env.local`, `**/*.user.json`.
7. Run `dotnet user-secrets init` inside `backend/`.
8. Create `docker-compose.yml` with two services: `backend` on port `5000:5000` and `frontend` on port `5173:5173`.

**Completion condition:** `dotnet run` in `backend/` returns HTTP 200 on `GET /health` (add this one-liner to `Program.cs` temporarily). `npm run dev` in `frontend/` renders the Vite default page. Zero errors in either terminal.

---

### Step 2 — Backend: Configuration Layer and DTOs

**Reference:** Part 2.1 (`AiOptions.cs`), Part 2.2 (DTOs), Part 2.5 (API key handling)  
**Files produced:** `src/Configuration/AiOptions.cs`, `src/Models/Requests/AuditRequest.cs`, `src/Models/Responses/AuditResponse.cs`, `appsettings.json`, `appsettings.Development.json`

**Actions:**
1. Create `AiOptions.cs` exactly as specified in Part 2.1. No hardcoded provider defaults in the class — `BaseUrl` and `ModelId` are empty strings. `ProviderName` defaults to `"Custom"`.
2. Create `AuditRequest.cs` and `AuditResponse.cs` exactly as specified in Part 2.2.
3. Populate `appsettings.json` — NVIDIA NIM is the default for the GitHub showcase. Swap provider by changing these three values only; no code changes required:

```json
{
  "Ai": {
    "ProviderName": "NVIDIA NIM",
    "BaseUrl": "https://integrate.api.nvidia.com/v1",
    "ModelId": "qwen/qwen2.5-coder-32b-instruct",
    "MaxTokens": 4096,
    "MaxInputLength": 100000
  }
}
```

**Provider swap reference:**

| Provider | `BaseUrl` | `ModelId` | Key prefix | Signup |
|---|---|---|---|---|
| **NVIDIA NIM** *(default)* | `https://integrate.api.nvidia.com/v1` | `qwen/qwen2.5-coder-32b-instruct` | `nvapi-` | build.nvidia.com |
| **Groq** | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` | `gsk_` | console.groq.com — email only |
| **OpenRouter** | `https://openrouter.ai/api/v1` | `meta-llama/llama-3.3-70b-instruct:free` | `sk-or-` | openrouter.ai — email only |
| **Google Gemini** | `https://generativelanguage.googleapis.com/v1beta/openai/` | `gemini-2.0-flash` | `AIza` | ai.google.dev — email only |
| **Together AI** | `https://api.together.xyz/v1` | `meta-llama/Llama-3-70b-chat-hf` | `tog-` | api.together.ai |

4. Set `appsettings.Development.json` to an empty `{}`.
5. Set the API key via user-secrets:
```bash
dotnet user-secrets set "Ai:ApiKey" "your-provider-key-here"
```

**Completion condition:** `dotnet build` succeeds with zero errors. All three types (`AiOptions`, `AuditRequest`, `AuditResponse`) resolve correctly in their namespaces.

---

### Step 3 — Backend: Service Stub, Endpoint, and Program Wiring

> 🔍 **Review Gate:** When this step is complete, invoke `@reviewer` using the Step 3 invocation pattern from Part 7.4. Do not begin Step 4 until the reviewer returns **APPROVED** or **APPROVED WITH NOTES**.

**Reference:** Part 2.3 (`Program.cs`), Part 2.4 (`AuditEndpoints.cs`)  
**Files produced:** `src/Services/SpecAuditService.cs`, `src/Endpoints/AuditEndpoints.cs`, `Program.cs` (replaced)

**Actions:**
1. Create `SpecAuditService.cs`. Implement the constructor (inject `IOptions<AiOptions>`, store options, expose `MaxInputLength` as a public property). Stub `AuditAsync` with a single `yield return "test chunk"` — do not implement real AI calls yet.
2. Create `AuditEndpoints.cs` exactly as specified in Part 2.4, including the HTTP 413 check against `auditService.MaxInputLength`.
3. Replace `Program.cs` with the composition root exactly as specified in Part 2.3, including the startup validation guard for `BaseUrl` and `ModelId`.
4. Confirm CORS is configured for `http://localhost:5173` and `app.UseCors("FrontendPolicy")` is called before `app.MapAuditEndpoints()`.

**Completion condition:** `POST /api/audit` with body `{"spec": "test"}` returns a streaming SSE response with `data: test chunk`. The startup validation guard logs clearly if `BaseUrl` or `ModelId` is empty. Zero console exceptions.

---

### Step 4 — Backend: AI Streaming Implementation

> 🔍 **Review Gate:** When this step is complete, invoke `@reviewer` using the Step 4 invocation pattern from Part 7.4. This is the highest-risk step in the blueprint — SDK type errors are silent until runtime. Do not begin Step 5 until the reviewer returns **APPROVED**.

**Reference:** Part 4 (system prompt), Part 2.1 (`AiOptions` — `MaxTokens`), Part 2.4 (endpoint — SSE format)  
**Files modified:** `src/Services/SpecAuditService.cs`

**Actions:**
1. Add `using OpenAI.Chat;` at the top of `SpecAuditService.cs`. This namespace is required for `SystemChatMessage`, `UserChatMessage`, `ChatCompletionOptions`, and `StreamingChatCompletionUpdate`.
2. Replace the stub `AuditAsync` with the full implementation below. Use `SystemChatMessage` and `UserChatMessage` — the `ChatMessage` base class in OpenAI SDK v2.x does **not** expose a public `(ChatMessageRole, string)` constructor. Use `CompleteChatStreamingAsync` (not `CompleteChatStreaming`) — the async variant returns `AsyncCollectionResult<T>` which implements `IAsyncEnumerable<T>` and is required for `await foreach` in an async method:

```csharp
public async IAsyncEnumerable<string> AuditAsync(
    AuditRequest request,
    [EnumeratorCancellation] CancellationToken ct)
{
    var messages = new List<ChatMessage>
    {
        new SystemChatMessage(SystemPrompt),
        new UserChatMessage(BuildUserMessage(request))
    };

    var options = new ChatCompletionOptions
    {
        MaxOutputTokenCount = _options.MaxTokens,
        Temperature = 0.1f
    };

    // CompleteChatStreamingAsync → AsyncCollectionResult<T> → IAsyncEnumerable<T> ✓
    // CompleteChatStreaming      → CollectionResult<T>      → IEnumerable<T>       ✗ (cannot await)
    await foreach (var update in _chatClient.CompleteChatStreamingAsync(messages, options, ct))
    {
        foreach (var part in update.ContentUpdate)
        {
            if (!string.IsNullOrEmpty(part.Text))
                yield return part.Text;
        }
    }
}
```

3. Add `private static string BuildUserMessage(AuditRequest request)` as a helper method.
4. Store the system prompt from Part 4 **verbatim** as `private const string SystemPrompt`. Do not paraphrase, summarize, or restructure it.

**Completion condition:** `POST /api/audit` with a real, minimal 3-endpoint OpenAPI YAML spec returns a structured, streamed audit report. Manually verify the response contains all three sections: `## Summary`, `## Findings`, and `## Governance Score`. At least one finding must appear under a `### [CRITICAL]`, `### [WARNING]`, or `### [INFO]` heading.

---

### Step 5 — Frontend: Data Layer

> 🔍 **Review Gate:** When this step is complete, invoke `@reviewer` using the Step 5 invocation pattern from Part 7.4. The buffer extraction and error sentinel placement are the two most likely points of agent drift. Do not begin Step 6 until the reviewer returns **APPROVED**.

**Reference:** Part 3.1 (Vite proxy), Part 3.2 (shared types), Part 3.3 (API client), Part 3.4 (useAudit hook)  
**Files produced:** `src/types/audit.ts`, `src/api/auditClient.ts`, `src/hooks/useAudit.ts`, `vite.config.ts` (modified)

**Actions:**
1. Create `types/audit.ts` exactly as specified in Part 3.2.
2. Create `api/auditClient.ts` exactly as specified in Part 3.3. The buffer implementation is mandatory — do not simplify it. The `[SPECAUDIT_ERROR]` sentinel detection must be inside the buffer loop, not in a separate pass.
3. Create `hooks/useAudit.ts` exactly as specified in Part 3.4.
4. Add the Vite proxy to `vite.config.ts` as specified in Part 3.1. Verify no hardcoded backend URLs exist anywhere in `src/`.

**Completion condition:** `npm run build` produces zero TypeScript errors. The hook's exported shape (`{ state, audit, abort, reset }`) matches the type contract in `audit.ts`. The Vite dev server proxies `/api/*` to `http://localhost:5000` — confirm this in `vite.config.ts`.

---

### Step 6 — Frontend: UI Primitives

**Reference:** Part 3.5 (Tailwind color palette used in severity styles — use the same slate/indigo palette for consistency)  
**Files produced:** `src/components/ui/Button.tsx`, `src/components/ui/Spinner.tsx`, `src/components/ui/Card.tsx`

**Actions:**
1. `Button.tsx`: accepts props `variant: 'primary' | 'danger' | 'ghost'`, `disabled?: boolean`, `onClick`, `children`. Styles:
   - `primary`: `bg-indigo-600 hover:bg-indigo-500 text-white`
   - `danger`: `bg-red-700 hover:bg-red-600 text-white`
   - `ghost`: `border border-slate-600 hover:border-slate-400 text-slate-300`
   - All variants: `px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed`
2. `Spinner.tsx`: animated SVG spinner using `animate-spin`. Accepts `size?: 'sm' | 'md'` prop. Default `md` = 20px, `sm` = 14px. Color: `text-indigo-400`.
3. `Card.tsx`: a `div` wrapper with `bg-slate-900 border border-slate-800 rounded-xl p-6`. Accepts `className?: string` for overrides and `children`.

**Completion condition:** `npm run build` produces zero TypeScript errors. All three components accept their props without type errors when used in a consuming component.

---

### Step 7 — Frontend: Feature Components

> 🔍 **Review Gate:** When this step is complete, invoke `@reviewer` using the Step 7 invocation pattern from Part 7.4. React 19 typing compliance and the SEVERITY_STYLES map are the two things most likely to drift. Do not begin Step 8 until the reviewer returns **APPROVED**.

**Reference:** Part 3.5 (`ResultPanel` severity styles — implement exactly as specified including the SEVERITY_STYLES map and `parseSeverity` function)  
**Files produced:** `src/components/features/InputPanel.tsx`, `src/components/features/ResultPanel.tsx`

**Actions:**
1. `InputPanel.tsx`:
   - Textarea: monospace font, minimum height `300px`, classes `bg-slate-950 border border-slate-700 rounded-lg p-4 text-slate-200 text-sm font-mono w-full resize-y`.
   - Live character count: `{count.toLocaleString()} / 100,000 characters`. Class turns `text-amber-400` above 80,000. Turns `text-red-400` above 100,000.
   - Inline overflow message when count exceeds 100,000: `"This spec exceeds the 100,000 character limit. Consider splitting into smaller service specs."` — shown below the count, never as a toast.
   - Format toggle: two `ghost` variant `Button` components labelled `YAML` and `JSON`. Selected state adds `border-indigo-500 text-indigo-300`. Defaults to neither selected (auto-detect).
   - `Run Audit` button: `primary` variant. Disabled when input is empty or count > 100,000 or `status === 'streaming'`.
   - `Stop` button: `danger` variant. Only rendered when `status === 'streaming'`.
2. `ResultPanel.tsx`: implement exactly as specified in Part 3.5. The `SEVERITY_STYLES` map, `parseSeverity` function, and all custom `react-markdown` component overrides must match the specification exactly. The blinking cursor (`animate-pulse`) must only appear when `isStreaming === true`.

   **React 19 typing requirement:** React 19 removed the implicit `children` prop from component types. All custom component overrides passed to `react-markdown`'s `components` prop must be explicitly typed. Use `ComponentPropsWithoutRef` from React combined with `react-markdown`'s own `ExtraProps`:

   ```typescript
   import type { ComponentPropsWithoutRef } from 'react';
   import type { ExtraProps } from 'react-markdown';

   type HeadingProps = ComponentPropsWithoutRef<'h3'> & ExtraProps;
   type CodeProps   = ComponentPropsWithoutRef<'code'> & ExtraProps;
   type ParaProps   = ComponentPropsWithoutRef<'p'> & ExtraProps;
   ```

   Apply these types to each component override function signature, for example:
   ```typescript
   h3: ({ children, ...props }: HeadingProps) => { ... }
   code: ({ children, className, ...props }: CodeProps) => { ... }
   p: ({ children, ...props }: ParaProps) => { ... }
   ```
   Without this, `npm run build` will fail with implicit `any` errors under strict TypeScript in React 19.

**Completion condition:** `npm run build` produces zero TypeScript errors. Both components accept their props without errors. `ResultPanel` renders a test markdown string containing `### [CRITICAL] Test Finding` with a red left border — verify visually in the browser.

---

### Step 8 — Frontend: App Wiring and End-to-End Integration

> 🔍 **Review Gate:** When this step passes its completion condition, invoke `@tester` using the Step 8 invocation pattern from Part 7.4. All three CRITICAL findings from Part 6.2 must be present in the tester's report before proceeding to Step 9.

**Reference:** Part 3.4 (`useAudit` hook shape), Step 6 and 7 (component props)  
**Files produced:** `src/App.tsx` (replaced), `src/main.tsx` (verify entry point)

**Actions:**
1. Replace `App.tsx` with the full application layout:
   - Root: `min-h-screen bg-slate-950 text-slate-200 p-6 lg:p-10`
   - Header: app name `SpecAudit` in `text-2xl font-bold text-slate-100`, subtitle `OpenAPI Contract Auditor` in `text-sm text-slate-400`. Place a small provider badge showing `AiOptions.ProviderName` — since this value lives in the backend, display it as a static label read from a `GET /api/config` endpoint (add this endpoint to `AuditEndpoints.cs` returning `{ providerName: string }`).
   - Layout: `lg:grid lg:grid-cols-2 lg:gap-8 mt-8` — two columns on large screens, stacked on mobile.
   - Left column: `InputPanel` receiving `status`, `onSubmit` (calls `audit()`), `onAbort` (calls `abort()`).
   - Right column: `ResultPanel` receiving `content={state.result}` and `isStreaming={state.status === 'streaming'}`. Show `Spinner` in the column header when `status === 'loading'`. Show a red `Card` with the error message when `status === 'error'`.
2. Verify `src/main.tsx` mounts `<App />` into `#root` with `<StrictMode>`.

**Completion condition:** Full end-to-end test with a real OpenAPI spec:
- Paste spec → click `Run Audit` → right panel streams progressively.
- `[CRITICAL]` findings: red left border + badge.
- `[WARNING]` findings: amber left border + badge.
- `[INFO]` findings: blue left border + badge.
- Blinking cursor appears during stream, disappears on completion.
- `Stop` button aborts cleanly mid-stream.
- Provider badge in the header shows the configured provider name.

---

### Step 9 — Hardening, Polish, and README

**Reference:** Part 2.4 (endpoint — error handling), Part 3.3 (`auditClient.ts` — `[SPECAUDIT_ERROR]` sentinel already handled)  
**Files modified:** `src/Services/SpecAuditService.cs`, `src/components/features/ResultPanel.tsx`, `src/components/features/InputPanel.tsx`, `README.md` (created)

**Actions:**
1. **Backend error handling — verify, don't rewrite:** The try/catch with `[SPECAUDIT_ERROR]` sentinel is already defined in `Part 2.4` and implemented in Step 3. In Step 9, verify only that the `OperationCanceledException` branch is present (client abort — no sentinel) and the general `Exception` branch emits the JSON-encoded sentinel correctly. Also add specific HTTP 429 detection inside the catch:
```csharp
catch (Exception ex)
{
    var message = ex.Message.Contains("429")
        ? "Rate limit reached. Please wait a moment and try again, or switch to a provider with higher limits."
        : ex.Message;
    var sentinel = JsonSerializer.Serialize($"[SPECAUDIT_ERROR] {message}");
    await httpContext.Response.WriteAsync($"data: {sentinel}\n\n", ct);
    await httpContext.Response.Body.FlushAsync(ct);
}
```
2. **Input sanitization:** In `AuditEndpoints.cs`, trim `request.Spec` before the length check and before passing to the service.
3. **Loading skeleton:** In `ResultPanel.tsx`, when `isStreaming === false && content === ''` (waiting for first chunk — `status === 'loading'`), render three skeleton lines: `<div className="bg-slate-800 animate-pulse rounded h-4 mb-3 w-full" />`.
4. **Remove all `console.log` calls** from every frontend file.
5. **Write `README.md`** at the repo root covering:
   - What SpecAudit does (two sentences max)
   - Tech stack table (Backend / Frontend / AI Integration columns)
   - Prerequisites and setup steps including `dotnet user-secrets set "Ai:ApiKey" "your-key"`
   - Provider swap table (copy from Step 2 verbatim)
   - Screenshot placeholder: `![SpecAudit Screenshot](docs/screenshot.png)`
   - Note: "`ProviderName` in `appsettings.json` is for display only and does not affect runtime behavior"
6. **Final verification checklist** — agent must confirm all items before marking this step complete:
   - [ ] `Ai:ApiKey` exists only in user-secrets — not in any tracked file
   - [ ] `Ai:BaseUrl` and `Ai:ModelId` are non-empty in `appsettings.json`
   - [ ] `dotnet build` — zero warnings, zero errors
   - [ ] `npm run build` — zero TypeScript errors
   - [ ] No `console.log` calls remain in `src/`
   - [ ] A clean clone followed only by `dotnet user-secrets set "Ai:ApiKey" "..."` + `dotnet run` + `npm run dev` produces a fully working application

**Completion condition:** All six checklist items confirmed. Application runs end-to-end in a clean environment.

---

### Step 10 — Unit Tests

**Reference:** Part 3.6 (`parseSSEChunks`, `parseSeverity` — pure functions to test), Part 2.3 (`Program.cs` — requires `public partial class Program {}` for `WebApplicationFactory`)
**Files produced:** `backend.Tests/backend.Tests.csproj`, `backend.Tests/EndpointValidationTests.cs`, `backend.Tests/AiOptionsValidationTests.cs`, `backend.Tests/UserMessageBuilderTests.cs`, `frontend/src/utils/__tests__/parseSSEChunks.test.ts`, `frontend/src/utils/__tests__/parseSeverity.test.ts`

**What is tested and why:**
Only deterministic, pure logic is unit tested. The AI streaming chain is integration-level and is covered by the tester agent. Mocking the `ChatClient` would add complexity without meaningful signal.

| Target | Why |
|---|---|
| `BuildUserMessage` | Format hint must embed correctly — the system prompt depends on this |
| Endpoint input validation | Security-relevant — a broken 413 check exposes the AI client to oversized payloads |
| `AiOptions` startup guard | A silent pass here means cryptic runtime failures instead of a clear startup error |
| `parseSSEChunks` | Pure function with testable edge cases — the most likely source of silent data loss |
| `parseSeverity` | Pure function — if it returns `null` for `[CRITICAL]`, the badge silently disappears |

**Actions:**

**1. Backend — test project setup**

Create `backend.Tests/backend.Tests.csproj`:
```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <IsPackable>false</IsPackable>
    <Nullable>enable</Nullable>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.11.1" />
    <PackageReference Include="xunit" Version="2.9.2" />
    <PackageReference Include="xunit.runner.visualstudio" Version="2.8.2" />
    <PackageReference Include="FluentAssertions" Version="6.12.1" />
    <PackageReference Include="Microsoft.AspNetCore.Mvc.Testing" Version="10.0.0" />
  </ItemGroup>
  <ItemGroup>
    <ProjectReference Include="../backend/backend.csproj" />
  </ItemGroup>
</Project>
```

**2. Backend — expose internals and `Program` type**

In `backend.csproj`, add:
```xml
<ItemGroup>
  <AssemblyAttribute Include="System.Runtime.CompilerServices.InternalsVisibleToAttribute">
    <_Parameter1>backend.Tests</_Parameter1>
  </AssemblyAttribute>
</ItemGroup>
```

At the bottom of `Program.cs`, add:
```csharp
// Required for WebApplicationFactory in tests
public partial class Program { }
```

Change `BuildUserMessage` in `SpecAuditService.cs` from `private` to `internal`:
```csharp
internal static string BuildUserMessage(AuditRequest request) { ... }
```

**3. `backend.Tests/UserMessageBuilderTests.cs`**

```csharp
using FluentAssertions;
using SpecAudit.Models.Requests;
using SpecAudit.Services;

namespace backend.Tests;

public class UserMessageBuilderTests
{
    [Fact]
    public void BuildUserMessage_WithYamlHint_IncludesFormatInMessage()
    {
        var request = new AuditRequest("spec: test", "yaml");
        var result = SpecAuditService.BuildUserMessage(request);
        result.Should().Contain("yaml");
        result.Should().Contain("spec: test");
    }

    [Fact]
    public void BuildUserMessage_WithNullFormat_FallsBackToAutoDetect()
    {
        var request = new AuditRequest("spec: test", null);
        var result = SpecAuditService.BuildUserMessage(request);
        result.Should().Contain("auto-detect");
    }

    [Fact]
    public void BuildUserMessage_SpecContentAppearsAfterFormatHint()
    {
        var request = new AuditRequest("openapi: 3.0.3", "json");
        var result = SpecAuditService.BuildUserMessage(request);
        var formatIndex = result.IndexOf("json", StringComparison.OrdinalIgnoreCase);
        var specIndex   = result.IndexOf("openapi: 3.0.3", StringComparison.OrdinalIgnoreCase);
        specIndex.Should().BeGreaterThan(formatIndex,
            "the spec content must appear after the format hint, not before it");
    }
}
```

**4. `backend.Tests/EndpointValidationTests.cs`**

```csharp
using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace backend.Tests;

public class EndpointValidationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public EndpointValidationTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.WithWebHostBuilder(builder =>
            builder.ConfigureAppConfiguration((_, cfg) =>
                cfg.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Ai:BaseUrl"]        = "https://test.example.com/v1",
                    ["Ai:ModelId"]        = "test-model",
                    ["Ai:ApiKey"]         = "test-key",
                    ["Ai:MaxInputLength"] = "100000"
                })
            )
        ).CreateClient();
    }

    [Fact]
    public async Task PostAudit_EmptySpec_Returns400()
    {
        var response = await _client.PostAsJsonAsync("/api/audit", new { spec = "" });
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task PostAudit_WhitespaceOnlySpec_Returns400()
    {
        var response = await _client.PostAsJsonAsync("/api/audit", new { spec = "   " });
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task PostAudit_SpecExceedsMaxLength_Returns413()
    {
        var oversized = new string('a', 100_001);
        var response  = await _client.PostAsJsonAsync("/api/audit", new { spec = oversized });
        response.StatusCode.Should().Be(HttpStatusCode.RequestEntityTooLarge);
    }
}
```

**5. `backend.Tests/AiOptionsValidationTests.cs`**

```csharp
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace backend.Tests;

public class AiOptionsValidationTests
{
    [Fact]
    public void Startup_MissingBaseUrl_ThrowsInvalidOperationException()
    {
        var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
            builder.ConfigureAppConfiguration((_, cfg) =>
                cfg.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Ai:BaseUrl"]  = "",
                    ["Ai:ModelId"]  = "test-model",
                    ["Ai:ApiKey"]   = "test-key"
                })
            )
        );

        var act = () => factory.CreateClient();
        act.Should().Throw<Exception>()
            .WithMessage("*BaseUrl*");
    }

    [Fact]
    public void Startup_MissingModelId_ThrowsInvalidOperationException()
    {
        var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
            builder.ConfigureAppConfiguration((_, cfg) =>
                cfg.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Ai:BaseUrl"]  = "https://test.example.com/v1",
                    ["Ai:ModelId"]  = "",
                    ["Ai:ApiKey"]   = "test-key"
                })
            )
        );

        var act = () => factory.CreateClient();
        act.Should().Throw<Exception>()
            .WithMessage("*ModelId*");
    }
}
```

**6. Frontend — Vitest setup**

Install: `npm install -D vitest`

Add to `vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:5000' }
  },
  test: {
    environment: 'node',
    globals: true,
  },
});
```

Add to `package.json` scripts: `"test": "vitest run"`

**7. `frontend/src/utils/__tests__/parseSSEChunks.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { parseSSEChunks } from '../parseSSEChunks';

describe('parseSSEChunks', () => {
  it('extracts a single complete data line', () => {
    const { chunks, remainingBuffer } = parseSSEChunks('', 'data: hello world\n\n');
    expect(chunks).toEqual(['hello world']);
    expect(remainingBuffer).toBe('');
  });

  it('holds an incomplete line in the buffer', () => {
    const { chunks, remainingBuffer } = parseSSEChunks('', 'data: incom');
    expect(chunks).toEqual([]);
    expect(remainingBuffer).toBe('data: incom');
  });

  it('reassembles a line split across two network calls', () => {
    const first = parseSSEChunks('', 'data: hel');
    expect(first.chunks).toEqual([]);
    const second = parseSSEChunks(first.remainingBuffer, 'lo\n\n');
    expect(second.chunks).toEqual(['hello']);
  });

  it('extracts multiple data lines from a single chunk', () => {
    const { chunks } = parseSSEChunks('', 'data: first\ndata: second\ndata: third\n');
    expect(chunks).toEqual(['first', 'second', 'third']);
  });

  it('ignores non-data lines', () => {
    const { chunks } = parseSSEChunks('', 'event: ping\ndata: payload\n: comment\n');
    expect(chunks).toEqual(['payload']);
  });

  it('returns empty chunks and preserves buffer when incoming is empty', () => {
    const { chunks, remainingBuffer } = parseSSEChunks('partial', '');
    expect(chunks).toEqual([]);
    expect(remainingBuffer).toBe('partial');
  });
});
```

**8. `frontend/src/utils/__tests__/parseSeverity.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { parseSeverity } from '../parseSeverity';

describe('parseSeverity', () => {
  it('returns CRITICAL for a [CRITICAL] heading', () => {
    expect(parseSeverity('[CRITICAL] Missing Auth Scheme')).toBe('CRITICAL');
  });

  it('returns WARNING for a [WARNING] heading', () => {
    expect(parseSeverity('[WARNING] Missing 404 Response')).toBe('WARNING');
  });

  it('returns INFO for an [INFO] heading', () => {
    expect(parseSeverity('[INFO] Missing Contact Block')).toBe('INFO');
  });

  it('returns null for a plain heading with no severity tag', () => {
    expect(parseSeverity('Summary')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parseSeverity('')).toBeNull();
  });

  it('CRITICAL takes precedence when multiple tags appear in the same string', () => {
    expect(parseSeverity('[CRITICAL] something with [WARNING] in text')).toBe('CRITICAL');
  });
});
```

**Completion condition:** `dotnet test` from the repo root — all 8 backend tests pass, zero failures. `npm run test` from `frontend/` — all 12 frontend tests pass, zero failures.

---

## Part 6: Tester Agent — Reference Test Payload

This is a deliberately flawed OpenAPI 3.0 specification. It contains known violations that the model must detect. Use it as the input to the running application at Step 8's review gate and again after Step 10.

The tester agent's job is to paste this spec and verify that the actual findings match the expected findings listed below. Any missing `[CRITICAL]` finding is a blocking failure.

### 6.1 Test Payload YAML

```yaml
openapi: "3.0.3"
info:
  title: "Inventory Service API"
  version: "1.0.0"
  # Missing: info.contact block

servers:
  - url: "http://api.inventory.local/v1"

paths:
  /getProducts:
    get:
      summary: "Get all products"
      responses:
        "200":
          description: "Success"
          content:
            application/json:
              schema:
                type: array
                items:
                  type: object
                  additionalProperties: true

  /products/{id}:
    get:
      summary: "Get product by ID"
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: "Product found"
          content:
            application/json:
              schema:
                type: object

  /products:
    post:
      summary: "Create a new product"
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
                price:
                  type: number
      responses:
        "200":
          description: "Product created"
```

### 6.2 Expected Findings

The tester must verify that **all three CRITICAL findings appear**. WARNING and INFO counts are indicative — the model may identify additional valid findings beyond those listed.

| Severity | Finding | Location |
|---|---|---|
| **CRITICAL** | No `securitySchemes` defined — entire API has no authentication mechanism | Global |
| **CRITICAL** | Server URL uses HTTP not HTTPS — data in transit is unencrypted | `servers[0]` |
| **CRITICAL** | Mutation endpoint has no security requirement | `POST /products` |
| **WARNING** | Verb in resource path — violates REST naming convention | `GET /getProducts` |
| **WARNING** | Resource creation returns 200 instead of 201 | `POST /products` |
| **WARNING** | Missing 404 response on path parameter endpoint | `GET /products/{id}` |
| **WARNING** | Missing 400 response on endpoint accepting a request body | `POST /products` |
| **INFO** | Missing `info.contact` block | Global |
| **INFO** | No `tags` defined on any operation | Global |
| **INFO** | `additionalProperties: true` on response schema — breaks strict deserialization | `GET /getProducts` |
| **INFO** | Missing `description` on operations | Multiple paths |

**Tester agent instruction:** Run SpecAudit with the payload above. Report back the exact `[CRITICAL]`, `[WARNING]`, and `[INFO]` headings from the output. If any of the three CRITICAL findings is absent, the Step 8 completion condition is not satisfied — return the result to the builder agent for investigation before approving Step 9.

---

## Part 7: OpenCode Multi-Agent Configuration

SpecAudit uses three OpenCode agents. The builder (default session) executes the blueprint. The `@reviewer` and `@tester` are custom sub-agents defined in `.opencode/agents/` and invoked via `@mention` at the review gates. No manual copy-paste between sessions is required.

### 7.1 `opencode.json` (repo root)

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "deepseek/deepseek-chat-v3-0324",
  "agents": {}
}
```

The agents are defined via markdown files. This file sets the default builder model and opts into the project-level agent directory.

### 7.2 `.opencode/agents/reviewer.md`

```markdown
---
model: anthropic/claude-sonnet-4-6
temperature: 0.1
description: Architectural reviewer — checks generated files against SpecAudit blueprint constraints
---

You are a strict architectural code reviewer for the SpecAudit project. You have read-only access to the codebase. You do not create, modify, or delete any file.

When the builder invokes you, it will provide a list of files and a specific checklist. Your job:

1. Read each specified file in full.
2. Check every checklist item — report PASS or FAIL for each one individually.
3. For every FAIL: quote the exact line causing the issue, name the blueprint section it violates, and state the required fix in one sentence.
4. End with exactly one of three verdicts:
   - **APPROVED** — all items pass. Builder may proceed to the next step.
   - **APPROVED WITH NOTES** — all critical items pass. Minor issues noted but do not block.
   - **BLOCKED** — one or more critical items fail. Builder must fix before proceeding.

Do not suggest improvements outside the checklist scope. Do not rewrite code. Be precise and brief.
```

### 7.3 `.opencode/agents/tester.md`

```markdown
---
model: deepseek/deepseek-chat-v3-0324
temperature: 0.0
description: QA tester — validates SpecAudit output against the reference test payload from Part 6
---

You are a QA tester for the SpecAudit application. You validate live output — you do not review source code.

When the builder invokes you after Step 8:

1. Confirm both services are running: backend on port 5000, frontend on port 5173.
2. Open the SpecAudit UI at http://localhost:5173.
3. Paste the test payload from Part 6.1 of SpecAudit_Implementation_Blueprint.md into the input panel.
4. Click Run Audit and wait for the stream to complete.
5. Record every heading that appears in the output — specifically `### [CRITICAL]`, `### [WARNING]`, and `### [INFO]` lines.
6. Compare them against the expected findings table in Part 6.2.
7. Report:
   - **PASS** — all three CRITICAL findings are present. Provide the full list of findings found.
   - **FAIL** — one or more CRITICAL findings are absent. Name the missing ones and report back to the builder with the full output received.

CRITICAL findings are mandatory. WARNING and INFO are indicative — the model may surface additional valid findings beyond those listed, and that is acceptable.
```

### 7.4 Builder @mention Invocation Patterns

The builder uses these exact invocation patterns at each review gate. Copy them into the builder session verbatim.

**At Step 3 review gate:**
```
@reviewer Review the following files: `backend/src/Services/SpecAuditService.cs`, `backend/src/Endpoints/AuditEndpoints.cs`, `backend/Program.cs`

Checklist:
- [ ] DI registers AiOptions and SpecAuditService correctly with the correct lifetimes
- [ ] CORS middleware is called before MapAuditEndpoints
- [ ] Startup guard throws if BaseUrl or ModelId is empty
- [ ] app.Run uses "http://+:5000" — not plain app.Run() and not http://localhost:5000
- [ ] POST /api/audit endpoint has the HTTP 413 check against MaxInputLength
- [ ] Each SSE chunk is JSON-encoded with JsonSerializer.Serialize before writing to the data: frame
- [ ] try/catch wraps the await foreach loop — OperationCanceledException is caught silently, Exception emits [SPECAUDIT_ERROR] sentinel (also JSON-encoded)
- [ ] GET /api/config endpoint exists and returns providerName only — not ApiKey
- [ ] GET /health endpoint exists
```

**At Step 4 review gate:**
```
@reviewer Review: `backend/src/Services/SpecAuditService.cs`

Checklist:
- [ ] using OpenAI.Chat is present at the top of the file
- [ ] Messages use SystemChatMessage and UserChatMessage — NOT new(ChatMessageRole.System, ...)
- [ ] CompleteChatStreamingAsync is called — NOT CompleteChatStreaming (the sync variant)
- [ ] ContentUpdate is iterated with foreach — NOT indexed with [0]
- [ ] Temperature is set to 0.1f in ChatCompletionOptions
- [ ] SystemPrompt is stored as a private const string and matches Part 4 of the blueprint verbatim
- [ ] BuildUserMessage is internal static (not private) for testability
```

**At Step 5 review gate:**
```
@reviewer Review: `frontend/src/utils/parseSSEChunks.ts`, `frontend/src/utils/parseSeverity.ts`, `frontend/src/api/auditClient.ts`, `frontend/vite.config.ts`

Checklist:
- [ ] parseSSEChunks is a pure exported function with no I/O or side effects
- [ ] parseSeverity is a pure exported function imported from utils — not defined inline in ResultPanel
- [ ] auditClient imports parseSSEChunks from utils — buffer logic is NOT inline in auditClient
- [ ] Each rawChunk from parseSSEChunks is passed through JSON.parse before use — counterpart to backend JsonSerializer.Serialize
- [ ] [SPECAUDIT_ERROR] detection runs on the parsed string (after JSON.parse), not the raw SSE string
- [ ] No hardcoded backend URL exists anywhere in src/
- [ ] Vite proxy routes /api to http://localhost:5000
```

**At Step 7 review gate:**
```
@reviewer Review: `frontend/src/components/features/ResultPanel.tsx`

Checklist:
- [ ] parseSeverity is imported from utils/parseSeverity — not defined inline
- [ ] SEVERITY_STYLES map contains all three entries: CRITICAL (red-500), WARNING (amber-500), INFO (blue-400)
- [ ] All three custom react-markdown component overrides (h3, code, p) use explicit TypeScript types: ComponentPropsWithoutRef + ExtraProps
- [ ] Blinking cursor element only renders when isStreaming === true
- [ ] Loading skeleton renders when isStreaming is false and content is empty
```

**At Step 8 review gate (tester):**
```
@tester The application is running. Run the test payload from Part 6.1 of SpecAudit_Implementation_Blueprint.md and report whether all three CRITICAL findings appear in the output.
```

---

*End of SpecAudit Implementation Blueprint. Place this file in the repository root (`spec-audit/SpecAudit_Implementation_Blueprint.md`) before initialising the OpenCode session.*
