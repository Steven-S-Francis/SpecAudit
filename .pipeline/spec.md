# Move OpenAI client creation per-request to fix HTTP/2 connection pool poisoning

## Root cause

The `SpecAuditService` holds a **singleton `ChatClient`** (created once in the constructor and stored as `private readonly ChatClient _chatClient`). The `OpenAIClient` (and its internal `HttpClient`/`SocketsHttpHandler`) maintains an HTTP/2 connection pool to Groq. When a streaming request completes naturally or is aborted (e.g., user presses Escape), the pooled HTTP/2 connection enters a bad state (half-closed or reset). All subsequent requests that reuse that pooled connection silently fail — they never receive any chunks, even though no exception is thrown. The fix is to create a **fresh `OpenAIClient` + `ChatClient` per request**, so each audit request gets a clean connection pool.

---

## File to modify

**Only one file:** `backend/src/Services/SpecAuditService.cs`

No changes to:
- `backend/backend.csproj` (OpenAI SDK package stays)
- `backend/src/Endpoints/AuditEndpoints.cs` (endpoint logic is unchanged)
- `backend/src/Configuration/AiOptions.cs` (options class unchanged)
- `backend.Tests/` (tests use `WebApplicationFactory<Program>` integration testing, no `ChatClient` mocking)

---

## Exact changes

### 1. Remove `private readonly ChatClient _chatClient;` field

**Before (line 153):**
```csharp
    private readonly ChatClient _chatClient;
    private readonly AiOptions _options;
    private readonly ILogger<SpecAuditService> _logger;
```

**After:**
```csharp
    private readonly AiOptions _options;
    private readonly ILogger<SpecAuditService> _logger;
```

### 2. Remove OpenAI SDK initialization from the constructor

**Before (lines 157–173):**
```csharp
    public SpecAuditService(IOptions<AiOptions> options, ILogger<SpecAuditService> logger)
    {
        _options = options.Value;
        _logger = logger;

        var credential = new ApiKeyCredential(_options.ApiKey);
        var clientOptions = new OpenAIClientOptions
        {
            Endpoint = new Uri(_options.BaseUrl)
            // NO NetworkTimeout — test harness proves it's unnecessary
        };
        var client = new OpenAIClient(credential, clientOptions);
        _chatClient = client.GetChatClient(_options.ModelId);

        _logger.LogInformation("SpecAuditService initialized for model {ModelId} at {BaseUrl}",
            _options.ModelId, _options.BaseUrl);
    }
```

**After:**
```csharp
    public SpecAuditService(IOptions<AiOptions> options, ILogger<SpecAuditService> logger)
    {
        _options = options.Value;
        _logger = logger;

        _logger.LogInformation("SpecAuditService initialized for model {ModelId} at {BaseUrl}",
            _options.ModelId, _options.BaseUrl);
    }
```

### 3. Add client creation at the top of `AuditAsync`, before the `await foreach`

**Before (lines 177–232):**
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

        _logger.LogInformation("Starting AI audit stream for spec ({Length} chars)", request.Spec.Length);

        var fullText = new StringBuilder();

        await foreach (var update in _chatClient.CompleteChatStreamingAsync(messages, options, CancellationToken.None))
        {
            foreach (var part in update.ContentUpdate)
            {
                if (!string.IsNullOrEmpty(part.Text))
                {
                    fullText.Append(part.Text);
                    yield return part.Text;
                }
            }
        }
        // ... rest unchanged
    }
```

**After:**
```csharp
    public async IAsyncEnumerable<string> AuditAsync(
        AuditRequest request,
        [EnumeratorCancellation] CancellationToken ct)
    {
        var credential = new ApiKeyCredential(_options.ApiKey);
        var clientOptions = new OpenAIClientOptions
        {
            Endpoint = new Uri(_options.BaseUrl)
            // NO NetworkTimeout — proven unnecessary
        };
        using var client = new OpenAIClient(credential, clientOptions);
        var chatClient = client.GetChatClient(_options.ModelId);

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

        _logger.LogInformation("Starting AI audit stream for spec ({Length} chars)", request.Spec.Length);

        var fullText = new StringBuilder();

        await foreach (var update in chatClient.CompleteChatStreamingAsync(messages, options, CancellationToken.None))
        {
            foreach (var part in update.ContentUpdate)
            {
                if (!string.IsNullOrEmpty(part.Text))
                {
                    fullText.Append(part.Text);
                    yield return part.Text;
                }
            }
        }

        _logger.LogInformation("AI audit stream completed ({TokenCount} chars received)", fullText.Length);

        var structuredJson = ExtractStructuredJson(fullText.ToString());
        if (structuredJson is not null)
        {
            var findingsCount = 0;
            try
            {
                using var doc = JsonDocument.Parse(structuredJson);
                if (doc.RootElement.TryGetProperty("summary", out var summary) &&
                    summary.TryGetProperty("totalFindings", out var total))
                {
                    findingsCount = total.GetInt32();
                }
            }
            catch (JsonException) { }
            _logger.LogInformation("Structured JSON extracted ({FindingsCount} findings)", findingsCount);
            yield return $"[SPECAUDIT_STRUCTURED]{structuredJson}";
        }
        else
        {
            _logger.LogInformation("No structured JSON found in response");
        }
    }
