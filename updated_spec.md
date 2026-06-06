# SpecAudit — Complete Project Context for Code Review

> Generated: 2026-06-06 | HEAD: `bbb0faf` | Branch: `main`
> Purpose: Self-contained reference for AI-powered code review ("antigravity" or equivalent)

---

## 1. Project Overview

**SpecAudit** is an AI-powered OpenAPI contract auditor that analyzes API specifications for security vulnerabilities, REST convention violations, schema issues, and naming inconsistencies. It streams structured audit reports with severity-tagged findings directly in the browser.

| Property | Value |
|----------|-------|
| **Live demo** | [https://specaudit-production-18ee.up.railway.app](https://specaudit-production-18ee.up.railway.app) |
| **Repository** | GitHub (private) |
| **Solution** | `SpecAudit.slnx` — 2 projects: `backend/` + `backend.Tests/` |
| **License** | Not specified (private) |

### Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Backend** | .NET Minimal APIs (ASP.NET Core) | .NET 10.0 |
| **Backend AI** | Raw HttpClient + manual SSE parsing (no OpenAI SDK in streaming path) | — |
| **Frontend** | React + Vite + Tailwind CSS | React 19.2.6 / Vite 8.0 / Tailwind 4.3 |
| **Language** | TypeScript (strict mode) | ~6.0.2 |
| **PDF** | pdfmake | 0.3.9 |
| **Markdown** | react-markdown + remark-gfm | 10.1.0 |
| **Tests (FE)** | vitest + jsdom + testing-library (~314 tests) | vitest 4.1 |
| **Tests (BE)** | xUnit + FluentAssertions + WebApplicationFactory (~30 tests) | xUnit 2.9.2 |
| **CI** | GitHub Actions | dotnet 10.x / Node 22 |
| **Infra** | Docker multi-stage + Railway | root Dockerfile |
| **Editor** | OpenCode (VS Code clone with agents) | — |

---

## 2. Architecture & Data Flow (End to End)

### 2.1 Request Flow

```
User browser                    Frontend (App.tsx)              Backend (.NET 10)                AI Provider (Groq, etc.)
     │                               │                              │                                  │
     │  Paste OpenAPI spec           │                              │                                  │
     │──────────────────────────────>│                              │                                  │
     │                               │                              │                                  │
     │  Click "Run Audit"            │                              │                                  │
     │──────────────────────────────>│                              │                                  │
     │                               │  auditStream(payload)        │                                  │
     │                               │─────────────────────────────>│                                  │
│                               │  POST /api/audit (SSE)      │  SpecAuditService.AuditAsync()    │
│                               │                              │  (raw HttpClient → POST           │
│                               │                              │   {provider}/chat/completions →   │
│                               │                              │   StreamReader.ReadLineAsync →    │
│                               │                              │   JSON.parse per data: line)      │
│                               │                              │─────────────────────────────────>│
│                               │                              │                                  │
│                               │                              │  ◄── streaming Chat API chunks ──│
     │                               │  ◄── SSE: data: "chunk" ────│                                  │
     │  ◄── ReactMarkdown render ────│                              │  (StringBuilder accumulates)     │
     │                               │                              │                                  │
│                               │                              │  After stream complete:           │
│                               │                              │  ExtractStructuredJson()          │
│                               │                              │  LastIndexOf → JsonDocument.Parse │
     │                               │                              │                                  │
     │                               │  ◄── [SPECAUDIT_STRUCTURED]──│                                  │
     │                               │                              │                                  │
│                               │  onChunk → state.result      │                                  │
│                               │  onStructured → state.findings[] + state.summary                │
│                               │                              │                                  │
│  ◄── GET /api/providers ──────│                              │                                  │
│  (on startup, populates       │                              │                                  │
│   provider dropdown)          │                              │                                  │
```

### 2.2 SSE Wire Protocol (Exact Byte Format)

```
data: "<json-encoded-chunk>"\n\n
```

Every chunk from the backend is JSON-encoded inside the SSE `data:` line. The frontend `parseSSEChunks` extracts `data:` lines, then `JSON.parse`s each.

**Normal markdown chunks:**
```
data: "# SpecAudit Report\n\n## Summary\n"
```

```
data: "**Total Findings:** 14 | **Critical:** 6 | **Warnings:** 4 | **Info:** 4\n"
```

**Error sentinel** (backend catches exception):
```
data: "[SPECAUDIT_ERROR] Rate limit reached. Please wait a moment and try again..."
```

**Structured data sentinel** (after streaming completes, backend extracts JSON block):
```
data: "[SPECAUDIT_STRUCTURED]{\"findings\":[{\"severity\":\"CRITICAL\",\"title\":\"...\"}],\"summary\":{...}}"
```

**Protocol rules:**
- The SSE response `Content-Type` is `text/event-stream`
- Cache-Control: `no-cache`, Connection: `keep-alive`
- Each `data:` line ends with `\n\n` (double newline)
- The `[SPECAUDIT_STRUCTURED]` chunk does NOT go to `onChunk` — it's intercepted by `onStructured`
- The `[SPECAUDIT_ERROR]` chunk throws a named Error (`RateLimitError` or generic `Error`)
- The stream can be aborted client-side via `AbortController`

### 2.3 Error Flow (End to End)

```
AI provider error (timeout, 429, etc.)
  → SpecAuditService reads error body
    → Throws HttpRequestException with "{status}: {body}"
      → AuditEndpoints catches Exception
        → 45-second server-side CancellationTokenSource.CancelAfter(45s)
          → OperationCanceledException → sends [SPECAUDIT_ERROR] timeout message
        → Sentry exception capture on backend errors
        → Non-success: sends SSE: data: "[SPECAUDIT_ERROR] <message>"\n\n"
          → auditClient.ts parse loop: chunk.startsWith('[SPECAUDIT_ERROR]')
            → If 429 rate limit: throw with status + body text
            → Else: throw with status + body text (no retry)
              → useAudit.ts catch:
                → Sets status='error', store err.message
                  → App.tsx renders Card with error message
```

### 2.4 Export Behavior Matrix

| Export | Data Source | `\`\`\`json` block included? | Fallback |
|--------|-------------|------------------------------|----------|
| **UI render** (ResultPanel) | `strippedResult` | ❌ Stripped via lastIndexOf | — |
| **Copy** (clipboard) | `strippedResult` | ❌ Stripped | — |
| **Download** (.md file) | `strippedResult` | ❌ Stripped | — |
| **Export PDF** (pdfmake) | `strippedResult` | ❌ Stripped | — |
| **Export JSON** | `state.findings[]` + `state.summary` | ✅ Structured (not raw markdown) | If findings=[],summary=null → includes `strippedResult` |

---

## 3. Full Directory Map

```
/
├── .env                              # Local Docker: AI_API_KEY=... (gitignored)
├── .gitignore                        # bin/, obj/, node_modules/, .env, *.user.json, nul
├── .github/workflows/ci.yml          # GitHub Actions: backend test + frontend build/test
├── .opencode/
│   ├── opencode.json                 # Agent definitions (build, plan, etc.)
│   └── agents/
│       ├── ship.md                   # Pipeline orchestrator (bash: git only)
│       ├── test.md                   # Test runner agent
│       └── review.md                 # Code review agent
├── .pipeline/                        # Handoff files for OpenCode pipeline
│   ├── spec.md                       # Current feature spec
│   ├── changes.md                    # Build summary
│   ├── test-results.md               # Test output
│   └── review.md                     # Review verdict
├── .vscode/                          # Editor settings
├── Dockerfile                        # Multi-stage build (node→dotnet sdk→aspnet)
├── README.md                         # Project README
├── ROADMAP.md                        # Feature roadmap (completed + planned)
├── SpecAudit.slnx                    # Solution file
├── docs/                             # Screenshots, etc.
│
├── backend/
│   ├── backend.csproj                # .NET 10, OpenAI 2.10.0, InternalsVisibleTo
│   ├── appsettings.json              # Ai config: Groq defaults
│   ├── appsettings.Development.json  # Dev overrides
│   ├── Program.cs                    # Entry point, DI, CORS, routes
│   ├── Properties/
│   │   └── launchSettings.json       # Dev launch config
│   └── src/
│   ├── Configuration/
│   │   ├── AiOptions.cs          # POCO options class (ApiKey, BaseUrl, ModelId, etc.)
│   │   ├── AiProviderOptions.cs  # Multi-provider config model (BaseUrl, DefaultModel, Models)
│   │   └── AiProvidersConfig.cs  # Dictionary<string, AiProviderOptions> wrapper
│   ├── Endpoints/
│   │   └── AuditEndpoints.cs     # POST /api/audit, GET /api/config, GET /api/providers, GET /api/diagnose, GET /api/test-error
│       ├── Models/
│       │   ├── Requests/
│   │   │   └── AuditRequest.cs   # { Spec, SpecFormat?, Provider?, Model? }
│       └── Services/
│           └── SpecAuditService.cs   # SystemPrompt, AuditAsync, ExtractStructuredJson
│
├── backend.Tests/
│   ├── backend.Tests.csproj          # xUnit 2.9.2, FluentAssertions 6.12, WebApplicationFactory
│   ├── AiOptionsValidationTests.cs   # Startup validation (missing config)
│   ├── EndpointValidationTests.cs    # API integration tests (empty spec, oversized, config)
│   ├── ExtractStructuredJsonTests.cs # 7 regex extraction tests
│   ├── DiagnoseEndpointTests.cs      # 7 tests for /api/diagnose (raw + SDK modes)
│   ├── SentryStartupTests.cs         # Sentry DSN gating tests (2 tests)
│   └── UserMessageBuilderTests.cs    # BuildUserMessage format tests
│
├── frontend/
│   ├── package.json                  # Dependencies/scripts
│   ├── vite.config.ts                # Proxy, plugins, test config
│   ├── tsconfig.json                 # Project references
│   ├── tsconfig.app.json             # App TS config (strict)
│   ├── tsconfig.node.json            # Node-side TS config
│   ├── index.html                    # Browser entry (mounts at #root)
│   └── src/
│       ├── main.tsx                  # React bootstrap
│       ├── index.css                 # @import "tailwindcss" + @custom-variant light
│       ├── vite-env.d.ts             # Vite type declarations + *.md?raw module
│       ├── App.tsx                   # Shell: layout, export handlers, strippedResult
│       ├── App.css                   # (minimal/empty)
│       ├── test-setup.ts             # imports @testing-library/jest-dom
│       ├── types/
│       │   └── audit.ts              # All TS interfaces
│       ├── api/
│       │   ├── auditClient.ts        # auditStream() SSE client
│       │   └── __tests__/
│       │       └── auditClient.test.ts  # 4 structured sentinel tests + existing
│       ├── hooks/
│       │   ├── useAudit.ts           # State machine (idle→loading→streaming→complete|error), abort
│       │   ├── useAutoScroll.ts      # Scroll-to-bottom with IntersectionObserver
│       │   ├── useHistory.ts         # localStorage session history with LRU eviction
│       │   ├── useTheme.ts           # Dark/light toggle + localStorage
│       │   ├── useToast.ts           # Toast/snackbar context hook
│       │   ├── useToast.tsx          # ToastProvider component
│       │   └── __tests__/
│       │       ├── useAudit.test.tsx
│       │       ├── useAutoScroll.test.tsx
│       │       ├── useHistory.test.tsx
│       │       ├── useTheme.test.tsx
│       │       └── useToast.test.tsx
│       ├── components/
│       │   ├── features/
│       │   │   ├── HistorySidebar.tsx  # Collapsible session history sidebar
│       │   │   ├── InputPanel.tsx      # Spec textarea, format toggle, char counter, file upload
│       │   │   ├── ResultPanel.tsx     # ReactMarkdown render with severity styling
│       │   │   └── __tests__/
│       │   │       ├── App.test.tsx    # ~22 tests (export buttons)
│       │   │       ├── HistorySidebar.test.tsx
│       │   │       ├── InputPanel.test.tsx
│       │   │       └── ResultPanel.test.tsx
│       │   └── ui/
│       │       ├── Button.tsx          # Reusable button with variants
│       │       ├── Card.tsx            # Error/status card
│       │       ├── ProviderSelector.tsx # Provider/model dropdown (fetches /api/providers)
│       │       ├── Spinner.tsx         # Loading spinner
│       │       ├── ThemeToggle.tsx     # Dark/light toggle button
│       │       ├── ScrollButton.tsx    # Scroll-to-top/bottom button
│       │       ├── ToastContainer.tsx  # Toast stack display
│       │       └── __tests__/
│       │           ├── Button.test.tsx
│       │           ├── ProviderSelector.test.tsx
│       │           ├── ScrollButton.test.tsx
│       │           ├── ThemeToggle.test.tsx
│       │           └── ToastContainer.test.tsx
│       ├── utils/
│       │   ├── exportPdf.ts          # markdown→pdfmake converter
│       │   ├── filterMarkdown.ts     # Block splitting with /\n(?=### )/ for severity filter
│       │   ├── highlightText.ts      # Keyword search highlight
│       │   ├── parseSeverity.ts      # [CRITICAL/WARNING/INFO] string check
│       │   ├── parseSSEChunks.ts     # SSE buffer line parser
│       │   ├── splitIntoBlocks.ts    # Block splitting utility
│       │   └── __tests__/
│       │       ├── exportPdf.test.ts    # 35 tests
│       │       ├── filterMarkdown.test.ts
│       │       ├── highlightText.test.ts
│       │       ├── parseSeverity.test.ts
│       │       ├── parseSSEChunks.test.ts
│       │       └── splitIntoBlocks.test.ts
│       ├── test-fixtures/
│       │   ├── fraudlabs-swagger.json # Real FraudLabs OpenAPI 3.0.1 spec
│       │   └── fraudlabs-audit-result.md  # Real AI audit output (14 findings)
│       └── __tests__/
│           └── integration/
│               └── feature-pipeline.test.ts  # 32 integration tests
└── FraudLabs Pro Fraud Detection-swagger.json  # Leaked test file (should be gitignored)
```

---

## 4. Backend Implementation (Source-Level Detail)

### 4.1 `Program.cs` — Entry Point

```csharp
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

// DI
builder.Services.Configure<AiOptions>(builder.Configuration.GetSection("Ai"));
builder.Services.Configure<AiProvidersConfig>(builder.Configuration.GetSection("AiProviders"));
builder.Services.AddSingleton<SpecAuditService>();
builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyMethod()
              .AllowAnyHeader());
});

// Rate limiter — fixed window, 10 req/min per IP
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;
    options.AddPolicy("AuditPolicy", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            }));
});

var app = builder.Build();

if (app.Environment.IsDevelopment()) app.UseCors("FrontendPolicy");
app.UseDefaultFiles();   // Serve static files from wwwroot/
app.UseStaticFiles();
app.UseRateLimiter();    // Must be called after UseStaticFiles
app.MapAuditEndpoints(); // POST /api/audit, GET /api/config, GET /api/providers, GET /api/diagnose, GET /api/test-error
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));
app.MapFallbackToFile("index.html"); // SPA fallback

// Startup validation — all three required + AiProviders config
var aiOptions = app.Services.GetRequiredService<IOptions<AiOptions>>().Value;
if (string.IsNullOrWhiteSpace(aiOptions.BaseUrl) || string.IsNullOrWhiteSpace(aiOptions.ModelId) || string.IsNullOrWhiteSpace(aiOptions.ApiKey))
    throw new InvalidOperationException("Ai:BaseUrl, Ai:ModelId, and Ai:ApiKey must be configured in appsettings.json or user-secrets.");

app.Run("http://+:5000");

public partial class Program { }
```

**Key points:**
- `SpecAuditService` is a **singleton** (no OpenAI SDK client — fresh `HttpClient` per request)
- CORS is only active in development (production is same-origin via SPA fallback)
- `partial class Program` enables `WebApplicationFactory` integration tests
- Port is hard-coded to `+:5000` (Railway compatible)
- Rate limiter uses **fixed window** policy keyed by `RemoteIpAddress`
- `UseRateLimiter()` must be called after `UseStaticFiles()` but before route mapping
- Startup validation now also checks `ApiKey` — all three required
- `AiProvidersConfig` is bound from `AiProviders` section — enables multi-provider UI dropdown
- No NuGet packages needed: rate limiting is built into .NET 8+ (`System.Threading.RateLimiting`)

### 4.2 `SpecAuditService.cs` — Core Service

**Class signature:** `public sealed class SpecAuditService`

(No `partial` keyword — `[GeneratedRegex]` has been removed in favor of manual string search.)

**Constructor:** `SpecAuditService(IOptions<AiOptions> aiOptions, IOptions<AiProvidersConfig> providersConfig, ILogger<SpecAuditService> logger)`
- `AiOptions` provides `ApiKey`, `MaxTokens`, `MaxInputLength`
- `AiProvidersConfig` provides provider-specific `BaseUrl`, `DefaultModel`, `Models` list

#### SystemPrompt (148 lines, lines 16–148)

This is the most important piece of context for code review — it defines what the AI is told to check:

```csharp
private const string SystemPrompt = """
    You are a strict API Governance Architect performing a formal security and design audit...

    Check for ALL of the following categories without exception:

    SECURITY CHECKS:
    - Absence of securitySchemes definition
    - State-mutating endpoints with no security
    - HTTP instead of HTTPS
    - API keys as query parameters instead of headers
    - Missing CORS definitions
    - Missing rate limiting headers
    - JWT/OAuth scopes too broad

    REST CONVENTION CHECKS:
    - Verbs in resource names (/getUser)
    - Incorrect HTTP method usage
    - Missing plural resource naming
    - Nested resources >3 levels
    - Non-standard success codes
    - Missing 404, 400, 401, 403, 500 response definitions

    SCHEMA AND DOCUMENTATION CHECKS:
    - Request/response body with no schema
    - Schema properties with no type
    - Missing description on paths, operations, parameters
    - Missing summary on operations
    - Missing info.contact
    - No tags on operations
    - additionalProperties: true on responses

    NAMING AND CONSISTENCY CHECKS:
    - Inconsistent casing in path/query parameters
    - Inconsistent response envelope structure
    - Duplicate operation IDs

    Respond ONLY in exact Markdown format... [See full text in source]

    AFTER your complete markdown report, append a JSON code block at the very end
    with the structured findings summary...
    """
```

The full prompt ends with a JSON schema example instructing the AI to append:

```json
{ "findings": [...], "summary": { "totalFindings": N, "critical": N, ... } }
```

#### `AuditAsync()` — Streaming Method (Raw HttpClient + Manual SSE)

```csharp
public async IAsyncEnumerable<string> AuditAsync(
    AuditRequest request,
    [EnumeratorCancellation] CancellationToken ct)
```

**Flow:**
1. Resolve provider from `_providersConfig.Providers` dictionary using `request.Provider` (or fallback to Groq)
2. Build JSON payload: `{ model, messages: [system, user], stream: true }`
3. Create `HttpClient` per request (fresh instance — no connection pooling issues)
4. Call `client.SendAsync` with `HttpCompletionOption.ResponseHeadersRead`
5. If non-success status: read error response body → throw `HttpRequestException` with `"{status}: {body}"`
6. Read SSE `data:` lines via `StreamReader.ReadLineAsync`:
   - Each `data:` line contains a chunk JSON: `{ choices: [{ delta: { content: "..." } }] }`
   - Extract `choices[0].delta.content` from each JSON line
   - Append to `StringBuilder fullText`
   - `yield return` the content (stream to SSE endpoint)
7. Handle `[DONE]` sentinel — signals stream end
8. After loop: call `ExtractStructuredJson(fullText.ToString())`
9. If JSON extracted: `yield return $"{StructuredSentinel}{json}"`

**Edge cases handled:**
- Cancellation propagates via `[EnumeratorCancellation]`
- Non-success responses include error body in exception message
- Empty/null content delta parts are skipped
- `[DONE]` line is silently consumed (not yielded)

#### `ExtractStructuredJson()` — String Search Extraction

```csharp
internal static string? ExtractStructuredJson(string markdown)
{
    const string openFence = "```json";
    const string closeFence = "```";

    var lastOpen = markdown.LastIndexOf(openFence, StringComparison.Ordinal);
    if (lastOpen < 0)
        return null;

    var jsonStart = lastOpen + openFence.Length;
    var closeStart = markdown.IndexOf(closeFence, jsonStart, StringComparison.Ordinal);
    if (closeStart < 0)
        return null;

    var json = markdown[jsonStart..closeStart].Trim();
    if (string.IsNullOrEmpty(json))
        return null;

    try
    {
        using var doc = JsonDocument.Parse(json);
        return json;
    }
    catch (JsonException)
    {
        return null;
    }
}
```

**Extraction logic breakdown:**
- `LastIndexOf("```json")` — finds the LAST opening fence (avoids regex, handles multiple blocks)
- `IndexOf("```", jsonStart)` — finds the corresponding closing fence after the opening fence
- `markdown[jsonStart..closeStart]` — range slicing extracts content between fences
- No `using System.Text.RegularExpressions;` needed (removed)

**Edge cases:**
- No ` ```json ` block → `LastIndexOf` returns -1 → returns null
- Multiple ` ```json ` blocks → `LastIndexOf` captures LAST one only
- Invalid JSON → `JsonDocument.Parse` throws → caught → returns null
- Empty/whitespace-only block → `Trim()` returns empty → returns null
- Text after the JSON block → **ALLOWED** (no `$` anchor, so trailing text is ignored)

#### `BuildUserMessage()` — Prompt Construction

```csharp
internal static string BuildUserMessage(AuditRequest request)
{
    var format = request.SpecFormat ?? "auto-detect";
    return $"Analyze the following OpenAPI specification (format: {format}):\n\n{request.Spec}";
}
```

### 4.3 `AuditEndpoints.cs` — API Routes

#### `POST /api/audit` — SSE Endpoint

```csharp
app.MapPost("/api/audit", async (
    [FromBody] AuditRequest request,
    SpecAuditService auditService,
    HttpContext httpContext,
    CancellationToken ct) =>
{
    var spec = request.Spec.Trim();
    if (string.IsNullOrWhiteSpace(spec)) return Results.BadRequest(...);
    if (spec.Length > auditService.MaxInputLength) return Results.StatusCode(413);

    httpContext.Response.ContentType = "text/event-stream";
    // headers: Cache-Control=no-cache, Connection=keep-alive

    try
    {
        await foreach (var chunk in auditService.AuditAsync(sanitizedRequest, ct))
        {
            var encoded = JsonSerializer.Serialize(chunk);
            await httpContext.Response.WriteAsync($"data: {encoded}\n\n", ct);
            await httpContext.Response.Body.FlushAsync(ct);
        }
    }
    catch (OperationCanceledException) { /* client disconnected */ }
    catch (Exception ex)
    {
        // Rate limit detection via message content
        var message = ex.Message.Contains("429")
            ? "Rate limit reached. Please wait a moment and try again, or switch to a provider with higher limits."
            : "An error occurred. Please try again.";
        var sentinel = JsonSerializer.Serialize($"[SPECAUDIT_ERROR] {message}");
        await httpContext.Response.WriteAsync($"data: {sentinel}\n\n", ct);
        await httpContext.Response.Body.FlushAsync(ct);
    }

    return Results.Empty; // Must return Empty for SSE endpoints
}).RequireRateLimiting("AuditPolicy");
```

**Key behavior:**
- Every chunk is `JsonSerializer.Serialize(string)` → double-encoded JSON string in `data:` line
- The empty spec check runs `Trim()` first (so whitespace-only is rejected)
- The `MaxInputLength` check is against the original (untrimmed) length
- Rate limit detection is heuristic: checks if `ex.Message.Contains("429")`
- Non-429 exceptions send a generic sanitized message (was `ex.Message` — vulnerability fix)
- `RequireRateLimiting("AuditPolicy")` applies the fixed-window rate limiter to this endpoint only
- `/health` and `/api/config` are NOT rate-limited
- Abandoned streams (client disconnect) are silently caught via `OperationCanceledException`

#### `GET /api/config` — Provider Info

```csharp
app.MapGet("/api/config", (IOptions<AiOptions> options) =>
    Results.Ok(new { providerName = options.Value.ProviderName }));
