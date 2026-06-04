# Update `GET /api/diagnose` to hit Groq chat completions API

## Why this change is needed

The current diagnostic endpoint hits `GET /api/v1/models` which only tests connectivity and auth. It does **not** exercise the chat completion pipeline that the main audit feature uses. By sending a minimal chat completion request instead, we can:

1. Verify the full request/response pipeline (auth, routing, serialization, deserialization) works end-to-end.
2. Catch API contract issues (e.g., model name changes, request schema differences) early.
3. Provide a more realistic health check that proves the Groq provider is actually serving inference, not just returning a static model list.

---

## File changes

### 1. MODIFY: `backend/src/Endpoints/AuditEndpoints.cs` — lines 93–134

**Replace the entire handler body** of the existing `/api/diagnose` endpoint. The endpoint signature (`app.MapGet`, parameter list) stays the same.

**Before (current handler, lines 93–134):**

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

**After (replacement handler, lines 93–134):**

```csharp
app.MapGet("/api/diagnose", async (IOptions<AiOptions> options, ILoggerFactory loggerFactory) =>
{
    var logger = loggerFactory.CreateLogger("SpecAudit.Diagnose");
    var aiOptions = options.Value;

    using var client = new HttpClient();
    client.Timeout = TimeSpan.FromSeconds(10);

    var body = JsonSerializer.Serialize(new
    {
        model = aiOptions.ModelId,
        messages = new[] { new { role = "user", content = "Say hi in one word" } },
        max_tokens = 10,
        stream = false
    });

    var request = new HttpRequestMessage(HttpMethod.Post, $"{aiOptions.BaseUrl}/chat/completions")
    {
        Content = new StringContent(body, Encoding.UTF8, "application/json")
    };
    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", aiOptions.ApiKey);

    var sw = System.Diagnostics.Stopwatch.StartNew();
    try
    {
        using var response = await client.SendAsync(request);
        sw.Stop();
        var statusCode = (int)response.StatusCode;
        var responseBody = await response.Content.ReadAsStringAsync();
        var excerpt = responseBody.Length > 200 ? responseBody[..200] : responseBody;

        logger.LogInformation("Diagnose: chat completions returned {StatusCode} in {Elapsed}ms", statusCode, sw.ElapsedMilliseconds);
        return Results.Ok(new
        {
            groqStatus = statusCode,
            elapsedMs = sw.ElapsedMilliseconds,
            ok = statusCode == 200,
            message = statusCode == 200 ? null : excerpt
        });
    }
    catch (Exception ex)
    {
        sw.Stop();
        logger.LogError(ex, "Diagnose: chat completions failed after {Elapsed}ms", sw.ElapsedMilliseconds);
        return Results.Ok(new { groqStatus = 0, elapsedMs = sw.ElapsedMilliseconds, ok = false, error = ex.Message });
    }
});
```

**New `using` directive required.** Add `using System.Text;` for `Encoding.UTF8`. The existing file already imports:
- `System.Net.Http.Headers` (line 1) — for `AuthenticationHeaderValue`
- `System.Text.Json` (line 2) — for `JsonSerializer`

`StringContent` and `HttpClient` are in `System.Net.Http`, which is covered by `<ImplicitUsings>enable</ImplicitUsings>` in the Web SDK.

---

### 2. MODIFY: `backend.Tests/DiagnoseEndpointTests.cs` — update test names and assertions

The existing tests need updating to reflect the new chat completions endpoint behavior:

- **Rename** `GetDiagnose_HandlesUnreachableEndpointGracefully` to `GetDiagnose_HandlesChatCompletionsFailureGracefully` to reflect the new endpoint.
- **Update assertions**: The `message` field is now present on non-200 HTTP responses (e.g., 401). The test for the exception path (connection refused) still validates the `error` field but should no longer assert that `message` is absent — the response shape now always includes `message` for HTTP responses and `error` for exceptions.
- The failing-to-connect test still exercises the catch block, which returns `{ groqStatus: 0, elapsedMs, ok: false, error }`. No `message` field in the exception path.
- Other tests (success path) need to account for the new `message` field in the response (it will be `null` on 200).

---

## Edge cases the implementation must handle

| Edge case | Handling |
|-----------|----------|
| **HTTP 200 success** | Returns `{ groqStatus: 200, elapsedMs, ok: true }` |
| **HTTP 4xx/5xx** (e.g., 401 Unauthorized, 404 Model Not Found, 429 Rate Limited) | Reads the response body, extracts first 200 chars, returns `{ groqStatus, elapsedMs, ok: false, message: "..." }` |
| **Exception** (connection refused, DNS failure, TLS error, timeout) | Catch block returns `{ groqStatus: 0, elapsedMs, ok: false, error: "... " }` |
| **Timeout** (Groq unreachable or slow) | `client.Timeout = 10s` causes `TaskCanceledException`. Caught by catch block. `elapsedMs` will be ~10000. |
| **Empty response body on non-200** | `body` is empty string, `body.Length > 200` is false, excerpt is `""`. |
| **Response body shorter than 200 chars** | Used as-is (no out-of-range error). |
| **Invalid BaseUrl** | `new Uri(...)` throws at construction — this is a startup failure, not a runtime concern. If somehow reaching runtime, caught by catch block. |

---

## Existing patterns to follow

- **`IOptions<AiOptions>` injection**: Same as `GET /api/config` and the current diagnose handler — injected directly as a parameter.
- **`ILoggerFactory` injection**: Same pattern as `POST /api/audit` — create named logger from factory.
- **`HttpClient` usage**: Direct instantiation with `using`, same as the current handler. No `IHttpClientFactory`.
- **`Stopwatch`**: Same pattern as current handler — `System.Diagnostics.Stopwatch.StartNew()`.
- **Serilog logging**: `logger.LogInformation` / `logger.LogWarning` / `logger.LogError` with structured properties (`{StatusCode}`, `{Elapsed}ms`, `{Body}`).
- **Anonymous types for responses**: Same pattern as current handler and `/api/config`.
- **No new middleware, services, or DI registrations**: All types used are either already imported or covered by implicit usings.

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

# Expected success output (Groq is reachable):
# {"groqStatus":200,"elapsedMs":467,"ok":true,"message":null}

# Expected failure output (if networking broken):
# {"groqStatus":0,"elapsedMs":10000,"ok":false,"error":"...message..."}

# Expected auth/model error (if key invalid or model missing):
# {"groqStatus":401,"elapsedMs":350,"ok":false,"message":"...first 200 chars..."}

# 5. Verify the logs show the diagnostic entry
docker compose logs backend | findstr "Diagnose"
```