```

**Key differences in the `AuditAsync` method after the change:**
- `var credential = new ApiKeyCredential(_options.ApiKey);` — moved inside
- `var clientOptions = new OpenAIClientOptions { ... };` — moved inside
- `using var client = new OpenAIClient(credential, clientOptions);` — new, disposed after each request
- `var chatClient = client.GetChatClient(_options.ModelId);` — local variable instead of field
- `chatClient.CompleteChatStreamingAsync(...)` — uses local variable instead of `_chatClient`
- Everything after the `await foreach` (ExtractStructuredJson, logging) is **unchanged**

### 4. What stays completely unchanged

- All `using` directives at the top of the file (`OpenAI`, `OpenAI.Chat`, `System.ClientModel`, etc.)
- The `SystemPrompt` constant
- The `StructuredSentinel` constant
- `MaxInputLength` property
- `BuildUserMessage` method — stays `internal static`
- `ExtractStructuredJson` method — stays `internal static`
- All `_logger.LogInformation(...)` calls (signatures and messages unchanged)
- `AuditRequest` parameter type and the `[EnumeratorCancellation] CancellationToken ct`
- The `yield return` streaming pattern

---

## Edge cases the implementation must handle

| Edge case | Handling |
|-----------|----------|
| **Disposed client during streaming** | `using var client` is scoped to the entire `AuditAsync` method; the `await foreach` completes before `client.Dispose()` is called, so the client is alive for the entire stream |
| **Cancellation during client creation** | Client creation happens before `CancellationToken.None` is used — no cancellation token during setup means no risk of partial initialization |
| **Exception before `using var client` disposes** | `using` guarantees disposal even if an exception is thrown mid-stream (the `finally` block runs) |
| **Rapid successive requests** | Each request creates + disposes its own connection pool; no pooled connections to poison across requests |
| **HTTP/2 connection reset** | Fresh client = fresh connection; previous request's connection state cannot affect the new one |
| **`ApiKeyCredential` with null/empty key** | Will throw at `CompleteChatStreamingAsync` call (not at construction) — same behavior as before, caught by the endpoint's catch block |
| **`OpenAIClient` constructor with invalid endpoint** | Same as above — throws at first network call, not at construction |
| **Client disposal after SSE stream ends** | `using var client` ensures the HttpClient is disposed after all `yield return` statements complete, including the final `yield return` for structured JSON |

---

## Test implications

### Unaffected tests (pass without changes)

| Test file | Reason |
|-----------|--------|
| `backend.Tests/ExtractStructuredJsonTests.cs` | Tests `SpecAuditService.ExtractStructuredJson` — a `static` method, no dependency on `ChatClient` |
| `backend.Tests/UserMessageBuilderTests.cs` | Tests `SpecAuditService.BuildUserMessage` — a `static` method, no dependency on `ChatClient` |
| `backend.Tests/DiagnoseEndpointTests.cs` | Tests `/api/diagnose` endpoint, which has its own client creation logic — not affected |
| `backend.Tests/SentryStartupTests.cs` | Tests Sentry integration, not `SpecAuditService` |
| `backend.Tests/AiOptionsValidationTests.cs` | Tests configuration validation, not `SpecAuditService` |

### Potentially affected tests

| Test file | Impact | Notes |
|-----------|--------|-------|
| `backend.Tests/EndpointValidationTests.cs` | **Should pass unchanged** | Uses `WebApplicationFactory<Program>` which resolves `SpecAuditService` via DI. The test's `BaseUrl` is `https://test.example.com/v1` — the HTTP call will fail (no real server), but the test only checks status codes (400, 413, 200). The 200 test (`PostAudit_TrimmedSpec_AcceptsSpec`) passes because the endpoint catches the exception and returns `Results.Empty` with status 200. This behavior is unchanged. |

### No tests directly mock `ChatClient`
A review of all test files confirms none of them inject a mock `ChatClient` into `SpecAuditService`. All tests use `WebApplicationFactory<Program>` integration testing with in-memory configuration. No test updates are needed.

---

## Verification steps

### 1. Build
```powershell
cd backend
dotnet build
# Expected: 0 errors, 0 warnings
```

### 2. Run all tests
```powershell
cd backend.Tests
dotnet test
# Expected: all tests pass
```

### 3. Manual integration test (sequential audits)
```powershell
# Start fresh stack
docker compose down
docker compose build --no-cache
docker compose up -d

# Run 3 audits in a row — every one must complete in <15 seconds
curl -X POST http://localhost:5000/api/audit `
  -H "Content-Type: application/json" `
  -d '{\"spec\": \"openapi: 3.0.3\ninfo:\n  title: Test\n  version: \"1.0.0\"\npaths: {}\"}'

# Repeat twice more — all must succeed
```

### 4. Manual integration test (abort then retry)
```powershell
# Start an audit and press Escape/Ctrl+C during streaming
# Then immediately run another audit — it MUST complete successfully
```

### 5. Check diagnose endpoint still works
```powershell
Invoke-RestMethod "http://localhost:5000/api/diagnose?mode=sdk"
Invoke-RestMethod "http://localhost:5000/api/diagnose?mode=raw"
# Both should return 200
```

---

## Existing patterns to follow

| Pattern | Reference |
|---------|-----------|
| `ApiKeyCredential` + `OpenAIClientOptions` + `OpenAIClient` + `ChatClient` initialization | `AuditEndpoints.cs` `DiagnoseSdkMode` method (lines 167–174) — already does the same per-request pattern |
| `using var client = new OpenAIClient(...)` | Standard .NET `IDisposable` pattern; ensures the `HttpClient`/`HttpMessageHandler` is disposed |
| `CancellationToken.None` in `CompleteChatStreamingAsync` | Kept as-is to avoid cancellation token issues with SSE streaming |
| `ChatCompletionOptions` with `MaxOutputTokenCount` and `Temperature` | `SpecAuditService.cs` lines 187–191 (unchanged) |
| IAsyncEnumerable streaming with `yield return` | `SpecAuditService.cs` entire `AuditAsync` method (unchanged) |

---

## Open Questions

None. All details are specified above.
