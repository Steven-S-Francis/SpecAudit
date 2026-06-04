# Add SDK non-streaming diagnostic mode to `/api/diagnose`

## Why this change is needed

We need to isolate whether the streaming issue (zero chunks inside Docker) is in the OpenAI SDK's HTTP pipeline or in the SSE streaming parser. A non-streaming `CompleteChatAsync` call via the SDK (identical initialization to `SpecAuditService`) will reveal which:

- If SDK non-streaming **works** inside Docker → the bug is in the SSE streaming parser (buffer size, encoding, line endings)
- If SDK non-streaming **fails** inside Docker → the bug is in the SDK's internal `HttpClient` pipeline (different TLS, HTTP version, proxy handling vs. raw `HttpClient`)

---

## File changes

### 1. MODIFY: `backend/src/Endpoints/AuditEndpoints.cs`

**Add `using` directives** at top of file (insert after line 10, before `namespace`):

```csharp
using OpenAI;
using OpenAI.Chat;
using System.ClientModel;
```

**Modify the `/api/diagnose` endpoint** (lines 94–140). Add a `mode` query parameter and branch logic:

```csharp
app.MapGet("/api/diagnose", async (
    IOptions<AiOptions> options,
    ILoggerFactory loggerFactory,
    string? mode = null) =>       // ← new parameter
{
    var logger = loggerFactory.CreateLogger("SpecAudit.Diagnose");
    var aiOptions = options.Value;

    // Default to "raw" for backward compatibility
    mode = mode?.ToLowerInvariant() ?? "raw";

    if (mode == "sdk")
        return await DiagnoseSdkMode(logger, aiOptions);
    else
        return await DiagnoseRawMode(logger, aiOptions);
});
```

**Extract two private static methods** inside `AuditEndpoints`:

```csharp
private static async Task<IResult> DiagnoseRawMode(ILogger logger, AiOptions aiOptions)
{
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

        logger.LogInformation("Diagnose raw: chat completions returned {StatusCode} in {Elapsed}ms", statusCode, sw.ElapsedMilliseconds);
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
        logger.LogError(ex, "Diagnose raw: chat completions failed after {Elapsed}ms", sw.ElapsedMilliseconds);
        return Results.Ok(new { groqStatus = 0, elapsedMs = sw.ElapsedMilliseconds, ok = false, error = ex.Message });
    }
}

private static async Task<IResult> DiagnoseSdkMode(ILogger logger, AiOptions aiOptions)
{
    var credential = new ApiKeyCredential(aiOptions.ApiKey);
    var clientOptions = new OpenAIClientOptions
    {
        Endpoint = new Uri(aiOptions.BaseUrl)
        // NO NetworkTimeout — matches SpecAuditService constructor
    };
    var client = new OpenAIClient(credential, clientOptions);
    var chatClient = client.GetChatClient(aiOptions.ModelId);

    var messages = new List<ChatMessage>
    {
        new SystemChatMessage("You are a helpful assistant."),
        new UserChatMessage("Say the word HELLO")
    };

    var chatOptions = new ChatCompletionOptions
    {
        MaxOutputTokenCount = 10,
        Temperature = 0.1f
    };

    var sw = System.Diagnostics.Stopwatch.StartNew();
    try
    {
        var result = await chatClient.CompleteChatAsync(messages, chatOptions);
        sw.Stop();

        var statusCode = 200; // SDK didn't throw, so it's a success
        var response = result.Value.Content[0].Text;
        var finishReason = result.Value.FinishReason.ToString();

        logger.LogInformation(
            "Diagnose SDK: non-streaming chat completed in {Elapsed}ms, finishReason={FinishReason}",
            sw.ElapsedMilliseconds, finishReason);

        return Results.Ok(new
        {
            groqStatus = statusCode,
            elapsedMs = sw.ElapsedMilliseconds,
            ok = true,
            response,
            finishReason
        });
    }
    catch (Exception ex)
    {
        sw.Stop();
        logger.LogError(ex, "Diagnose SDK: non-streaming chat failed after {Elapsed}ms", sw.ElapsedMilliseconds);
        return Results.Ok(new
        {
            groqStatus = 0,
            elapsedMs = sw.ElapsedMilliseconds,
            ok = false,
            error = ex.Message
        });
    }
}
```

**Important implementation notes:**

- The `mode` parameter is a `string?` on the `MapGet` delegate — ASP.NET Core automatically binds query string parameters by name to delegate parameters. No `[FromQuery]` attribute is needed (ASP.NET Core minimal APIs do this by convention).
- The extracted methods are `private static` inside the `AuditEndpoints` static class — no new class needed.
- The existing raw mode logic is **identical** to the current implementation; only extracted into a named method for clarity.
- The SDK mode response shape differs from raw mode: success returns `response` + `finishReason` instead of `message`. Failure returns `error` (same as raw mode failure).

---

### 2. MODIFY: `backend.Tests/DiagnoseEndpointTests.cs`

**Add new test methods** after the existing `GetDiagnose_RespondsWithinReasonableTime` test:

