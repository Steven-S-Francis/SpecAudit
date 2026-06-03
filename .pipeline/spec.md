# Fix: SSE streaming requests never time out

## OPEN QUESTIONS

None. The fix is well-scoped and unambiguous.

---

## Architecture Overview

### Problem

The SSE streaming endpoint (`POST /api/audit`) has a 45-second CancellationToken timeout, but it never takes effect because:

1. The `token` is passed to `AuditAsync()` → `CompleteChatStreamingAsync()`, but the OpenAI SDK only checks cancellation during HTTP operations. If Groq keeps sending data chunks, the SDK never examines the token.
2. The `await foreach` loop never checks the token between chunks, so it runs indefinitely even after the 45s timer fires.
3. When the timeout fires silently, no error is sent to the client — the connection stays open until the user presses Escape or refreshes.

### Fix Summary

**Primary fix in `AuditEndpoints.cs`**:
- Add `token.ThrowIfCancellationRequested()` as the first line inside the `await foreach` loop body.
- This forces an `OperationCanceledException` to be thrown on every chunk iteration when the 45s timer has fired.

**Secondary fix in `AuditEndpoints.cs`**:
- Add a new `catch (OperationCanceledException)` block (without `when` filter) **between** the existing client-disconnect catch and the generic exception catch.
- This catches the server-side timeout (where `token` is cancelled but `ct` — the HTTP request token — is not), and sends a `[SPECAUDIT_ERROR]` timeout message to the client using `CancellationToken.None`.

**Existing uncommitted changes (keep as-is, already in working tree)**:
1. `AuditEndpoints.cs`: 45s CancellationTokenSource + `catch (OperationCanceledException) when (ct.IsCancellationRequested)` for client disconnect.
2. `SpecAuditService.cs`: `NetworkTimeout = TimeSpan.FromSeconds(30)` on the OpenAI client options.

### Data Flow After Fix

```
User sends POST /api/audit
  → CancellationToken ct (from ASP.NET, tracks HTTP connection)
  → CreateLinkedTokenSource(ct) + CancelAfter(45s) → token
  → try {
      await foreach (chunk in AuditAsync(request, token)) {
          token.ThrowIfCancellationRequested();   // ← NEW: check every iteration
          WriteAsync(chunk, token);
          FlushAsync(token);
      }
    }
    catch (OperationCanceledException) when (ct.IsCancellationRequested) {
        // Token fired because HTTP client disconnected — silent no-op
    }
    catch (OperationCanceledException) {           // ← NEW: catch server timeout
        // Token fired because 45s timer elapsed, ct still active
        // Write timeout error using CancellationToken.None
        WriteAsync("[SPECAUDIT_ERROR] The request timed out...", CancellationToken.None);
        FlushAsync(CancellationToken.None);
    }
    catch (Exception ex) {
        // All other errors (rate limiting, unexpected failures)
        WriteAsync("[SPECAUDIT_ERROR] ...", ct);
    }
```

---

## Files to Create or Modify

| Action | Path | Description |
|--------|------|-------------|
| MODIFY | `backend/src/Endpoints/AuditEndpoints.cs` | Add `token.ThrowIfCancellationRequested()` in loop + second `catch (OperationCanceledException)` block |
| KEEP (no changes needed) | `backend/src/Services/SpecAuditService.cs` | Already has `NetworkTimeout = TimeSpan.FromSeconds(30)` in working tree |

---

## 1. Modify `backend/src/Endpoints/AuditEndpoints.cs`

### 1.1 Add `token.ThrowIfCancellationRequested()` inside the loop

**Current code (lines 41–46):**
```csharp
await foreach (var chunk in auditService.AuditAsync(sanitizedRequest, token))
{
    var encoded = JsonSerializer.Serialize(chunk);
    await httpContext.Response.WriteAsync($"data: {encoded}\n\n", token);
    await httpContext.Response.Body.FlushAsync(token);
}
```

**New code:**
```csharp
await foreach (var chunk in auditService.AuditAsync(sanitizedRequest, token))
{
    token.ThrowIfCancellationRequested();  // ← ADD THIS LINE

    var encoded = JsonSerializer.Serialize(chunk);
    await httpContext.Response.WriteAsync($"data: {encoded}\n\n", token);
    await httpContext.Response.Body.FlushAsync(token);
}
```

**Rationale**: Every time a chunk arrives, explicitly check whether the 45s linked token has been cancelled. If the timer fired, `OperationCanceledException` is thrown immediately, regardless of what the OpenAI SDK is doing internally.

