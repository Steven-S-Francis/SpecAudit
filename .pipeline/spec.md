# Code Review Fixes — Spec v2

## OPEN QUESTIONS

None. Each group is self-contained; commit order matters (Group 4 touches Program.cs which Group 2 also touches — apply Group 2 first, then Group 4).

---

## Overview

Four groups of fixes from code review findings A–J:

| Group | IDs | Theme | Files touched |
|-------|-----|-------|---------------|
| 1 | A, G, H | Critical bugs | AuditEndpoints.cs, useAudit.ts, auditClient.ts |
| 2 | B, F | UX and reliability | InputPanel.tsx, Program.cs |
| 3 | C, D, E, J | Code quality | exportPdf.ts, SpecAuditService.cs, useAutoScroll.ts, AuditResponse.cs, ResultPanel.tsx |
| 4 | I | Security architecture | Program.cs, backend.csproj |

---

## Group 1 — Critical bugs (A, G, H)

### A: ex.Message leaked to client

**File:** `backend/src/Endpoints/AuditEndpoints.cs`

**What:** The catch block at lines 46–54 leaks the raw exception message to the client for all non-429 exceptions. Replace `ex.Message` with a generic sanitized message.

**Changes to the catch block (lines 46–54):**
```csharp
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
```

Only the `message` variable assignment changes (line 50). No other lines change.

**Edge cases:**
- Exception from an AI provider that doesn't use "429" in the message → generic message, no info leak
- Exception that is null/empty → generic message still used
- Any non-429 exception (timeout, internal server error, AI refusal, network error) → generic message

---

### G: Fire-and-forget retry

**File:** `frontend/src/hooks/useAudit.ts`

**What:** Line 53 calls `audit(payload, true)` without `await`. The recursive retry call is fire-and-forget, so:
- Component unmount leaves dangling calls
- The outer Promise resolves while retry work is still in flight
- AbortController leaks (never cleaned up)

**Change (line 53):**
```typescript
// Before (line 53):
audit(payload, true);

// After:
await audit(payload, true);
```

No other changes in this file.

**Edge cases:**
- Multiple rapid retries still properly serialized (the `await` ensures the recursive call completes before the catch block exits)
- Abort during retry: the `err.name === 'AbortError'` check on line 42 will catch it in the recursive call, set status to 'idle' and reset retryCount correctly
- State updates are properly sequenced since `await` serializes the recursive call within the existing async flow

---

### H: Unvalidated AI JSON cast

**File:** `frontend/src/api/auditClient.ts`

**What:** After `JSON.parse` at line 57, the parsed data is passed directly to `onStructured` without validating shape. If the AI returns well-formed JSON with a different shape (e.g. `{"results":[]}` instead of `{"findings":[],"summary":{}}`), the frontend stores garbage silently.

**Changes:**

1. **Add a type guard** (new function before the `auditStream` export):
```typescript
import type { Finding, AuditSummary } from '../types/audit';

// ... existing code ...

function isValidStructuredData(data: unknown): data is { findings: Finding[]; summary: AuditSummary } {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.findings)) return false;
  if (typeof obj.summary !== 'object' || obj.summary === null) return false;
  // Verify each finding has required fields (optional but defensive)
  for (const f of obj.findings) {
    if (typeof f !== 'object' || f === null) return false;
    const finding = f as Record<string, unknown>;
    if (typeof finding.severity !== 'string') return false;
    if (typeof finding.title !== 'string') return false;
    if (typeof finding.category !== 'string') return false;
    if (typeof finding.location !== 'string') return false;
    if (typeof finding.issue !== 'string') return false;
    if (typeof finding.recommendation !== 'string') return false;
  }
  // Verify summary has required numeric fields
  const summary = obj.summary as Record<string, unknown>;
  if (typeof summary.totalFindings !== 'number') return false;
  if (typeof summary.critical !== 'number') return false;
  if (typeof summary.warnings !== 'number') return false;
  if (typeof summary.info !== 'number') return false;
  if (typeof summary.verdict !== 'string') return false;
  return true;
}
```