```

Returns only `providerName`. **Never exposes the API key.** Verified by test `GetConfig_DoesNotReturnApiKey`.

#### `GET /api/providers` — Available Providers (NEW)

```csharp
app.MapGet("/api/providers", (IOptions<AiProvidersConfig> config) =>
    Results.Ok(config.Value.Providers));
```

Returns the `AiProviders.Providers` dictionary with id, name, models, and defaultModel for each. The frontend fetches this at startup to populate the provider/model dropdown.

#### `GET /api/diagnose` — AI Provider Diagnostics (NEW)

```csharp
app.MapGet("/api/diagnose", async (SpecAuditService auditService, HttpContext httpContext,
    [FromQuery] string? mode, IOptions<AiOptions> aiOptions, IOptions<AiProvidersConfig> providerConfig) =>
{
    // Tests chat completions connectivity — supports ?mode=raw (default) and ?mode=sdk
    // Returns latency, model used, and any error details
});
```

Used for debugging provider connectivity issues. Tests both raw HTTP and SDK modes.

#### `GET /api/test-error` — Sentry Verification (NEW)

```csharp
app.MapGet("/api/test-error", () =>
{
    throw new InvalidOperationException("Test error for Sentry verification");
});
```

Intentional throw — triggers Sentry exception capture to verify DSN is configured correctly.

### 4.4 Models

#### Request Model
```csharp
public sealed record AuditRequest(
    string Spec,
    string? SpecFormat,
    string? Provider = null,
    string? Model = null
);
```

*(No response models — `AuditResponse.cs` was deleted as dead code. The structured JSON is parsed inline in `SpecAuditService.ExtractStructuredJson()` using `System.Text.Json.JsonDocument`. The frontend defines its own `Finding`, `AuditSummary`, and `AuditDimensions` interfaces in `types/audit.ts`.)*

### 4.5 Configuration

#### `AiOptions`

```csharp
public sealed class AiOptions
{
    public string ApiKey { get; init; } = string.Empty;      // from user-secrets or env
    public string BaseUrl { get; init; } = string.Empty;      // e.g., https://api.groq.com/openai/v1
    public string ModelId { get; init; } = string.Empty;      // e.g., llama-3.3-70b-versatile
    public string ProviderName { get; init; } = "Custom";     // display only
    public int MaxTokens { get; init; } = 4096;
    public int MaxInputLength { get; init; } = 100_000;
}
```

#### `AiProviderOptions` and `AiProvidersConfig` (NEW — Multi-Provider Support)

```csharp
public sealed class AiProviderOptions
{
    public string BaseUrl { get; init; } = string.Empty;
    public string DefaultModel { get; init; } = string.Empty;
    public List<string> Models { get; init; } = new();
}

