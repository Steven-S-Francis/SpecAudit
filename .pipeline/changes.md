# Changes: SSE Streaming Timeout Fix + Serilog Logging

## Files Modified

### 1. `backend/src/Endpoints/AuditEndpoints.cs` — Timeout fix + Serilog logging

**Timeout fix (existing uncommitted changes + per-spec):**
- Added `using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);` and `cts.CancelAfter(TimeSpan.FromSeconds(45));` to create a linked token that fires after 45 seconds
- Added `var token = cts.Token;` to use as the cancellation token for the streaming call
- Added `catch (OperationCanceledException) when (ct.IsCancellationRequested)` block for silent handling of client disconnect
- Added `token.ThrowIfCancellationRequested();` as the **first line** inside the `await foreach` loop body (before `JsonSerializer.Serialize`). This forces an `OperationCanceledException` to be thrown on every chunk iteration after the 45s timer fires.
- Added a **second `catch (OperationCanceledException)` block** (without `when` filter) between the client-disconnect catch and the generic `Exception` catch. This catches server-side timeout (where `token` is cancelled but `ct` — the HTTP request token — is not) and sends a `[SPECAUDIT_ERROR] The request timed out. Please try again.` message to the client using `CancellationToken.None`.

**Serilog logging (new):**
- Added `using Microsoft.Extensions.Logging;`
- Resolved `ILogger` from `HttpContext.RequestServices` via `ILoggerFactory` (since the endpoint class is static, `ILogger<AuditEndpoints>` is not valid — using `ILoggerFactory.CreateLogger("SpecAudit.Endpoints.AuditEndpoints")` instead)
- **Request start**: `LogInformation("Audit request: {SpecLength} chars, format: {Format}", ...)`
- **Client disconnect**: `LogInformation("Client disconnected (Escape/abort)")` — in the `when (ct.IsCancellationRequested)` catch
- **Timeout**: `LogInformation("Request timed out after 45s")` — in the unqualified `OperationCanceledException` catch
- **Error**: `LogError(ex, "Audit error: {Message}", ex.Message)` — in the `Exception ex` catch
- **Request completion**: `LogInformation("Audit request completed")` — after try-catch, before `return Results.Empty`

### 2. `backend/src/Services/SpecAuditService.cs` — No timeout changes + Serilog logging

**Kept (existing uncommitted changes):**
- Already had `NetworkTimeout = TimeSpan.FromSeconds(30)` in the working tree. No timeout modifications made.

**Serilog logging (new):**
- Added `using Microsoft.Extensions.Logging;`
- Added `ILogger<SpecAuditService> _logger` field
- Modified constructor to inject `ILogger<SpecAuditService> logger` parameter
- **Constructor**: `LogInformation("SpecAuditService initialized for model {ModelId} at {BaseUrl}", ...)`
- **Streaming start**: `LogInformation("Starting AI audit stream for spec ({Length} chars)", ...)`
- **Streaming completion**: `LogInformation("AI audit stream completed ({TokenCount} chars received)", ...)`
- **Structured JSON extracted**: `LogInformation("Structured JSON extracted ({FindingsCount} findings)", ...)` — parses the `summary.totalFindings` from the JSON block
- **No structured JSON**: `LogInformation("No structured JSON found in response")`
- Note: Did NOT add a try-catch around the `yield return` loop because C# does not allow `yield return` inside a `try-catch` block (CS1626). Errors from `CompleteChatStreamingAsync` propagate to the caller (`AuditEndpoints.cs`), which already logs them at `Error` level.

### 3. `backend/backend.csproj` — New package reference

- Added `<PackageReference Include="Serilog.AspNetCore" Version="9.*" />`

### 4. `backend/Program.cs` — Serilog configuration

- Added `using Serilog;` at the top
- Added `Log.Logger = new LoggerConfiguration().MinimumLevel.Information().WriteTo.Console().CreateLogger();` **before** `var builder = WebApplication.CreateBuilder(args);`
- Added `builder.Host.UseSerilog();` immediately after builder creation
- Wrapped `app.Run("http://+:5000");` in a `try { ... } finally { Log.CloseAndFlush(); }` block

## Catch Block Ordering (3 blocks, in order)

| Position | Catch Clause | Trigger | Behavior |
|----------|-------------|---------|----------|
| 1st | `OperationCanceledException` **when** `ct.IsCancellationRequested` | Client disconnects (Escape, browser close) | Silent no-op — client is gone; logs `"Client disconnected (Escape/abort)"` |
| 2nd | `OperationCanceledException` (no filter) | 45s server-side timeout fires, HTTP client still connected | Sends timeout error via `CancellationToken.None`; logs `"Request timed out after 45s"` |
| 3rd | `Exception ex` | Rate limits (429), unexpected errors | Captures exception in Sentry, sends error message via `ct`; logs `"Audit error: {Message}"` at Error level |

## Verification

- `dotnet build` — **Build succeeded. 0 warnings, 0 errors.**
- `dotnet test` — **Passed! 21/21 tests passed.**
- No TypeScript files were affected (no frontend changes).
- Serilog output will appear on stdout/console when running locally.

## Tester Focus Areas

1. **Timeout behavior**: Mock `AuditAsync` to yield chunks slowly. After 45s, verify `[SPECAUDIT_ERROR] The request timed out.` is sent to the SSE stream. Verify `"Request timed out after 45s"` appears in console logs.
2. **Client disconnect**: Cancel `ct` mid-stream, verify no additional data is written (silent close). Verify `"Client disconnected (Escape/abort)"` appears in console logs.
3. **Normal completion**: Verify audit completes in < 45s with no error. Verify `"Audit request completed"` appears in console logs.
4. **Rate limiting**: If a 429 is thrown, verify the rate-limit error message is shown. Verify `"Audit error:"` appears in console logs at Error level.
5. **Serilog startup**: Verify `"SpecAuditService initialized for model ..."` appears in console logs at startup.