2. **Update the structured sentinel handling block (lines 53–62):**
```typescript
if (chunk.startsWith(STRUCTURED_PREFIX)) {
    if (onStructured) {
        try {
            const jsonStr = chunk.slice(STRUCTURED_PREFIX.length);
            const data = JSON.parse(jsonStr);
            if (isValidStructuredData(data)) {
                onStructured(data);
            }
            // If validation fails, silently ignore (same as invalid JSON)
        } catch {
            // Ignore invalid JSON in structured sentinel
        }
    }
    continue;
}
```

**Edge cases:**
- `data` is `null` or not an object → returns false
- `findings` is not an array → returns false
- `summary` is not an object → returns false
- `findings` array contains non-objects or missing required string fields → returns false
- `summary` missing required numeric/string fields → returns false
- AI sends extra fields beyond the shape → still valid (we only check required fields)
- The `continue` statement is unaffected — structured chunk still never reaches `onChunk`

---

## Group 2 — UX and reliability (B, F)

### B: Button not disabled during loading state

**File:** `frontend/src/components/features/InputPanel.tsx`

**What:** Line 67 disables the "Run Audit" button only when `isEmpty || isOverLimit || status === 'streaming'`. The `status === 'loading'` state is missing, so users can click "Run Audit" while a retry backoff is in progress (after a rate-limit error).

**Change (line 67):**
```tsx
// Before:
disabled={isEmpty || isOverLimit || status === 'streaming'}

// After:
disabled={isEmpty || isOverLimit || status === 'streaming' || status === 'loading'}
```

**Edge cases:**
- `status === 'loading'` with empty input → already disabled via `isEmpty`
- `status === 'loading'` with valid input → now properly disabled

---

### F: ApiKey missing from startup validation

**File:** `backend/Program.cs`

**What:** Line 31 validates `BaseUrl` and `ModelId` on startup but omits `ApiKey`. A missing API key causes a cryptic runtime error from the OpenAI client instead of a clear startup exception with a helpful message.

**Change (line 31):**
```csharp
// Before:
if (string.IsNullOrWhiteSpace(aiOptions.BaseUrl) || string.IsNullOrWhiteSpace(aiOptions.ModelId))
    throw new InvalidOperationException("Ai:BaseUrl and Ai:ModelId must be configured in appsettings.json.");

// After:
if (string.IsNullOrWhiteSpace(aiOptions.BaseUrl) || string.IsNullOrWhiteSpace(aiOptions.ModelId) || string.IsNullOrWhiteSpace(aiOptions.ApiKey))
    throw new InvalidOperationException("Ai:BaseUrl, Ai:ModelId, and Ai:ApiKey must be configured in appsettings.json or user-secrets.");
```

**Edge cases:**
- All three missing → exception with message mentioning all three
- Only ApiKey missing → exception still fires (note: existing tests set `Ai:ApiKey` — they already provide it)
- ApiKey is whitespace → `IsNullOrWhiteSpace` catches it

---

## Group 3 — Code quality (C, D, E, J)

### C: CRLF breaks PDF code fence detection

**File:** `frontend/src/utils/exportPdf.ts`

**What:** Line 146 matches `line.match(/^```(\w*)$/)` against raw lines split by `\n`. On Windows/CRLF (e.g. if someone copies from a Windows editor or the AI returns mixed line endings), lines end with `\r` and the `$` anchor matches before `\r`, so `\r` remains in the match results. This means:
- ` ``` ` with trailing `\r` fails the regex because `$` doesn't match after `\r` by default
- Code fence detection fails, so everything inside the code block leaks into the PDF as regular text

**Change (line 143, the loop variable):**
Actually, the simplest fix is to trim trailing whitespace including `\r` **at the point of regex matching** on line 146:

```typescript
// Before (line 146):
const codeFenceMatch = line.match(/^```(\w*)$/);