```csharp
[Fact]
public async Task GetDiagnoseDefault_IsRawMode()
{
    // The default (no mode param) should produce raw-mode response shape:
    // { groqStatus, elapsedMs, ok, message } — NOT { response, finishReason }
    var response = await _client.GetAsync("/api/diagnose");
    response.StatusCode.Should().Be(HttpStatusCode.OK);

    var json = await response.Content.ReadAsStringAsync();
    using var doc = JsonDocument.Parse(json);

    // Raw mode has "message" but not "response" or "finishReason"
    doc.RootElement.TryGetProperty("message", out _).Should().BeTrue();
    doc.RootElement.TryGetProperty("response", out _).Should().BeFalse();
    doc.RootElement.TryGetProperty("finishReason", out _).Should().BeFalse();
}

[Fact]
public async Task GetDiagnoseSdkMode_ReturnsExpectedContract()
{
    // SDK mode response shape: { groqStatus, elapsedMs, ok, error? }
    // (The configured BaseUrl http://localhost:1 triggers connection refused,
    //  so we test the failure contract.)
    var response = await _client.GetAsync("/api/diagnose?mode=sdk");
    response.StatusCode.Should().Be(HttpStatusCode.OK);

    var json = await response.Content.ReadAsStringAsync();
    using var doc = JsonDocument.Parse(json);

    doc.RootElement.TryGetProperty("groqStatus", out var groqStatus).Should().BeTrue();
    doc.RootElement.TryGetProperty("elapsedMs", out var elapsedMs).Should().BeTrue();
    doc.RootElement.TryGetProperty("ok", out var ok).Should().BeTrue();

    groqStatus.ValueKind.Should().Be(JsonValueKind.Number);
    elapsedMs.ValueKind.Should().Be(JsonValueKind.Number);
    ok.ValueKind.Should().BeOneOf(JsonValueKind.True, JsonValueKind.False);

    // Since localhost:1 will fail, ok should be false
    ok.GetBoolean().Should().BeFalse();
    groqStatus.GetInt32().Should().Be(0);

    // Error message should be present
    doc.RootElement.TryGetProperty("error", out var error).Should().BeTrue();
    error.GetString().Should().NotBeNullOrWhiteSpace();
}

[Fact]
public async Task GetDiagnoseSdkMode_HandlesFailureGracefully()
{
    // Verify SDK mode handles connection failure without throwing
    var response = await _client.GetAsync("/api/diagnose?mode=sdk");
    response.StatusCode.Should().Be(HttpStatusCode.OK);

    var json = await response.Content.ReadAsStringAsync();
    using var doc = JsonDocument.Parse(json);

    doc.RootElement.GetProperty("ok").GetBoolean().Should().BeFalse();
    doc.RootElement.GetProperty("elapsedMs").GetInt64().Should().BeGreaterThan(0);
}

[Fact]
public async Task GetDiagnose_InvalidModeFallsBackToRaw()
{
    // An unrecognized mode value should fall back to raw
    var response = await _client.GetAsync("/api/diagnose?mode=invalid");
    response.StatusCode.Should().Be(HttpStatusCode.OK);

    var json = await response.Content.ReadAsStringAsync();
    using var doc = JsonDocument.Parse(json);

    // Should have raw-mode fields
    doc.RootElement.TryGetProperty("message", out _).Should().BeTrue();
    doc.RootElement.TryGetProperty("response", out _).Should().BeFalse();
}
```

**Existing tests remain unchanged** — they all hit the default (raw) mode and still validate correct behavior.

---

## Edge cases the implementation must handle

| Edge case | Handling |
|-----------|----------|
| **No `mode` param** | Defaults to `"raw"` (backward compatible) |
| **`mode=raw`** | Explicit raw mode, same as default |
| **`mode=sdk`** | Uses OpenAI SDK `CompleteChatAsync` |
| **`mode=invalid`** | Falls back to raw (any unrecognized value triggers `else` branch) |
| **`mode=RAW`/`mode=Raw`** | Case-insensitive via `.ToLowerInvariant()` |
| **SDK mode: API key invalid** | `OpenAIClient` throws at `CompleteChatAsync`; caught by catch block → `{ groqStatus: 0, elapsedMs, ok: false, error }` |
| **SDK mode: network failure** | Same as above — caught by catch block |
| **SDK mode: API returns 4xx** | The OpenAI SDK throws `ClientResultException`; caught by catch block |
| **SDK mode: null/empty response text** | `result.Value.Content[0].Text` could be `""` if model returns empty — unlikely but possible; returned as-is |
| **SDK mode: FinishReason unexpected** | `result.Value.FinishReason.ToString()` — always a valid enum value (e.g., "stop", "length", "content_filter") |

---

## Existing patterns to follow

| Pattern | Reference |
|---------|-----------|
| `ApiKeyCredential` + `OpenAIClientOptions` + `OpenAIClient` + `ChatClient` | `SpecAuditService.cs` lines 162–169 |
| `ChatCompletionOptions` with `MaxOutputTokenCount` and `Temperature` | `SpecAuditService.cs` lines 187–191 |
| `IOptions<AiOptions>` injection | Current `/api/diagnose` handler (line 94) |
| `ILoggerFactory` + named logger | Current `/api/diagnose` handler (lines 96–97) |
| `Stopwatch` timing | Current `/api/diagnose` handler (line 116) |
| Anonymous types for JSON responses | Current `/api/diagnose` handler (lines 126–132, 138) |
| Test setup with `WebApplicationFactory<Program>` + `AddInMemoryCollection` | `DiagnoseEndpointTests.cs` lines 14–28 |

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

# 4. Test raw mode (default)
Invoke-RestMethod "http://localhost:5000/api/diagnose?mode=raw"

# 5. Test SDK mode
Invoke-RestMethod "http://localhost:5000/api/diagnose?mode=sdk"
```

**SDK mode expected success:**
```json
{
  "groqStatus": 200,
  "elapsedMs": 219,
  "ok": true,
  "response": "HELLO",
  "finishReason": "stop"
}
```

**SDK mode expected failure (e.g., bad API key):**
```json
{
  "groqStatus": 0,
  "elapsedMs": 1042,
  "ok": false,
  "error": "...message..."
}
```

---

## Open Questions

None. All details are specified above.