public sealed class AiProvidersConfig
{
    public Dictionary<string, AiProviderOptions> Providers { get; init; } = new();
}
```

**appsettings.json (current):**
```json
{
  "Ai": {
    "ProviderName": "Groq",
    "BaseUrl": "https://api.groq.com/openai/v1",
    "ModelId": "llama-3.3-70b-versatile",
    "MaxTokens": 4096,
    "MaxInputLength": 100000
  },
  "AiProviders": {
    "Providers": {
      "Groq": {
        "BaseUrl": "https://api.groq.com/openai/v1",
        "DefaultModel": "llama-3.3-70b-versatile",
        "Models": ["llama-3.3-70b-versatile", "mixtral-8x7b-32768", "gemma2-9b-it"]
      },
      "Together": {
        "BaseUrl": "https://api.together.xyz/v1",
        "DefaultModel": "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
        "Models": ["meta-llama/Llama-3.3-70B-Instruct-Turbo-Free", "mistralai/Mixtral-8x22B-Instruct-v0.1"]
      },
      "OpenAI": {
        "BaseUrl": "https://api.openai.com/v1",
        "DefaultModel": "gpt-4o-mini",
        "Models": ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo"]
      }
    }
  }
}
```

---

## 5. Frontend Implementation (Source-Level Detail)

### 5.1 Types (`types/audit.ts`)

```typescript
export interface AuditRequest { spec: string; specFormat?: 'yaml' | 'json'; provider?: string; model?: string; }
export type AuditStatus = 'idle' | 'loading' | 'streaming' | 'complete' | 'error';
export type SeverityLevel = 'CRITICAL' | 'WARNING' | 'INFO';

export interface Finding {
  severity: SeverityLevel; title: string; category: string;
  location: string; issue: string; recommendation: string;
}