// After:
const codeFenceMatch = line.trimEnd().match(/^```(\w*)$/);
```

`trimEnd()` removes `\r`, `\n`, spaces, tabs from the end without affecting content before it.

**Edge cases:**
- Lines that legitimately end with spaces before code fence — ` ```   ` — trimmed to ` ``` ` then matched correctly
- `\r\n` lines (Windows line endings) — `trimEnd()` removes `\r`, regex matches
- `\n` lines (Unix line endings) — already matched, `trimEnd()` is a no-op here
- Inline content that happens to end with whitespace — e.g., `"text   "` — `trimEnd()` removes trailing spaces for the regex match but doesn't affect the code block content since we use `line` (not `line.trimEnd()`) when pushing to `codeBuffer` on line 158

Wait — we need to be careful. The `codeBuffer.push(line)` on line 158 pushes the un-trimmed `line`. The `trimEnd()` is only for the fence detection regex. Let me verify:

```typescript
const codeFenceMatch = line.trimEnd().match(/^```(\w*)$/);
// ... rest of code fence handling uses `line` (untrimmed) for codeBuffer
```

This is correct: `line.trimEnd()` creates a new string only for the regex test; the original `line` is used for `codeBuffer.push(line)` on line 158.

---

### D: Regex for JSON extraction

**File:** `backend/src/Services/SpecAuditService.cs`

**What:** The `[GeneratedRegex]` approach for extracting structured JSON is fragile and complex. Replace with a `LastIndexOf`-based approach that is more readable and equally robust.

**Changes:**

1. **Replace the `ExtractStructuredJson` method (lines 214–233):**
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

2. **Remove the `[GeneratedRegex]` method (lines 235–236):**
Delete:
```csharp
[GeneratedRegex(@"[\s\S]*```json\s*([\s\S]*?)\s*```\s*$")]
private static partial Regex StructuredJsonRegex();
```

3. **Remove the `partial` keyword from the class declaration (line 14):**
```csharp
// Before:
public sealed partial class SpecAuditService

// After:
public sealed class SpecAuditService
```

4. **Remove unused `using System.Text.RegularExpressions;` (line 5):**
Remove `using System.Text.RegularExpressions;` since it's no longer needed.

**Behavior preserved (same as regex):**
- No ` ```json ` block → `LastIndexOf` returns -1 → returns null
- Multiple ` ```json ` blocks → `LastIndexOf` finds the LAST one
- Invalid JSON → `JsonDocument.Parse` throws → caught → returns null
- Empty/whitespace-only block → `Trim()` returns empty → returns null
- Text after the JSON block → `IndexOf` for closing fence will find ` ``` ` before the trailing text → still extracts correctly