### 1.2 Add second `catch (OperationCanceledException)` block

**Current catch block ordering (lines 48–65):**
```csharp
catch (OperationCanceledException) when (ct.IsCancellationRequested)
{
    // Client aborted the connection
}
catch (Exception ex)
{
    // Capture the caught exception in Sentry so it's not lost
    SentrySdk.CaptureException(ex);

    var message = ex.Message.Contains("429")
        ? "Rate limit reached. Please wait a moment and try again, or switch to a provider with higher limits."
        : ex is OperationCanceledException
            ? "The request timed out. Please try again."
            : "An error occurred. Please try again.";
    var sentinel = JsonSerializer.Serialize($"[SPECAUDIT_ERROR] {message}");
    await httpContext.Response.WriteAsync($"data: {sentinel}\n\n", ct);
    await httpContext.Response.Body.FlushAsync(ct);
}
```

**New catch block ordering — insert between the two existing blocks:**

```csharp
catch (OperationCanceledException) when (ct.IsCancellationRequested)
{
    // Case 1: Linked token fired because HTTP client disconnected.
    // ct.IsCancellationRequested is true, token.IsCancellationRequested is also true.
    // Silent no-op — the client is gone, nothing to write to.
}

catch (OperationCanceledException)
{
    // Case 2: Linked token fired because the 45-second timeout elapsed,
    // but the HTTP client is still connected.
    // ct.IsCancellationRequested is false, token.IsCancellationRequested is true.
    // Send a timeout error to the client.
    var sentinel = JsonSerializer.Serialize("[SPECAUDIT_ERROR] The request timed out. Please try again.");
    await httpContext.Response.WriteAsync($"data: {sentinel}\n\n", CancellationToken.None);
    await httpContext.Response.Body.FlushAsync(CancellationToken.None);
}

catch (Exception ex)
{
    // Case 3: All other errors (rate limiting, unexpected failures, etc.)
    SentrySdk.CaptureException(ex);

    var message = ex.Message.Contains("429")
        ? "Rate limit reached. Please wait a moment and try again, or switch to a provider with higher limits."
        : ex is OperationCanceledException
            ? "The request timed out. Please try again."
            : "An error occurred. Please try again.";
    var sentinel = JsonSerializer.Serialize($"[SPECAUDIT_ERROR] {message}");
    await httpContext.Response.WriteAsync($"data: {sentinel}\n\n", ct);
    await httpContext.Response.Body.FlushAsync(ct);
}
```

### 1.3 Full modified method (for reference)

```csharp
app.MapPost("/api/audit", async (
    [FromBody] AuditRequest request,
    SpecAuditService auditService,
    HttpContext httpContext,
    CancellationToken ct) =>
{
    var spec = request.Spec.Trim();

    if (string.IsNullOrWhiteSpace(spec))
        return Results.BadRequest(new { error = "Spec payload cannot be empty." });

    if (spec.Length > auditService.MaxInputLength)
        return Results.StatusCode(413);

    httpContext.Response.ContentType = "text/event-stream";
    httpContext.Response.Headers.CacheControl = "no-cache";
    httpContext.Response.Headers.Connection = "keep-alive";

    var sanitizedRequest = new AuditRequest(spec, request.SpecFormat);

    using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
    cts.CancelAfter(TimeSpan.FromSeconds(45));
    var token = cts.Token;

    try
    {
        await foreach (var chunk in auditService.AuditAsync(sanitizedRequest, token))
        {
            token.ThrowIfCancellationRequested();  // Check timeout between chunks

            var encoded = JsonSerializer.Serialize(chunk);
            await httpContext.Response.WriteAsync($"data: {encoded}\n\n", token);
            await httpContext.Response.Body.FlushAsync(token);
        }
    }
    catch (OperationCanceledException) when (ct.IsCancellationRequested)
    {
        // Client aborted the connection — silent no-op
    }
    catch (OperationCanceledException)
    {
        // Server-side 45-second timeout — send error to client
        var sentinel = JsonSerializer.Serialize("[SPECAUDIT_ERROR] The request timed out. Please try again.");
        await httpContext.Response.WriteAsync($"data: {sentinel}\n\n", CancellationToken.None);
        await httpContext.Response.Body.FlushAsync(CancellationToken.None);
    }
    catch (Exception ex)
    {
        // Capture the caught exception in Sentry so it's not lost
        SentrySdk.CaptureException(ex);

        var message = ex.Message.Contains("429")
            ? "Rate limit reached. Please wait a moment and try again, or switch to a provider with higher limits."
            : ex is OperationCanceledException
                ? "The request timed out. Please try again."
                : "An error occurred. Please try again.";
        var sentinel = JsonSerializer.Serialize($"[SPECAUDIT_ERROR] {message}");
        await httpContext.Response.WriteAsync($"data: {sentinel}\n\n", ct);
        await httpContext.Response.Body.FlushAsync(ct);
    }

    return Results.Empty;
}).RequireRateLimiting("AuditPolicy");
```