export interface AuditDimensions {
  security: number; restConformance: number;
  schemaCompleteness: number; documentationQuality: number;
}

export interface AuditSummary {
  totalFindings: number; critical: number; warnings: number; info: number;
  verdict: string; governanceScore: number; endpointsAnalyzed: number;
  dimensions: AuditDimensions;
}

export interface AuditState {
  status: AuditStatus; result: string; findings: Finding[];
  summary: AuditSummary | null; error: string | null; specFormat: string | null;
}

export interface AuditResult {
  version: 1; result?: string;
  findings: Finding[]; summary: AuditSummary | null;
  exportedAt: string; specFormat: string | null;
}
```

### 5.2 SSE Client (`api/auditClient.ts`)

```typescript
export async function auditStream(
  payload: AuditRequest,
  onChunk: (chunk: string) => void,
  signal: AbortSignal,
  onStructured?: (data: { findings: Finding[]; summary: AuditSummary }) => void
): Promise<void>
```

**Flow:**
1. `fetch('/api/audit', { method: 'POST', body: JSON.stringify(payload), signal })`
2. Check `response.ok` — if not, throw with status + body text (no retry)
3. Get `response.body.getReader()` for streaming
4. Loop: `reader.read()` → `decoder.decode(value, { stream: true })` → `parseSSEChunks(buffer, decoded)`
5. For each extracted chunk:
   - `JSON.parse(rawChunk)` to get the string content
   - If starts with `[SPECAUDIT_ERROR]` → throw named error
   - If starts with `[SPECAUDIT_STRUCTURED]` → `JSON.parse` the JSON, call `onStructured`, `continue`
   - Otherwise → call `onChunk(chunk)`

**`isValidStructuredData()` type guard (new):**
```typescript
function isValidStructuredData(data: unknown): data is { findings: Finding[]; summary: AuditSummary } {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.findings)) return false;
  if (typeof obj.summary !== 'object' || obj.summary === null) return false;
  // Validates each finding has required string fields
  // Validates summary has numeric totalFindings, critical, warnings, info + string verdict
  return true;
}
```
This guard prevents `onStructured` from being called with malformed payloads. If validation fails, the chunk is silently skipped (same behavior as invalid JSON).

**Edge cases:**
- No `onStructured` callback → structured data silently ignored
- Invalid JSON in structured sentinel → try/catch ignores, continues
- Malformed JSON (wrong shape) → `isValidStructuredData` returns false → silently skipped
- SSE partial line between reads → buffer accumulates via `parseSSEChunks`

### 5.3 SSE Parser (`utils/parseSSEChunks.ts`)

```typescript
export function parseSSEChunks(buffer: string, incoming: string): SSEParseResult {
  const combined = buffer + incoming;
  const lines = combined.split('\n');
  const remainingBuffer = lines.pop() ?? '';  // last line might be partial
  const chunks: string[] = [];
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      chunks.push(line.slice(6)); // extract content after "data: "
    }
  }
  return { chunks, remainingBuffer };
}
```

Only extracts `data:` lines. All other SSE lines (`event:`, `id:`, etc.) are silently ignored.

### 5.4 State Hook (`hooks/useAudit.ts`)

**State shape:** `AuditState` with `status`, `result`, `findings[]`, `summary|null`, `error`, `specFormat`

**State machine:**
```
idle → loading → streaming → complete
                         ↘ error
```

**Error handling (no retry):**
```typescript
// In catch block:
setState({ status: 'error', result: '', findings: [], summary: null, error: err.message, specFormat: payload.specFormat ?? null });
```

Rate-limit retry with exponential backoff was **removed** in `3ffe8d6`. Errors are now shown immediately without retry — simpler UX and avoids state conflicts.

**Duration/Structured data integration:**
```typescript
await auditStream(
  payload,
  (chunk) => setState(s => ({ ...s, result: s.result + chunk })),
  abortRef.current!.signal,
  (data) => setState(s => ({ ...s, findings: data.findings, summary: data.summary }))
);
```

**`reset()` function:**
- Aborts any in-flight stream
- Resets state to `{ status: 'idle', result: '', findings: [], summary: null, error: null, specFormat: null }`

### 5.5 App.tsx — Shell Component

**Key variable — stripped markdown:**
```typescript
const JSON_MARKER = '```json';
const markerIndex = state.result.lastIndexOf(JSON_MARKER);
const strippedResult = markerIndex === -1
  ? state.result
  : state.result.slice(0, markerIndex);
```

Uses `lastIndexOf('```json')` to find the last JSON fence. If found, everything before it is used as the display content; if not found, the full result is used. This replaces the old regex approach and matches the backend's `ExtractStructuredJson` technique.

**Export handlers (4 total):**

| Handler | Data | MIME | Filename |
|---------|------|------|----------|
| `handleCopy` | `strippedResult` | — (clipboard) | — |
| `handleDownload` | `strippedResult` | `text/markdown` | `specaudit-report-<ts>.md` |
| `handleExportPdf` | `strippedResult` | — (pdfmake) | `specaudit-report-<ts>.pdf` |
| `handleExportJson` | `findings[]` + `summary` (+ `result` fallback) | `application/json` | `specaudit-report-<ts>.json` |

**Layout:** 2-column grid on large screens (`lg:grid-cols-2`), stacked on mobile:
- Left: `InputPanel` (spec textarea + buttons)
- Right: "Audit Results" header with action buttons + `ResultPanel`

**Action buttons** appear only when `state.result` is non-empty:
- Copy, Download (MD), Export PDF, Export JSON
- All disabled during streaming (except buttons have `disabled` prop)
- Buttons use `variant="ghost"` (subtle styling)

**Provider name** displayed in header, fetched from `GET /api/config` on mount.

### 5.6 ResultPanel.tsx — Markdown Renderer

```tsx
const { containerRef, isAtBottom, scrollToBottom, scrollToTop } = useAutoScroll({ deps: [content], isStreaming });
```

Uses `useAutoScroll` with the `isStreaming` option — uses `behavior: 'auto'` during streaming (instant scroll) and `'smooth'` when streaming has stopped.

```tsx
<div ref={containerRef} className="relative w-full mt-6 max-h-[60vh] overflow-y-auto rounded-lg"
     style={{ padding: '5px' }}>