**Behavior change (intentional improvement):**
- Text after JSON block **now allowed**: The regex had `\s*$` anchor that prevented matching if text existed after the closing fence. The new `LastIndexOf` approach only looks for the last ` ```json ` and the next ` ``` ` after it. Trailing text after ` ``` ` is ignored. This is more tolerant of AI output that appends unexpected text.

---

### E: Smooth scroll fires on every SSE chunk

**File:** `frontend/src/hooks/useAutoScroll.ts`

**What:** `behavior: 'smooth'` causes a visible animation on every SSE chunk during streaming, making the experience janky. When streaming is active, `behavior: 'auto'` (instant) should be used. When streaming stops, the last scroll should be `behavior: 'smooth'`.

**Changes:**

1. **Update `UseAutoScrollOptions` interface (lines 3–6):**
```typescript
interface UseAutoScrollOptions {
  deps: unknown[];
  threshold?: number;
  isStreaming?: boolean;
}
```

2. **Update `useAutoScroll` function signature (line 8):**
```typescript
export function useAutoScroll({ deps, threshold = 50, isStreaming = false }: UseAutoScrollOptions) {
```

3. **Update the auto-scroll effect (line 31 where `behavior: 'smooth'` is used):**
```typescript
useEffect(() => {
    if (isAtBottomRef.current) {
      containerRef.current?.scrollTo?.({
        top: containerRef.current.scrollHeight,
        behavior: (isStreaming ? 'auto' : 'smooth') as ScrollBehavior,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
```

The `deps` array already triggers on every content change. When `isStreaming` changes from `true` to `false`, the effect fires again with `behavior: 'smooth'`, giving the final smooth scroll. We don't need to add `isStreaming` to the deps array because the `deps` array already captures the last content change that just completed.

Wait — actually, we DO need `isStreaming` in the deps for the transition to work. Consider: streaming completes, the last chunk is appended, `content` changes, `deps` fires, `isStreaming` is now `false`, so `behavior: 'smooth'` is used. But what if the streaming completes but there's no content change (empty result)? Then `deps` doesn't fire and the scroll doesn't happen at all. Actually if there's no content change, there's nothing to scroll to. So it's fine.

Actually, let me reconsider. The current code uses `// eslint-disable-next-line react-hooks/exhaustive-deps` with just `deps`. If we add `isStreaming` to the deps array as well, the lint suppression comment can stay:

Actually, the simplest and most correct approach: keep the deps array as-is (it already captures content changes), and use `isStreaming` to determine behavior. When `isStreaming` flips from `true` to `false`, the last content change that just came in (which caused the transition) will trigger the effect with the new `isStreaming` value. This is correct because React re-renders with the new `content` AND new `isStreaming` simultaneously before firing effects.

So no deps change needed. The lint suppression stays.

4. **Update caller in `frontend/src/components/features/ResultPanel.tsx` (line 46):**
```typescript
// Before:
const { containerRef, isAtBottom, scrollToBottom, scrollToTop } = useAutoScroll({ deps: [content] });

// After:
const { containerRef, isAtBottom, scrollToBottom, scrollToTop } = useAutoScroll({ deps: [content], isStreaming });
```

**Edge cases:**
- `isStreaming` default is `false` (backward compatible for other callers, if any)
- Streaming starts → all scrolls are instant (`behavior: 'auto'`)
- Streaming ends → final scroll is smooth (`behavior: 'smooth'`)
- User scrolls up during streaming → `isAtBottomRef.current` is `false`, no auto-scroll happens (behavior doesn't matter)

---

### J: Dead response model types

**File:** `backend/src/Models/Responses/AuditResponse.cs`

**What:** Delete this entire file. The types `StructuredFinding`, `StructuredDimensions`, `StructuredSummary`, `StructuredData` are never referenced anywhere in the backend. The structured JSON is forwarded as a raw string via the `[SPECAUDIT_STRUCTURED]` sentinel. Frontend has its own TypeScript interfaces for the same shape.

**Action:** Delete `backend/src/Models/Responses/AuditResponse.cs`.

**Verify no references:** These types are only defined here and never imported in any other file (confirmed by grep: zero references outside this file).

**Edge cases:**
- No compilation errors — no code references these types
- Tests unaffected — no test references these types
- Build will pass after deletion

---

## Group 4 — Security architecture (I)

### I: No rate limiting on audit endpoint

**Files:** `backend/Program.cs`, `backend/backend.csproj`

**What:** The `/api/audit` endpoint has no rate limiting. Add ASP.NET Core's built-in rate limiter middleware (available since .NET 8, no extra NuGet packages).

**Changes in `backend/Program.cs`:**

1. **Add rate limiter service registration** after `builder.Services.AddSingleton<SpecAuditService>()` (after line 9):
```csharp
using System.Threading.RateLimiting;
// ... existing code ...

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
```

2. **Add `app.UseRateLimiter()`** before `app.MapAuditEndpoints()` (after line 23, before line 26):
```csharp
app.UseRateLimiter();
app.MapAuditEndpoints();
```

3. **Add `.RequireRateLimiting("AuditPolicy")`** to the `/api/audit` route — this must be done inside `AuditEndpoints.cs` on the `MapPost` call:
In `backend/src/Endpoints/AuditEndpoints.cs`, line 14, change:
```csharp
app.MapPost("/api/audit", async (
```
to:
```csharp
app.MapPost("/api/audit", async (
```
...and add `.RequireRateLimiting("AuditPolicy")` at the closing of the lambda, after `});` and before the semicolon:

Actually, with Minimal APIs, `RequireRateLimiting` is called on the route handler builder. The pattern is:
```csharp
app.MapPost("/api/audit", async (...) => { ... })
    .RequireRateLimiting("AuditPolicy");
```

So line 56 needs to change from:
```csharp
return Results.Empty;
});
```
to:
```csharp
return Results.Empty;
}).RequireRateLimiting("AuditPolicy");
```

Wait, looking at the code structure more carefully:
```csharp
app.MapPost("/api/audit", async (
    [FromBody] AuditRequest request,
    SpecAuditService auditService,
    HttpContext httpContext,
    CancellationToken ct) =>
{
    // ... body ...
    return Results.Empty;
});
```

The `.RequireRateLimiting("AuditPolicy")` should be chained onto the `MapPost` call:
```csharp
app.MapPost("/api/audit", async (...) => { ... })
    .RequireRateLimiting("AuditPolicy");
```

So the closing `});` on line 57 should become `}).RequireRateLimiting("AuditPolicy");`.

But we need to keep the code clean. Let me look at the actual formatting:

Line 56: `return Results.Empty;`
Line 57: `});`

We need to change line 57 to:
```
}).RequireRateLimiting("AuditPolicy");
```

4. **No change needed in `backend/backend.csproj`** — Rate limiting is built-in to ASP.NET Core since .NET 8. No NuGet package reference needed.

5. **Add the using directive** for `System.Threading.RateLimiting` at the top of `Program.cs` (line 1 area). Currently line 1 has:
```csharp
using Microsoft.Extensions.Options;
```
Add before it:
```csharp
using System.Threading.RateLimiting;
```

Actually, since .NET 10 has implicit usings, `System.Threading.RateLimiting` might not be included by default. Let me be safe and add it explicitly.

Wait, .NET 10 SDK implicit usings include `System.Net.Http` but not `System.Threading.RateLimiting`. The `FixedWindowRateLimiterOptions` and `RateLimitPartition` are in `System.Threading.RateLimiting`. So we need an explicit using directive or a fully qualified name.

Let me use the explicit using directive approach since it's cleaner.

**Policy scope:** The `RequireRateLimiting("AuditPolicy")` is applied only to `/api/audit`. `/health` and `/api/config` are NOT rate-limited. The middleware `UseRateLimiter()` must be called before endpoints are mapped, but the policy only applies to routes that call `.RequireRateLimiting()`.

**Edge cases:**
- Rate limit exceeded → 429 with default body (or whatever the rejection handler produces)
- IP changes (proxied behind Railway) → `context.Connection.RemoteIpAddress` is the proxy IP. If Railway forwards the original IP via `X-Forwarded-For`, we could use that instead. For now, `RemoteIpAddress` is sufficient — even if it's the proxy IP, 10 req/min/proxy-IP is reasonable.
- Multiple requests in the same second → burst of 10 allowed within the window, then blocked until window resets
- QueueLimit=0 means no queuing — excess requests are immediately rejected

---

## Test Requirements

### Group 1 tests

**A — Add to `backend.Tests/EndpointValidationTests.cs`:**
- Test: `PostAudit_NonRateLimitException_ReturnsGenericMessage`
  - Mock the service to throw a non-429 exception
  - Verify SSE output contains generic message, not the real exception text

**G — Existing tests in `frontend/src/hooks/__tests__/useAudit.test.tsx`:**
- The "retries and succeeds after RateLimitError" test should still pass — the mock resolves the recursive call correctly with `await`
- Verify no test regressions (the `await` keyword is transparent to tests since the promise chain is unchanged)

**H — Add to `frontend/src/api/__tests__/auditClient.test.ts`:**
- Test: "does not call onStructured when structured JSON has wrong shape"
  - Send structured sentinel with valid JSON but wrong shape (e.g. `{"results":[]}` or `{"findings": "not-an-array"}`)
  - Verify `onStructured` is NOT called
  - Verify the chunk is not passed to `onChunk`
- Test: "calls onStructured when structured JSON is valid"
  - Existing test already covers this; should still pass with the type guard
- Test: "does not call onStructured when findings array elements are missing required fields"
  - Send `{"findings":[{"severity":"CRITICAL"}]}` (missing title, category, etc.)
  - Verify `onStructured` is NOT called

### Group 2 tests

**B — Add to `frontend/src/components/features/__tests__/InputPanel.test.tsx`:**
- Test: "disables Run button when status is loading"
  ```tsx
  render(<InputPanel status="loading" onSubmit={noop} onAbort={noop} />);
  const textarea = screen.getByPlaceholderText(/paste your openapi spec/i);
  fireEvent.change(textarea, { target: { value: 'spec: test' } });
  expect(screen.getByRole('button', { name: /run audit/i })).toBeDisabled();
  ```

**F — Add to `backend.Tests/AiOptionsValidationTests.cs`:**
- Test: `Startup_MissingApiKey_ThrowsInvalidOperationException`
  ```csharp
  [Fact]
  public void Startup_MissingApiKey_ThrowsInvalidOperationException()
  {
      var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
          builder.ConfigureAppConfiguration((_, cfg) =>
              cfg.AddInMemoryCollection(new Dictionary<string, string?>
              {
                  ["Ai:BaseUrl"]  = "https://test.example.com/v1",
                  ["Ai:ModelId"]  = "test-model",
                  ["Ai:ApiKey"]   = ""
              })
          )
      );
      var act = () => factory.CreateClient();
      act.Should().Throw<Exception>()
          .WithMessage("*ApiKey*");
  }
  ```

### Group 3 tests

**C — Add to `frontend/src/utils/__tests__/exportPdf.test.ts`:**
- Add to `describe('markdownToContent')`:
  - Test: "detects code fence with CRLF line endings"
    ```typescript
    const result = markdownToContent('```\r\ncode\r\n```\r\n');
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('text', 'code');
    ```
  - Test: "detects code fence with trailing spaces"
    ```typescript
    const result = markdownToContent('```   \ncode\n```');
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('text', 'code');
    ```

**D — Update `backend.Tests/ExtractStructuredJsonTests.cs`:**
- All 7 existing tests should continue to pass with the `LastIndexOf` implementation
- The "text after JSON block" test needs to be updated: the new implementation ALLOWS text after the JSON block (returns the JSON). Update the test expectation to reflect this:

  Test `ExtractStructuredJson_WithTextAfterJsonBlock_ReturnsNull` should be renamed to `ExtractStructuredJson_WithTextAfterJsonBlock_ReturnsJsonString` and assert that it returns the JSON (not null).
  
  ```csharp
  [Fact]
  public void ExtractStructuredJson_WithTextAfterJsonBlock_ReturnsJsonString()
  {
      var markdown = "# SpecAudit Report\n\n```json\n{\"findings\":[]}\n```\n\nSome trailing text after the code block.\n";
      var result = SpecAuditService.ExtractStructuredJson(markdown);
      result.Should().NotBeNull();
      result.Should().Contain("findings");
  }
  ```

**E — Update `frontend/src/hooks/__tests__/useAutoScroll.test.tsx`:**
- The existing tests must be updated to pass the `isStreaming` option:
  ```typescript
  const { containerRef, scrollToBottom, scrollToTop } = useAutoScroll({ deps: [content], isStreaming: false });
  ```
- Add new tests:
  - Test: "uses auto behavior when isStreaming is true"
    - Render with `isStreaming: true`, content changes, verify `scrollTo` called with `behavior: 'auto'`
  - Test: "uses smooth behavior when isStreaming is false"
    - The existing test already verifies `behavior: 'smooth'` — ensure it still passes

**J — No test changes needed.**
- Verify no tests fail when `AuditResponse.cs` is deleted (they won't — nothing references it).

### Group 4 tests

**I — Add to `backend.Tests/EndpointValidationTests.cs`:**
- Test: `PostAudit_ExceedsRateLimit_Returns429`
  - Send 11 requests to `/api/audit` rapidly
  - The 11th request should return 429
  - Requires careful timing or a custom `WebApplicationFactory` that reduces the rate limit window for testing
  - Alternative: add a test-only rate limit policy name and configure it in the factory

---

## Commit Strategy

Commit each group separately in the following order:

| Commit | Group | Message | Files |
|--------|-------|---------|-------|
| 1 | Group 3 first (D, J) | `refactor: replace regex with LastIndexOf for JSON extraction; delete dead response models` | SpecAuditService.cs, AuditResponse.cs, ExtractStructuredJsonTests.cs |
| 2 | Group 3 (C, E) | `fix: handle CRLF in PDF code fences; use auto-scroll behavior during streaming` | exportPdf.ts, useAutoScroll.ts, ResultPanel.tsx, useAutoScroll.test.tsx, exportPdf.test.ts |
| 3 | Group 2 | `fix: disable button during loading; validate ApiKey on startup` | InputPanel.tsx, Program.cs, InputPanel.test.tsx, AiOptionsValidationTests.cs |
| 4 | Group 1 | `fix: sanitize error messages; await retry; validate structured JSON shape` | AuditEndpoints.cs, useAudit.ts, auditClient.ts, auditClient.test.ts, EndpointValidationTests.cs |
| 5 | Group 4 | `feat: add rate limiting to audit endpoint (10 req/min per IP)` | Program.cs, AuditEndpoints.cs, EndpointValidationTests.cs |

**Rationale for order:**
- Group 3 (D, J) first because D changes the class from `partial` to non-`partial` — a structural change that should land alone
- Group 3 (C, E) is purely frontend — independent
- Group 2 touches Program.cs — apply before Group 4 to avoid merge conflicts on the same file
- Group 1 is the most critical — apply after the code quality cleanups
- Group 4 last — adds new infrastructure concern; should build on clean code

---

## Files Summary

| Action | Path | Group |
|--------|------|-------|
| MODIFY | `backend/src/Endpoints/AuditEndpoints.cs` | 1 (A), 4 (I) |
| MODIFY | `frontend/src/hooks/useAudit.ts` | 1 (G) |
| MODIFY | `frontend/src/api/auditClient.ts` | 1 (H) |
| MODIFY | `frontend/src/components/features/InputPanel.tsx` | 2 (B) |
| MODIFY | `backend/Program.cs` | 2 (F), 4 (I) |
| MODIFY | `frontend/src/utils/exportPdf.ts` | 3 (C) |
| MODIFY | `backend/src/Services/SpecAuditService.cs` | 3 (D) |
| MODIFY | `frontend/src/hooks/useAutoScroll.ts` | 3 (E) |
| MODIFY | `frontend/src/components/features/ResultPanel.tsx` | 3 (E) |
| DELETE | `backend/src/Models/Responses/AuditResponse.cs` | 3 (J) |
| MODIFY | `frontend/src/api/__tests__/auditClient.test.ts` | 1 (H) |
| MODIFY | `backend.Tests/ExtractStructuredJsonTests.cs` | 3 (D) |
| MODIFY | `frontend/src/hooks/__tests__/useAutoScroll.test.tsx` | 3 (E) |
| MODIFY | `frontend/src/components/features/__tests__/InputPanel.test.tsx` | 2 (B) |
| MODIFY | `frontend/src/utils/__tests__/exportPdf.test.ts` | 3 (C) |
| MODIFY | `backend.Tests/AiOptionsValidationTests.cs` | 2 (F) |
| MODIFY | `backend.Tests/EndpointValidationTests.cs` | 1 (A), 4 (I) |
| No change | `backend/backend.csproj` | 4 (I) — rate limiting is built-in |

**Total: 18 files touched (1 DELETE, 17 MODIFY).**