---

## 2. No changes to `backend/src/Services/SpecAuditService.cs`

This file already contains (in the working tree):

```csharp
var clientOptions = new OpenAIClientOptions
{
    Endpoint = new Uri(_options.BaseUrl),
    NetworkTimeout = TimeSpan.FromSeconds(30)  // Already present
};
```

No further modifications needed.

---

## 3. Edge Cases

| Edge Case | Catch Block | Behavior |
|-----------|-------------|----------|
| **Client disconnects** (user closes browser, presses Escape) | 1st catch: `when (ct.IsCancellationRequested)` | Silent no-op. `ct.IsCancellationRequested` is true because HTTP connection dropped. |
| **45s timeout** (Groq slow, token fires) | 2nd catch: `OperationCanceledException` (no filter) | Writes `[SPECAUDIT_ERROR] The request timed out.` to the SSE stream using `CancellationToken.None`. |
| **Rate limit (HTTP 429)** | 3rd catch: `Exception ex` where `ex.Message.Contains("429")` | Writes `[SPECAUDIT_ERROR] Rate limit reached...` to the SSE stream using `ct`. |
| **Unexpected error** | 3rd catch: `Exception ex` (fallthrough) | Writes `[SPECAUDIT_ERROR] An error occurred...` to SSE stream, captures exception in Sentry. |
| **OpenAI SDK cancellation** (SDK notices the token during HTTP) | 2nd catch: `OperationCanceledException` (no filter) | Same as 45s timeout — `OperationCanceledException` is caught and a timeout error is sent. The `ex is OperationCanceledException` check in the 3rd catch becomes unreachable for this path, which is correct. |
| **Both ct and token cancel simultaneously** (client disconnects right at the 45s mark) | 1st catch: `when (ct.IsCancellationRequested)` | The `when` filter is evaluated — `ct.IsCancellationRequested` is true, so this catches it as a client-disconnect. Correct because the client is gone. |
| **token.ThrowIfCancellationRequested() called but client already disconnected** | 1st catch: `when (ct.IsCancellationRequested)` | If the client disconnected first, `ct` was already cancelled, which cascades to `token`. The first catch handles it correctly. |
| **Loop completes before timeout** | No catch | Normal completion, no error sent, audit results delivered successfully. |

### Catch Block Ordering Invariants

1. The `when (ct.IsCancellationRequested)` catch MUST come FIRST. If we put the unqualified `OperationCanceledException` first, it would swallow both client-disconnect and timeout cases, preventing the silent no-op for disconnected clients.

2. The unqualified `OperationCanceledException` MUST come SECOND. It catches all remaining `OperationCanceledException` cases where `ct.IsCancellationRequested` is false — i.e., the 45s timeout case.

3. The generic `Exception` catch MUST come LAST. It handles rate limits and unexpected errors.

4. Inside the generic `Exception` catch, the `ex is OperationCanceledException` branch is now dead code for the timeout path (the 2nd catch handles it), but it's kept as a safety net for any `OperationCanceledException` that might have a different source (e.g., from the `WriteAsync`/`FlushAsync` calls themselves). Removing it would be an optimization, not a bug fix — leave it in place.

---

## 4. Testing Strategy

### 4.1 Automated Tests

**Test: `backend.Tests/EndpointValidationTests.cs`** — or wherever the existing endpoint tests live.

Add test(s) to cover the new timeout behavior:

| Test | Method | Expected |
|------|--------|----------|
| **Timeout sends error to client** | Mock `SpecAuditService.AuditAsync` to yield a chunk, then wait longer than 45s before yielding the next chunk (or yield many chunks with delays). The test should verify the response contains `[SPECAUDIT_ERROR] The request timed out.` | After 45+ seconds, the endpoint closes with a timeout error message. |
| **Client disconnect is silent** | Cancel `ct` (the HTTP CancellationToken) while streaming, verify the endpoint closes without sending any additional data. | Existing behavior, but confirm it still works after the refactor. |
| **Normal completion sends no error** | Mock `AuditAsync` to yield chunks without delay, verify no `[SPECAUDIT_ERROR]` prefix appears in the stream. | Existing behavior, regression check. |