```

**Children:**
- If `content === ''` and not streaming → skeleton loading (3 animated bars)
- If content exists → `ReactMarkdown` with `remarkGfm` and custom components:
  - **`h3`**: Detects `[CRITICAL]`, `[WARNING]`, `[INFO]` prefixes → renders severity block with colored border + badge
  - **`code`**: Block code → dark `<pre>` with scroll; Inline code → amber monospace
  - **`hr`** → `<hr>` with border styling
  - **`strong`** → lighter color for emphasis
  - **`p`** → muted text color
- Severity filter buttons (CRITICAL/WARNING/INFO toggles)
- Streaming indicator → blinking cursor
- Scroll button → sticky `bottom-3`, shows up/down arrow

**Severity color scheme:**
| Severity | Border | Badge Background | Text |
|----------|--------|-----------------|------|
| CRITICAL | `red-500` | `red-500/20` | `red-300` |
| WARNING | `amber-500` | `amber-500/20` | `amber-300` |
| INFO | `blue-400` | `blue-400/20` | `blue-300` |

Light mode overrides: `light:bg-red-50`, `light:text-red-600`, etc.

### 5.7 InputPanel.tsx — Spec Input

- `<textarea>` with monospace font, min-height 300px
- Format toggle buttons: "YAML" / "JSON" (toggle to `undefined` to deselect)
- Character counter with color transitions: normal (`text-slate-400`) → warning at 80k (`text-amber-400`) → over limit at 100k (`text-red-400`)
- "Run Audit" button disabled when: empty, over limit, `status === 'loading'`, or `status === 'streaming'`
- `status === 'loading'` was added to prevent double-click abort/restart while a retry is in progress
- "Stop" button shown during streaming (red/danger variant)

### 5.8 PDF Export (`utils/exportPdf.ts`)

**pdfmake integration:**
- UMD build with type assertion workaround (`pdfmakeModule as unknown as PdfMakeInstance`)
- Roboto fonts loaded from bundled `vfs_fonts.js`
- `markdownToContent()` — line-by-line parser that handles:
  - `# Heading` → h1 (18pt, bold)
  - `## Heading` → h2 (14pt, bold)
  - `### [SEVERITY] Title` → colored table (4px border accent, badge cell + title cell)
  - `` ``` `` → code block detection: `line.trimEnd().match(/^```(\w*)$/)` (handles CRLF)
  - `` `code` `` → inline code (amber text, light background)
  - `**bold**` → bold text
  - `---` → horizontal line
  - Plain text → paragraph with inline formatting
- `exportPdf(content)` → creates document, triggers download

### 5.9 Auto-Scroll Hook (`hooks/useAutoScroll.ts`)

```typescript
interface UseAutoScrollOptions {
  deps: unknown[];
  threshold?: number;
  isStreaming?: boolean;
}

export function useAutoScroll({ deps, threshold = 50, isStreaming = false }: UseAutoScrollOptions) {
```

**`isStreaming` option (new):**
- When `true`, scroll behavior uses `'auto'` (instant jump, no animation)
- When `false`/omitted, scroll behavior uses `'smooth'` (animated scroll)
- This prevents jarring animation jank during high-frequency content updates while streaming

**Usage in ResultPanel:**
```typescript
const { containerRef, isAtBottom, scrollToBottom, scrollToTop } = useAutoScroll({ deps: [content], isStreaming });
```

### 5.10 UI Components

| Component | Props | Purpose |
|-----------|-------|---------|
| `Button` | `variant: 'primary' | 'ghost' | 'danger'`, `size: 'sm' | 'md'` | Reusable button |
| `Card` | `className` | Content container with border |
| `Spinner` | `size: 'sm' | 'md' | 'lg'` | Animated loading indicator |
| `ThemeToggle` | `theme, onToggle` | Sun/moon icon button |
| `ScrollButton` | `direction: 'up' | 'down'`, `onClick` | Floating scroll control |

### 5.11 Session History Hook (`hooks/useHistory.ts`)

```typescript
export function useHistory() {
  // Returns: { records, saveRecord, deleteRecord, clearHistory, setActiveRecord, activeRecord }
}
```

**Behavior:**
- Stores `AuditRecord[]` in localStorage under key `specaudit-history`
- Each record: `{ id, spec, specFormat, result, findings, summary, timestamp, status }`
- LRU eviction at ~4 MB (serialized length check before each save)
- `saveRecord` appends new entry (evicts oldest if over limit)
- `deleteRecord` removes by id
- `clearHistory` removes all entries
- `setActiveRecord` loads a past audit into the current state
- Auto-loads on mount from localStorage

### 5.12 Toast/Snackbar System (`hooks/useToast.ts` + `hooks/useToast.tsx` + `components/ui/ToastContainer.tsx`)

**`useToast.ts`:**
```typescript
export function useToast() {
  // Returns: { toasts, addToast, removeToast }
  // addToast(message, type?: 'success' | 'error' | 'info', duration?: 3000)
}
```

React context-based notification system:
- `ToastProvider` wraps the app, provides context
- `useToast()` hook consumes context in any component
- Toasts auto-dismiss after `duration` ms (default 3000ms)
- Types get different icon + color: success (green), error (red), info (blue)
- Stack grows upward, newest at top
- `removeToast` allows manual dismissal

**`ToastContainer.tsx`:**
```tsx
<div className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2">
  {toasts.map(toast => (
    <div key={toast.id} className="...">{toast.message}</div>
  ))}
</div>
```
Positioned fixed bottom-right, stacked vertically.

### 5.13 Provider Selector (`components/ui/ProviderSelector.tsx`)

```tsx
export function ProviderSelector({ selectedProvider, selectedModel, onProviderChange, onModelChange }: Props)
```

- Fetches `GET /api/providers` on mount
- Dropdown 1: Provider name (Groq, Together, OpenAI)
- Dropdown 2: Model list (fetched from the selected provider's `Models` array)
- Falls back to hardcoded defaults if fetch fails
- Props propagate to `InputPanel` → `AuditRequest`

### 5.14 History Sidebar (`components/features/HistorySidebar.tsx`)

```tsx
export function HistorySidebar({ isOpen, onToggle, records, onSelect, onDelete, onClear }: Props)
```

- Collapsible sidebar from the left edge
- Toggle button (hamburger icon) in the top-left of the header
- Lists past audits with timestamp, spec preview, status badge
- `onSelect` loads a record into the audit state
- `onDelete` removes a single record
- `onClear` removes all records
- Shows empty state when no records exist

### 5.15 Filtering and Highlighting Utilities

#### `filterMarkdown.ts`
```typescript
export function filterMarkdown(markdown: string, enabledSeverities: SeverityLevel[]): string
```

- Splits markdown into blocks at `\n(?=### )` boundaries
- Each block starts with `### [SEVERITY] Title`
- Filters out blocks whose severity is not in `enabledSeverities`
- Returns concatenated remaining blocks

#### `highlightText.ts`
```typescript
export function highlightText(text: string, query: string): string
```

- Wraps matching text in `<mark>` tags for CSS highlight styling
- Case-insensitive matching
- Returns original text if query is empty
- Escapes special regex characters in query

### 5.16 CSS / Dark Mode (`index.css`)

```css
@import "tailwindcss";
@custom-variant light (&:where(.light, .light *));
```

- Tailwind v4 with `@custom-variant` for dark mode (instead of v3's `dark:`)
- `.light` class toggled on `<html>` element
- Components use `light:` prefix for light mode styles
- Preference persisted in `localStorage` via `useTheme` hook

### 5.17 Build Configuration

**`vite.config.ts`:**
```typescript
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: { exclude: ['pdfmake'] },
  server: { proxy: { '/api': 'http://localhost:5000' } },
  test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test-setup.ts'] },
});
```

**`tsconfig.app.json` (strict):**
```json
{
  "compilerOptions": {
    "target": "es2023", "lib": ["ES2023", "DOM"],
    "moduleResolution": "bundler", "verbatimModuleSyntax": true,
    "noEmit": true, "jsx": "react-jsx",
    "noUnusedLocals": true, "noUnusedParameters": true,
    "erasableSyntaxOnly": true, "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

---

## 6. Complete Regex Reference

| Purpose | File | Regex | Notes |
|---------|------|-------|-------|
| Strip JSON block from display | `App.tsx` line 19 | `lastIndexOf('```json')` then `slice(0, markerIndex)` | No regex — finds last ```json fence, uses everything before it |
| SSE data line extraction | `parseSSEChunks.ts` line 13 | `line.startsWith('data: ')` | String prefix check, not regex |
| Severity detection | `parseSeverity.ts` | `text.includes('[CRITICAL]')` | Simple string includes, 3 variants |
| PDF severity block | `exportPdf.ts` line 166 | `/^###\s+\[(CRITICAL\|WARNING\|INFO)\]\s*(.*)$/` | Captures severity + title |
| PDF code fence | `exportPdf.ts` line 146 | `/^```(\w*)$/` with `line.trimEnd()` | Optional language tag — `trimEnd()` handles CRLF |
| PDF inline code | `exportPdf.ts` line 34 | ``/(`[^`]+`)/`` | Backtick-delimited |
| PDF bold | `exportPdf.ts` line 48 | `/(\*\*[^*]+\*\*)/` | Double-asterisk |
| PDF h1 | `exportPdf.ts` line 173 | `/^#\s+(.+)$/` | Single hash |
| PDF h2 | `exportPdf.ts` line 186 | `/^##\s+(.+)$/` | Double hash |
| Block splitting (severity filter) | `filterMarkdown.ts` | `/\n(?=### )/` | Splits at any `###` heading — updated from severity-only regex to fix Governance Score collapse |

---

## 7. Tests (Complete Coverage Map)

### 7.1 Frontend — ~314 tests, 22 files, vitest

| File | Tests | What it covers |
|------|-------|----------------|
| `utils/__tests__/parseSSEChunks.test.ts` | ~6 | SSE buffer boundary, partial lines, `data:` extraction |
| `utils/__tests__/parseSeverity.test.ts` | ~6 | Severity detection from heading text |
| `utils/__tests__/filterMarkdown.test.ts` | 14 | Block splitting with `/\n(?=### )/`, severity filtering, real-fixture integration |
| `utils/__tests__/highlightText.test.ts` | ~6 | Keyword search, case-insensitive match, `<mark>` tag wrapping, empty query |
| `utils/__tests__/splitIntoBlocks.test.ts` | ~4 | Block splitting at heading boundaries, edge cases |
| `utils/__tests__/exportPdf.test.ts` | 35 | markdownToContent: severity blocks, code fences, headings, inline formatting, HRs, paragraphs, edge cases |
| `hooks/__tests__/useAudit.test.tsx` | ~10 | State machine transitions, retry logic, abort, reset, structured data callback |
| `hooks/__tests__/useAutoScroll.test.tsx` | ~4 | Scroll position detection, auto-scroll behavior |
| `hooks/__tests__/useTheme.test.tsx` | ~3 | Toggle state, localStorage persistence |
| `hooks/__tests__/useHistory.test.tsx` | ~8 | Session history CRUD, LRU eviction, localStorage persistence |
| `hooks/__tests__/useToast.test.tsx` | ~6 | Toast add/remove, auto-dismiss, context provider |
| `components/ui/__tests__/Button.test.tsx` | ~4 | Variant rendering, click handler, disabled state |
| `components/ui/__tests__/ScrollButton.test.tsx` | ~2 | Direction prop, click event |
| `components/ui/__tests__/ThemeToggle.test.tsx` | ~2 | Icon rendering, click toggle |
| `components/ui/__tests__/ProviderSelector.test.tsx` | ~6 | Provider/model dropdown, API fetch, fallback |
| `components/ui/__tests__/ToastContainer.test.tsx` | ~5 | Toast rendering, dismiss, type styling |
| `components/features/__tests__/InputPanel.test.tsx` | ~8 | Spec input, format toggle, character count, submit/abort, loading state |
| `components/features/__tests__/ResultPanel.test.tsx` | ~6 | Skeleton loading, markdown render, severity styling, streaming cursor |
| `components/features/__tests__/HistorySidebar.test.tsx` | ~6 | Sidebar open/close, record list, select/delete/clear, empty state |
| `components/features/__tests__/App.test.tsx` | ~22 | Copy, Download, Export PDF, Export JSON buttons; JSON envelope shape; structured data vs fallback; trailing newline |
| `api/__tests__/auditClient.test.ts` | ~8 | SSE streaming, error sentinel, structured sentinel, invalid JSON, abort signal |
| `__tests__/integration/feature-pipeline.test.ts` | 32 | End-to-end flow with real FraudLabs fixture: SSE chunks, content structure, export PDF, download, copy, structured sentinel |

### 7.2 Backend — ~30 tests, 6 files, xUnit

| File | Tests | What it covers |
|------|-------|----------------|
| `ExtractStructuredJsonTests.cs` | 7 | Valid JSON block, no block, invalid JSON, multiple blocks (only last), empty block, whitespace-only, **text after block now ALLOWED** |
| `EndpointValidationTests.cs` | 6 | Empty spec (400), whitespace-only (400), oversized (413), trimmed spec accepted (200), GET /api/config returns providerName, GET /api/config does not return apiKey |
| `UserMessageBuilderTests.cs` | 3 | Yaml format hint, auto-detect fallback, spec content after format hint |
| `AiOptionsValidationTests.cs` | 3 | Missing BaseUrl throws, missing ModelId throws, **missing ApiKey throws** |
| `DiagnoseEndpointTests.cs` | 7 | Diagnose endpoint: raw mode, SDK mode, invalid key, network error, response shape, latency field, error propagation |
| `SentryStartupTests.cs` | 2 | Sentry not initialized when DSN missing (no-op); Sentry configured when DSN present |

### 7.3 Integration Test Fixture

**`test-fixtures/fraudlabs-swagger.json`:**
- Real FraudLabs Pro Fraud Detection OpenAPI 3.0.1 specification
- ~2 endpoints: `/v1/order/feedback` (POST), `/v1/order/screen` (POST)
- Full schema definitions, security requirements, response models

**`test-fixtures/fraudlabs-audit-result.md`:**
- Real AI-generated audit output (14 findings):
  - **6 CRITICAL:** Missing security scheme, API keys as query params, missing rate limiting, insecure HTTP method, missing 404, missing 401/403
  - **4 WARNING:** Inconsistent response envelope, missing summary, missing description, inconsistent casing
  - **4 INFO:** Missing contact, missing tags, missing additionalProperties, missing 500
- Governance score: 60/100 (Security 15, REST 15, Schema 10, Documentation 20)

Test uses mocked SSE stream with these chunks to verify the full pipeline works.

---

## 8. All Features (Completed)

| Feature | Commit | Description |
|---------|--------|-------------|
| Copy to Clipboard | `0730715` | Copies markdown to clipboard |
| Export as Markdown (Download) | `76d167e` | Downloads `.md` file |
| Rate-limit retry | `9c2c58e` | Exponential backoff (1s/2s/4s, max 3) — **removed in later build** — now shows error immediately |
| Auto-scroll results | `85c9661` | Scroll-to-bottom during streaming |
| Dark mode / Light mode toggle | `598fe56` | Persistent theme preference |
| Input character counter | Step 7 | 100k limit with color transition |
| CI for PRs | `5a2e250` | GitHub Actions CI pipeline |
| Ship agent (pipeline orchestrator) | — | `.opencode/agents/ship.md` |
| Error UX (inline validation, status cards) | Steps 7+9 | Validation, error display |
| Export as PDF | *(re-implemented)* | pdfmake native PDF generation |
| Integration tests (real OpenAPI fixtures) | `517968b` | 32 tests with FraudLabs fixture |
| Export as JSON (basic) | `8145305` | Raw markdown in JSON envelope |
| Structured JSON export | `37b7a0d` | Finding[] + Summary objects |
| 5px result panel padding | `c7fc1d4` | Content no longer touches edges |
| JSON block stripped from display | `c7fc1d4` | JSON only accessible via export button |
| JSON block stripped from all exports | `775b729` | Only JSON button has structured data |
| Ship agent delegation loopholes closed | — | bash locked to git only |
| Severity filter toggles | `5272c54` | CRITICAL/WARNING/INFO visibility buttons |
| Severity filter block splitting fix | `227231b` | Regex `/\n(?=### \[(?:CRITICAL\|WARNING\|INFO)\])/` — isolates each finding (later updated to `/\n(?=### )/` in `bbb0faf`) |
| Pipeline enforcement (NO SKIPPING STAGES) | `b66d2c9` | Full pipeline mandatory for ALL changes |
| Sanitized error messages | `ac1d7b5` | Non-429 errors show generic message instead of `ex.Message` |
| Fire-and-forget fix in retry | `ac1d7b5` | `audit(payload, true)` → `await audit(payload, true)` |
| Structured data validation | `ac1d7b5` | `isValidStructuredData()` type guard in auditClient.ts |
| Loading-state button guard | `484af5e` | `status === 'loading'` added to InputPanel disabled condition |
| ApiKey startup validation | `484af5e` | Missing ApiKey now throws at startup |
| CRLF-safe code fence detection | `4cded11` | `line.trimEnd().match()` in exportPdf.ts |
| LastIndexOf JSON extraction | `4cded11` | Replaced `[GeneratedRegex]` with manual string search |
| Scroll behavior by streaming state | `4cded11` | `isStreaming` option in useAutoScroll — `'auto'` vs `'smooth'` |
| Dead code removal | `4cded11` | `AuditResponse.cs` deleted entirely |
| Rate limiter middleware | `af82582` | Fixed-window 10 req/min per IP, 429 rejection |
| Docker build fix (module declarations) | `a403458` | Moved `declare module '*.md?raw'` to `vite-env.d.ts` |
| Permanent tsc -b fix | `60f8afd` | Exclude test dirs from tsconfig.app.json; add `vi` import in useTheme.test.tsx; add `nul` to .gitignore and .dockerignore |
| Build agent bash lockdown | `e09745a` | Strict bash allowlist in opencode.json — deny all, allow only dotnet/npm/npx build/test commands |
| Dark mode respects prefers-color-scheme | `e09745a` | useTheme.ts checks `prefers-color-scheme: light` before defaulting to dark |
| JSON export uses strippedResult | `e09745a` | App.tsx JSON export fallback uses `strippedResult` instead of `state.result` |
| JSON block display via lastIndexOf | `ce16a18` | Replace regex with `lastIndexOf('```json')` for stripping JSON block from user-visible display |
| Sentry monitoring (backend) | `d9f6fb0` | `Sentry.AspNetCore` package, Sentry init in `Program.cs` gated by `Sentry:Dsn`, API key scrubbing via `SetBeforeSend` |
| Sentry monitoring (frontend) | `d9f6fb0` | `@sentry/react` package, `Sentry.init` in `main.tsx` gated by `VITE_SENTRY_DSN`, `ErrorBoundary` wrapping `<App />`, `beforeSend` stripping request headers |
| Sentry Docker config | `d9f6fb0` | `VITE_SENTRY_DSN` build arg in `docker-compose.yml`, `ARG VITE_SENTRY_DSN` in `Dockerfile` |
| Search within results | `679149a` | Inline keyword search with highlight in audit output |
| Copy individual finding | `10c9d94` | Per-block copy icon in ResultPanel |
| Keyboard shortcuts | `75fd570` | Ctrl+Enter to run, Escape to abort streaming |
| Remove NetworkTimeout | `be75242` | Fixes AI streaming hang on slow responses — remove `NetworkTimeout` from OpenAI client |
| Fix AI streaming token passthrough | `5230ea8` | Don't pass `CancellationToken` to `CompleteChatStreamingAsync` |
| Diagnostic endpoint (raw + SDK) | `4be9fb5`+`8c6b3f7`+`e1207a3` | `GET /api/diagnose` with `?mode=raw\|sdk` for provider connectivity debugging |
| Fresh client per request | `7642f2c` | Fresh `OpenAIClient` per request — prevents HTTP/2 connection pool poisoning |
| Raw HttpClient + manual SSE | `80f5598` | Replace OpenAI SDK streaming with raw `HttpClient` + manual SSE `data:` line parsing |
| Spec file upload | `a059f4d` | Drag-and-drop + file picker for `.yaml`/`.yml`/`.json` files |
| Session history + sidebar | `7d90689`+`9ff6d50`+`8457f6f` | localStorage with LRU eviction (4 MB), collapsible sidebar, Failed state on error |
| Toast/snackbar system | `393aa77` | React context-based notification system with auto-dismiss |
| Configurable provider/model | `81761c9` | UI dropdown fetches `GET /api/providers` at startup |
| Expandable findings | `57fcb4b` | Collapse/expand groups by severity with CSS transition animation |
| Governance Score collapse fix | `bbb0faf` | Block splitter: `/\n(?=### )/` (any heading, not just severity) — fixes Governance Score being swallowed |

## 9. Commit History (Recent)

```
9f7bd00 docs: move Monitoring to Completed in ROADMAP.md
d9f6fb0 feat: add Sentry monitoring (frontend + backend)
ce16a18 fix: strip JSON block from display immediately via lastIndexOf
e09745a fix: build agent bash lockdown, JSON export stripped fallback, prefers-color-scheme
60f8afd fix: permanently prevent tsc -b failures on test files + nul ignore
eae5a9e docs: update changes.md with Docker build fix details
a403458 fix: move *.md?raw module declaration to vite-env.d.ts
af82582 feat(I): add rate limiter middleware to /api/audit endpoint
4cded11 fix(C,D,E,J): CRLF fence detection, LastIndexOf extraction, scroll behavior, remove dead types
484af5e fix(B,F): disable button during loading, validate ApiKey at startup
ac1d7b5 fix(A,G,H): sanitize error output, fix retry await, validate structured JSON
b66d2c9 chore: strengthen pipeline enforcement with mandatory full pipeline for all changes
227231b fix: severity filter now correctly isolates individual findings
9604a93 fix: cast querySelector result to HTMLElement for within()
73e7e49 chore: tighten pipeline agent permissions and expand prompts
2dcdfbe docs: record severity filter in ROADMAP.md
5272c54 feat: add severity filter toggles for CRITICAL/WARNING/INFO
25c129d docs: add updated_spec.md for AI code review + update README features
775b729 fix: strip JSON block from all user-facing exports
c7fc1d4 fix: add 5px padding to result panel, strip JSON block from display
c47805b docs: record structured JSON export in ROADMAP.md
37b7a0d feat: structured AI output for practical JSON export (Option C)
2eaaa8c fix: replace made-up JSON icon with correct Lucide braces icon
e6a7606 fix: append trailing newline to exported JSON for Prettier compat
9a44c22 fix: remove unused revokeObjectURL declarations in App.test.tsx
e7169e6 docs: update ROADMAP with Export as JSON commit hash
8145305 feat: add Export as JSON button for audit results
517968b feat: add integration tests with real OpenAPI fixture data
cec4045 fix: replace html2pdf.js with pdfmake for native PDF generation
5624aab feat: ship agent auto-pick next feature from ROADMAP.md
d8b337f fix: enforce pipeline delegation via permissions
bbb0faf fix: Governance Score no longer collapses with INFO findings
57fcb4b feat: add expandable/collapsible findings grouped by severity
a950e7a fix: update Groq models list and improve error diagnostics
c480f45 fix: relax flaky DiagnoseEndpointTests assertion
81761c9 feat: add configurable AI provider/model dropdown in UI
393aa77 feat: add toast/snackbar notification system
3ffe8d6 fix: remove rate limit retry logic — immediate error instead
8457f6f fix: save history records on audit error, show Failed state
9ff6d50 fix: 5 UX fixes for session history sidebar
e7c41e5 docs: update ROADMAP.md with commit hash for session history
7d90689 feat: add session history with localStorage persistence and sidebar
1fafb58 docs: add backend file upload to ROADMAP.md (lowest priority)
c00df3f docs: update ROADMAP.md with commit hash for spec file upload
a059f4d feat: add spec file upload with drag-and-drop and file picker
b503589 docs: update ROADMAP.md with commit hash for SSE streaming fix
80f5598 fix: replace OpenAI SDK streaming with raw HttpClient + SSE parsing
128eaef docs: record fix in ROADMAP.md
7642f2c fix: create fresh OpenAI client per request to prevent HTTP/2 connection pool poisoning
a06744a docs: record commit hash 8c6b3f7 in ROADMAP.md for SDK diagnose mode
8c6b3f7 fix: add ?mode=sdk to diagnose endpoint for SDK vs raw comparison
e1207a3 fix: update /api/diagnose to test chat completions endpoint
1d3eb88 docs: record commit hash for diagnose endpoint in ROADMAP.md
4be9fb5 fix: add /api/diagnose endpoint to debug Groq connectivity from .NET
5f1c025 docs: Record commit hash in ROADMAP.md for CancellationToken fix
5230ea8 fix: Don't pass CancellationToken to CompleteChatStreamingAsync
2a0bf45 docs: Record commit hash in ROADMAP.md for NetworkTimeout fix
be75242 fix: Remove NetworkTimeout from OpenAI client to fix AI streaming hang
db1e0ed fix: enforce SSE streaming timeout (45s) and add Serilog logging
5ec4743 fix: add title prop to Button component for keyboard shortcut tooltips
d982be3 Update ROADMAP.md: mark Keyboard shortcuts as completed
6f68b6b chore: remove stray .pipelinereview.md file
75fd570 feat: add keyboard shortcuts (Ctrl+Enter to audit, Escape to stop streaming)
64042b0 Update ROADMAP.md: mark Copy individual finding as completed
10c9d94 feat: add per-finding copy button to severity blocks
679149a feat: add search-within-results highlighting for audit output
e9b4aac docs: update changes.md with Sentry implementation details
c880987 docs: update updated_spec.md through HEAD 9f7bd00 (Sentry)
ded1dc9 docs: move Sentry monitoring to Completed in ROADMAP.md
ca0312f feat: add Sentry error tracking and monitoring
```

---

## 10. Configuration & Environment

### API Key Management

`AiProvidersConfig` is bound from `AiProviders` section in `Program.cs` — provider base URLs, models, and defaults are configured in `appsettings.json`. The `Ai:ApiKey` user-secret is shared across all providers.

| Environment | Method | Variable | Protected? |
|-------------|--------|----------|------------|
| Local dev | `dotnet user-secrets` | `Ai:ApiKey` | ✅ Not in source |
| Railway (prod) | Environment variable | `Ai__ApiKey` (double underscore) | ✅ Railway dashboard env |
| Docker Compose | `.env` file (gitignored) | `AI_API_KEY` | ✅ .gitignore |
| CI | GitHub Secrets | Not applicable (no test needs real key) | ✅ |
| Local dev / env | `appsettings.json` / env var | `Sentry:Dsn` (backend) | ✅ Optional (no-op without it) |
| Local dev / env | `.env` file | `VITE_SENTRY_DSN` (frontend) | ✅ Optional (no-op without it) |
| Docker Compose | `.env` file (gitignored) | `SENTRY_DSN` + `VITE_SENTRY_DSN` | ✅ .gitignore |

### Provider Switching

Providers are now configured dynamically via the UI dropdown. Available providers are defined in `appsettings.json` under `AiProviders.Providers`. The frontend fetches `GET /api/providers` at startup and populates the dropdown — no `appsettings.json` editing needed to switch.

| Provider | Default Model | Key prefix | Signup |
|----------|--------------|------------|--------|
| **Groq** | `llama-3.3-70b-versatile` | `gsk_` | [console.groq.com](https://console.groq.com) |
| **Together** | `meta-llama/Llama-3.3-70B-Instruct-Turbo-Free` | `tog-` | [api.together.ai](https://api.together.ai) |
| **OpenAI** | `gpt-4o-mini` | `sk-` | [platform.openai.com](https://platform.openai.com) |

### CORS

- Enabled **only in development** (`app.Environment.IsDevelopment()`)
- Allows `http://localhost:5173` only (Vite dev server)
- Production is same-origin (backend serves frontend static files via SPA fallback)

---

## 11. Infrastructure

### 11.1 Docker Multi-Stage Build (root `Dockerfile`)

```
Stage 1: node:22-alpine
  → npm ci + npm run build (produces frontend/dist/)

Stage 2: mcr.microsoft.com/dotnet/sdk:10.0
  → dotnet restore + dotnet publish (produces /app/publish/)

Stage 3: mcr.microsoft.com/dotnet/aspnet:10.0
  → COPY /app/publish from stage 2
  → COPY /app/dist as ./wwwroot from stage 1
  → EXPOSE 5000
  → ENTRYPOINT ["dotnet", "backend.dll"]
```

### 11.2 Docker Compose (`docker-compose.yml`)

```yaml
services:
  app:
    build: .   # root Dockerfile
    ports: ["5000:5000"]
    environment:
      - ASPNETCORE_ENVIRONMENT=Production
      - Ai__ApiKey=${AI_API_KEY}
    restart: unless-stopped
```

Usage: `export AI_API_KEY=... && docker compose up --build`

### 11.3 GitHub Actions CI (`.github/workflows/ci.yml`)

Two parallel jobs on push/PR to `main`:

**Backend job:**
```
dotnet restore SpecAudit.slnx
dotnet build SpecAudit.slnx --no-restore
dotnet test SpecAudit.slnx --no-build --verbosity normal
```

**Frontend job:**
```
npm ci (cached via setup-node@v6)
npm run build
npm run test
```

---

## 12. OpenCode Pipeline Agents

The project uses OpenCode with a custom pipeline for feature development:

```
ship (pipeline orchestrator)
  ├── task → plan (writes .pipeline/spec.md)
  ├── task → build (writes .pipeline/changes.md)
  ├── task → test (writes .pipeline/test-results.md)
  ├── task → review (writes .pipeline/review.md)
  └── If SHIP verdict: edit ROADMAP.md, git commit
```

### Agent Permissions

| Agent | `edit` | `write` | `bash` | `task` |
|-------|--------|---------|--------|--------|
| **ship** | `*: deny`, `ROADMAP.md: allow` | `*: deny`, `ROADMAP.md: allow` | `*: deny`, `git *: allow` | `allow` |
| **plan** | `*: deny`, `.pipeline/spec.md: allow` | `*: deny`, `.pipeline/spec.md: allow` | — | — |
| **build** | `*: allow` | `*: allow` | `*: deny` (allowlist: dotnet build/test/restore, npm run build/test, npx tsc --noEmit, npx vitest run) | — |
| **test** | — | — | `*: allow` | — |
| **review** | — | — | — | — |

**Changes in `b66d2c9`:**
- Build agent's git deny removed from permissions (no longer restricts `git` commands in build agent's `bash`)
- `ship.md` now includes "NO SKIPPING STAGES" rule — full pipeline is mandatory for ALL changes including bugs/hotfixes

The ship agent is intentionally locked down to **prevent bypassing the delegation rule** — it may only run git commands and edit ROADMAP.md. All code changes must go through `task`.

---

## 13. Key Architectural Decisions (With Rationale)

| Decision | Chosen approach | Alternative considered | Rationale |
|----------|----------------|----------------------|-----------|
| **SSE sentinel format** | String prefix in `data:` line (`[SPECAUDIT_STRUCTURED]`) | `event:` SSE type | Existing `parseSSEChunks` only handles `data:` lines. Adding `event:` would break the parser interface. The sentinel prefix is simpler, consistent with `[SPECAUDIT_ERROR]`. |
| **JSON extraction location** | Backend-side regex | Frontend-side regex | Backend has the complete text after streaming. No need to modify frontend. Consistent with error handling pattern. |
| **PDF generation** | pdfmake (native JSON→PDF) | html2pdf.js (screenshot-based) | html2pdf.js produced blank PDFs consistently. pdfmake is reliable, multi-page, no DOM dependency. |
| **AI provider abstraction** | Raw HttpClient + manual SSE | OpenAI C# client | OpenAI SDK streaming had HTTP/2 connection-poisoning and timeout issues. Raw HttpClient gives full control over SSE parsing, error handling, and connection lifecycle. Fresh client per request prevents state leaks. |
| **Dark mode** | `@custom-variant light` with `.light` class | `prefers-color-scheme` media query | User-initiated toggle overrides system preference. `.light` class on `<html>` gives Tailwind v4 access via `light:` prefix. |
| **Rate-limit handling** | Show error immediately (no retry) | Exponential backoff retry | Exponential backoff retry was removed because it caused state conflicts and UX confusion. Simpler to show error and let user retry manually. |
| **String accumulation** | `StringBuilder` (backend) + string concat (frontend) | Various | Backend chunks are small — `StringBuilder` is efficient. Frontend uses `setState` with previous state concatenation — simple and correct for React. |
| **Stripped result** | `lastIndexOf('```json')` then `slice(0, markerIndex)` | Regex `/```json[\s\S]*?```\s*$/gm` | `lastIndexOf` avoids regex, is easier to read, and correctly handles edge cases where the JSON block is not at the very end of the string. Matches the backend's `ExtractStructuredJson` approach. |
| **InternalsVisibleTo** | Backend exposes `internal static` methods to test project | Public methods | Public methods would expose implementation details. `InternalsVisibleTo` keeps the API surface clean while enabling test access. |
| **Temperature** | `0.1f` (low determinism) | Higher temperature | Audit is a deterministic task — the same spec should produce the same findings. Low temperature reduces hallucination. |
| **Rate limiter** | Backend fixed-window (10 req/min per IP) | Client-side throttling | Server-side enforcement prevents API key abuse. Built into .NET 8+ — no extra packages. Fixed window is simpler than token bucket for this use case. |
| **Block splitting (severity filter)** | Regex `/\n(?=### )/` | Regex `/\n(?=### \[(?:CRITICAL\|WARNING\|INFO)\])/` | Updated from severity-only regex to match any `###` heading. Fixes Governance Score section being swallowed because it starts with `### Governance Score` (no severity bracket). More robust — catches all top-level headings. |
| **JSON extraction method** | `LastIndexOf`/`IndexOf` string search | `[GeneratedRegex]` | Removes dependency on `System.Text.RegularExpressions`. No performance difference for this use case. Also allows text after the JSON block (regex `$` anchor rejected it). |
| **Provider resolution** | Dynamic via `AiProvidersConfig` dictionary | Single `AiOptions` config | Enables multi-provider UI dropdown. Frontend fetches `GET /api/providers` at startup. Users switch providers without editing config files. |
| **Session history** | localStorage with LRU eviction at 4 MB | Server-side database | No backend needed, survives page refresh. LRU prevents unbounded storage growth. Device-specific — tradeoff for simplicity. |
| **Toast system** | React context provider | Redux / zustand | Decouples notifications from component tree. Simple context-based API: `addToast`, `removeToast`. No extra dependencies. |
| **Spec file upload** | Frontend reads file as text, sends via existing POST /api/audit | Multipart upload endpoint | No backend changes needed. Reuses existing SSE streaming pipeline. Drag-and-drop via HTML5 File API. |

---

## 14. Edge Cases & Error Handling

| Scenario | Handler | Behavior |
|----------|---------|----------|
| **Empty spec** | Backend input validation | 400 BadRequest: "Spec payload cannot be empty." |
| **Whitespace-only spec** | Backend `Trim()` then check | Treated as empty → 400 BadRequest |
| **Oversized spec (>100k)** | Backend length check on trimmed spec | 413 Payload Too Large |
| **Rate limit (429 from AI)** | Backend reads error body, sends `[SPECAUDIT_ERROR]` | Frontend detects rate limit → throws with `"{status}: {body}"` → status 'error' (no retry) |
| **Rate limiter rejection (429)** | Backend `AddRateLimiter` returns 429 before endpoint is reached | Frontend `response.ok` check fails → throws `Audit failed (429): ...` → status 'error' (no retry) |
| **45-second server timeout** | Backend `CancellationTokenSource.CancelAfter(45s)` | `OperationCanceledException` → sends `[SPECAUDIT_ERROR]` timeout message → frontend displays timeout error |
| **Stream abortion** | Client-side `AbortController.abort()` | Backend catches `OperationCanceledException`, stream ends silently |
| **AI omits JSON block** | `ExtractStructuredJson` returns null | No sentinel sent. Findings=[], summary=null. JSON export falls back to `strippedResult` field. |
| **AI produces invalid JSON** | `JsonDocument.Parse` throws | Caught, returns null. Same fallback as above. |
| **Text after JSON block** | `LastIndexOf` ignores trailing content | Text after the JSON block is now ALLOWED (no `$` anchor). JSON is extracted regardless. |
| **Malformed sentinel on frontend** | `JSON.parse` in try/catch | Silently ignored (no error thrown). |
| **No `onStructured` callback** | TypeScript optional param, guard check | Structured sentinel ignored, continues to next chunk. |
| **SSE partial line** | `parseSSEChunks` buffers last line | Next `reader.read()` appends to buffer, splits correctly. |
| **Multiple ` ```json ` blocks** | `LastIndexOf` finds last opening fence | Only the final block is extracted. |
| **Unicode in spec/results** | JSON handles natively | Tested: "handles result with unicode characters" |
| **Missing BaseUrl/ModelId** | Backend startup validation | `InvalidOperationException` with descriptive message. |
| **API key exposed in config endpoint** | Backend only returns `ProviderName` | Verified by test: `GetConfig_DoesNotReturnApiKey`. |

---

## 15. Known Issues / Technical Debt

1. **FraudLabs swagger file in root** — `FraudLabs Pro Fraud Detection-swagger.json` at the project root is a leaked test file that should be moved to `test-fixtures/` or `.gitignore`'d.
2. **`title` tag in index.html** — Shows "frontend-tmp" instead of "SpecAudit".
3. **No spec validation** — Specs are sent directly to the AI without client-side YAML/JSON validation.
4. **No server-side persistence** — Results persist via localStorage but are device-specific. No server-side persistence or account-based history.
5. **PDF inline code styling** — Inline code in PDF exports uses `background` field which pdfmake renders as highlight rather than monospace.
6. **Sentry DSN is optional** — Without a configured `Sentry:Dsn` (backend) or `VITE_SENTRY_DSN` (frontend), the Sentry SDK initializes in no-op mode. No errors are tracked but the app functions normally.
7. **History sidebar toast timing** — "Copied!" toast may appear briefly for non-copy actions depending on timing/race conditions in the sidebar.


---

## 16. Roadmap (Upcoming Features)

✅ **Completed features** (moved from Small/Medium in previous roadmap):
- Severity filter — Toggle CRITICAL/WARNING/INFO visibility
- Search within results — Inline search + highlight
- Copy individual finding — Per-finding copy icon
- Keyboard shortcuts — Ctrl+Enter, Escape
- Spec file upload — Drag-and-drop YAML/JSON
- Session history — localStorage persistence with LRU eviction
- Audit history sidebar — Collapsible recent audits list
- Toast/snackbar system — Non-blocking notifications
- Configurable provider/model in UI — Dropdown to switch providers
- Expandable findings — Collapse/expand by severity

### Large (significant build)
- **Spec comparison** — Side-by-side diff of two audits
- **Database-backed persistence** — Postgres via Railway add-on
- **OpenAPI spec validation** — Client-side structural validation
- **GitHub App / webhook** — Auto-audit in PRs
- **Share link** — Shareable URLs for audit results

### Infrastructure
- **Staging environment** — Second Railway project
- **Custom domain** — Real domain name

---

## 17. Quick Reference — Key Files by Purpose

| Need to find... | Look in |
|-----------------|---------|
| AI prompt / system message | `backend/src/Services/SpecAuditService.cs` line 16 |
| SSE streaming endpoint | `backend/src/Endpoints/AuditEndpoints.cs` |
| Frontend state management | `frontend/src/hooks/useAudit.ts` |
| SSE client | `frontend/src/api/auditClient.ts` |
| All TypeScript types | `frontend/src/types/audit.ts` |
| Export buttons logic | `frontend/src/App.tsx` |
| Markdown rendering | `frontend/src/components/features/ResultPanel.tsx` |
| PDF export logic | `frontend/src/utils/exportPdf.ts` |
| Session history hook | `frontend/src/hooks/useHistory.ts` |
| Toast/snackbar provider | `frontend/src/hooks/useToast.ts` / `useToast.tsx` |
| Toast UI stack | `frontend/src/components/ui/ToastContainer.tsx` |
| Provider/model dropdown | `frontend/src/components/ui/ProviderSelector.tsx` |
| Collapsible history sidebar | `frontend/src/components/features/HistorySidebar.tsx` |
| Block splitting utility | `frontend/src/utils/filterMarkdown.ts` |
| Search highlight utility | `frontend/src/utils/highlightText.ts` |
| App config / dependencies | `frontend/package.json` |
| Build config / proxy | `frontend/vite.config.ts` |
| CSS / Tailwind setup | `frontend/src/index.css` |
| Multi-provider config model | `backend/src/Configuration/AiProviderOptions.cs` |
| Backend config (Groq) | `backend/appsettings.json` |
| Docker setup | `Dockerfile` + `docker-compose.yml` |
| CI pipeline | `.github/workflows/ci.yml` |
| Test fixtures | `frontend/src/test-fixtures/` |
| Backend tests | `backend.Tests/` |
| Frontend tests | `frontend/src/**/__tests__/` |
| Feature roadmap | `ROADMAP.md` |
| Pipeline agent config | `.opencode/agents/ship.md` |
| Vite type declarations (`.md?raw` module) | `frontend/src/vite-env.d.ts` |
