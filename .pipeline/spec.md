# Add `GET /api/diagnose` diagnostic endpoint

## OPEN QUESTIONS

None.

---

## Why this change is needed

The AI streaming bug (zero chunks until 45s timeout inside Docker) was not resolved by passing `CancellationToken.None` to `CompleteChatStreamingAsync` (commit `5230ea8`). Requests now hang indefinitely instead of timing out. The root cause could be:

1. The OpenAI SDK v2.10.0 has an undiscovered networking issue inside Docker, or
2. The Groq API is unreachable or slow from within the container, despite the sidecar PowerShell container proving basic TLS connectivity.

We need a dedicated diagnostic endpoint that tests the exact same HTTP pipeline (base URL, auth header) that the OpenAI SDK uses internally. This lets us isolate whether the problem is SDK-level vs. infrastructure-level (DNS/TLS/routing).

---

## File changes

### 1. MODIFY: `backend/src/Endpoints/AuditEndpoints.cs`

**What to add:**

- A new `using System.Net.Http.Headers;` at the top of the file (between existing usings, alphabetically).
- A new `app.MapGet("/api/diagnose", ...)` invocation inside the existing `MapAuditEndpoints` method, after line 90 (after the `/api/config` endpoint).

**New endpoint code:**

```csharp
app.MapGet("/api/diagnose", async (IOptions<AiOptions> options, ILoggerFactory loggerFactory) =>
{
    var logger = loggerFactory.CreateLogger("SpecAudit.Diagnose");
    var aiOptions = options.Value;

    using var client = new HttpClient();
    client.BaseAddress = new Uri(aiOptions.BaseUrl);
    client.DefaultRequestHeaders.Authorization =
        new AuthenticationHeaderValue("Bearer", aiOptions.ApiKey);
    client.Timeout = TimeSpan.FromSeconds(10);

    var sw = System.Diagnostics.Stopwatch.StartNew();
    try
    {
        var response = await client.GetAsync("models");
        sw.Stop();
        var statusCode = (int)response.StatusCode;
        logger.LogInformation(
            "Diagnose: Groq models endpoint returned {StatusCode} in {Elapsed}ms",
            statusCode, sw.ElapsedMilliseconds);
        return Results.Ok(new
        {
            groqStatus = statusCode,
            elapsedMs = sw.ElapsedMilliseconds,
            ok = statusCode == 200
        });
    }
    catch (Exception ex)
    {
        sw.Stop();
        logger.LogError(ex,
            "Diagnose: Groq models endpoint failed after {Elapsed}ms",
            sw.ElapsedMilliseconds);
        return Results.Ok(new
        {
            groqStatus = 0,
            elapsedMs = sw.ElapsedMilliseconds,
            ok = false,
            error = ex.Message
        });
    }
});
```

**Placement:** Insert immediately after the existing `/api/config` block (line 90), before `/api/test-error`.

### Files NOT modified

| File | Reason |
|------|--------|
| `backend/src/Services/SpecAuditService.cs` | Not part of this change |
| `backend/backend.csproj` | No new package dependencies needed |
| Any test files | Tests are in the companion PR/commit |

---

## Edge cases the implementation must handle

| Edge case | Handling |
|-----------|----------|
| **Timeout** (Groq unreachable, DNS failure, slow response) | `client.Timeout = 10s` guarantees the `GetAsync` throws a `TaskCanceledException`. The `catch` block catches it, logs the elapsed time, and returns `{"groqStatus":0,"ok":false,"error":"...", "elapsedMs":10000}`. |
| **HTTP error status** (e.g. 401 Unauthorized, 429 Rate Limited, 500 Server Error) | The catch block is NOT entered for non-success status codes — `HttpResponseMessage.IsSuccessStatusCode` is not checked, so the status code is returned as-is via `groqStatus`. The `ok` field is `false` for any status != 200. |
| **Missing API key or BaseUrl** | If `aiOptions.ApiKey` is empty, the `Authorization` header is sent as `Bearer ` (empty value). The Groq API returns 401. The endpoint correctly reports `groqStatus: 401, ok: false`. |
| **Invalid BaseUrl** | `new Uri(aiOptions.BaseUrl)` throws `UriFormatException` at construction time if the config value is not a valid URI. This would be a startup concern, not a runtime issue — the app shouldn't start with an invalid URL. If it somehow isn't caught, the `catch (Exception ex)` block captures it. |
| **DNS resolution failure** | `HttpClient` throws `HttpRequestException` with inner `SocketException`. Caught by the catch block. |
| **TLS/SSL errors** | `HttpClient` throws `HttpRequestException`. Caught by the catch block. |
| **Concurrent requests** | Each call creates a fresh `HttpClient` that is disposed after use. No shared state. Safe under concurrent load. |

---

## Existing patterns to follow

- **IOptions\<AiOptions\> injection**: Same pattern as `GET /api/config` on line 89. The callback receives `IOptions<AiOptions> options` directly via ASP.NET DI.
- **ILoggerFactory injection**: Same pattern as `POST /api/audit` on line 30 — create a named logger from `ILoggerFactory` rather than injecting `ILogger<T>`.
- **Return Results.Ok**: Consistent with `/api/config` and `/api/test-error`.
- **Serilog logging**: Uses `logger.LogInformation` / `logger.LogError` with structured properties (`{StatusCode}`, `{Elapsed}ms`), consistent with the existing pattern in line 32.
- **No new middleware, no new services, no new DI registrations**: The endpoint uses only `HttpClient` directly (no `IHttpClientFactory`), which is appropriate for a one-shot diagnostic call that doesn't benefit from connection pooling.

---

## Verification steps

```powershell
# 1. Build the backend (0 errors expected)
dotnet build backend/backend.csproj

# 2. Run all tests (all pass expected)
dotnet test backend.Tests/backend.Tests.csproj

# 3. Start the full stack with Docker
docker compose down
docker compose build --no-cache
docker compose up -d

# 4. Hit the diagnostic endpoint
curl http://localhost:5000/api/diagnose

# Expected success output:
# {"groqStatus":200,"elapsedMs":850,"ok":true}
#
# Expected failure output (if networking is broken):
# {"groqStatus":0,"elapsedMs":10000,"ok":false,"error":"...message..."}

# 5. Verify the logs show the diagnostic entry
docker compose logs backend | findstr "Diagnose"
```