**Note**: A 45-second wall-clock test is too slow for CI. Use one of:
- Make the timeout configurable (e.g., via `IAiOptions` or a test-only constructor parameter), then inject a short timeout (e.g., 100ms) for tests.
- Or, test only the logic: unit-test the catch block dispatch by ensuring the correct method is called based on which token was cancelled.

**Recommendation**: Make the timeout configurable. Add a setting to `AiOptions`:

```csharp
// In AiOptions.cs
public int StreamingTimeoutSeconds { get; set; } = 45;
```

Then change `AuditEndpoints.cs` line 36 from:
```csharp
cts.CancelAfter(TimeSpan.FromSeconds(45));
```
to:
```csharp
cts.CancelAfter(TimeSpan.FromSeconds(auditService.StreamingTimeoutSeconds));
```

And expose it via `SpecAuditService`:
```csharp
public int StreamingTimeoutSeconds => _options.StreamingTimeoutSeconds;
```

Then in tests, inject `AiOptions` with `StreamingTimeoutSeconds = 1` to test timeout within CI.

### 4.2 Manual Test (for verification in staging/production)

1. **Happy path**: Audit a small valid spec → verify audit completes in < 45s with no error.
2. **Timeout path**: Audit a very large spec or use a provider that's slow → wait 45s → verify the client receives `[SPECAUDIT_ERROR] The request timed out. Please try again.` via SSE.
3. **Escape during timeout**: Press Escape during streaming → verify the stream closes immediately with no error message (client-disconnect path).
4. **Rate limit**: If supported, trigger a 429 from the provider → verify the rate-limit error message is shown.

---

## 4. Add Serilog logging to backend

### 4.1 Add package

Add to `backend/backend.csproj`:
```xml
<PackageReference Include="Serilog.AspNetCore" Version="9.*" />
```

`Serilog.AspNetCore` 9.x includes Serilog core, the console sink, and ASP.NET Core middleware integration. It's compatible with .NET 10.

### 4.2 Configure Serilog in Program.cs

Add at the top of `Program.cs`, BEFORE `var builder = WebApplication.CreateBuilder(args);`:

```csharp
using Serilog;

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .WriteTo.Console()
    .CreateLogger();

builder.Host.UseSerilog();
```

Add after `app.Run("http://+:5000");`:

```csharp
finally
{
    Log.CloseAndFlush();
}
```

### 4.3 Add logging to SpecAuditService.cs

Inject `ILogger<SpecAuditService>` into the constructor and log:

- **Constructor**: `"SpecAuditService initialized for model {ModelId} at {BaseUrl}"`
- **AuditAsync start**: `"Starting AI audit stream for spec ({Length} chars)"`
- **AuditAsync completion**: `"AI audit stream completed ({TokenCount} chars received)"`
- **AuditAsync error**: Log exceptions at `Error` level
- **Structured JSON extraction success**: `"Structured JSON extracted ({FindingsCount} findings)"`
- **Structured JSON not found**: `"No structured JSON found in response"`

### 4.4 Add logging to AuditEndpoints.cs

Inject `ILogger<...>` (either via static logger or via the HttpContext.RequestServices) and log:

- **Request start**: `"Audit request: {SpecLength} chars, format: {Format}"`
- **Client disconnect**: `"Client disconnected (Escape/abort)"`
- **Timeout**: `"Request timed out after 45s"`
- **Error**: `"Audit error: {Message}"` (at Error level)
- **Request completion**: `"Audit request completed"`

### 4.5 Verify

- `dotnet build` — no errors
- `dotnet test` — all 21 tests pass
- Check that Serilog output appears on stdout/console when running locally

---

## 5. Implementation Order

1. Add `token.ThrowIfCancellationRequested()` as the first line inside the `await foreach` loop in `backend/src/Endpoints/AuditEndpoints.cs`.
2. Insert the second `catch (OperationCanceledException)` block (without `when` filter) between the existing client-disconnect catch and the generic exception catch.
3. In the new catch block, write `[SPECAUDIT_ERROR] The request timed out. Please try again.` using `CancellationToken.None`.
4. (Optional) Make the timeout configurable via `AiOptions.StreamingTimeoutSeconds` for testability — update `AiOptions.cs`, `SpecAuditService.cs`, and `AuditEndpoints.cs`.
5. Run `dotnet build` — ensure clean compilation.
6. Run `dotnet test` — ensure all existing backend tests pass.
7. Commit changes, keeping the existing uncommitted changes (45s CancellationTokenSource + NetworkTimeout) as part of the final commit.
