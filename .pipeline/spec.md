# Replace OpenAI SDK streaming with raw HttpClient + SSE parsing

## Background

The OpenAI SDK v2.10.0's `CompleteChatStreamingAsync` yields zero chunks from Groq when any non-default `CancellationToken` is passed. This is a confirmed SDK-incompatibility with Groq's SSE streaming. Non-streaming SDK calls (`CompleteChatAsync`) work fine. Raw `HttpClient` POST to `/chat/completions` with `"stream":false` works fine.

## Solution

Replace the SDK streaming call in `SpecAuditService.AuditAsync` with a raw `HttpClient` POST + manual SSE line-by-line parsing. Keep the OpenAI SDK package (`OpenAI` 2.10.0) as a dependency for the `GET /api/diagnose?mode=sdk` endpoint only.

## Files to Modify

### 1. `backend/src/Services/SpecAuditService.cs`

**What changes:**
- Remove `using OpenAI;`, `using OpenAI.Chat;`, `using System.ClientModel;` — no longer used in this file
- Add `using System.Net.Http.Headers;`, `using System.Text.Json;` (the latter is already present)
- Replace the body of `AuditAsync` (lines 169–233) with an SSE streaming implementation using `HttpClient`
- Keep `BuildUserMessage` and `ExtractStructuredJson` unchanged

**New `AuditAsync` method (conceptual):**

```csharp
public async IAsyncEnumerable<string> AuditAsync(
    AuditRequest request,
    [EnumeratorCancellation] CancellationToken ct)
{
    using var client = new HttpClient();
    client.Timeout = TimeSpan.FromSeconds(45); // matches the endpoint CTS

    var payload = new
    {
        model = _options.ModelId,
        messages = new object[]
        {
            new { role = "system", content = SystemPrompt },
            new { role = "user", content = BuildUserMessage(request) }
        },
        max_tokens = _options.MaxTokens,
        temperature = 0.1f,
        stream = true
    };

    var jsonPayload = JsonSerializer.Serialize(payload);

    using var httpRequest = new HttpRequestMessage(HttpMethod.Post, $"{_options.BaseUrl}/chat/completions")
    {
        Content = new StringContent(jsonPayload, Encoding.UTF8, "application/json")
    };
    httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);

    _logger.LogInformation("Starting AI audit stream for spec ({Length} chars)", request.Spec.Length);

    using var httpResponse = await client.SendAsync(
        httpRequest,
        HttpCompletionOption.ResponseHeadersRead,
        ct);

    httpResponse.EnsureSuccessStatusCode();

    using var stream = await httpResponse.Content.ReadAsStreamAsync(ct);
    using var reader = new StreamReader(stream);

    var fullText = new StringBuilder();
    string? line;

    while ((line = await reader.ReadLineAsync(ct)) is not null)
    {
        if (string.IsNullOrEmpty(line))
            continue;

        if (line.StartsWith("data: ", StringComparison.Ordinal))
        {
            var data = line[6..];

            if (data == "[DONE]")
                break;

            // Parse JSON: { choices: [{ delta: { content: "..." } }] }
            try
            {
                using var doc = JsonDocument.Parse(data);
                var choices = doc.RootElement.GetProperty("choices");
                if (choices.GetArrayLength() > 0)
                {
                    var delta = choices[0].GetProperty("delta");
                    if (delta.TryGetProperty("content", out var contentEl) &&
                        contentEl.ValueKind == JsonValueKind.String)
                    {
                        var text = contentEl.GetString();
                        if (!string.IsNullOrEmpty(text))
                        {
                            fullText.Append(text);
                            yield return text;
                        }
                    }
                }
            }
            catch (JsonException ex)
            {
                _logger.LogWarning(ex, "SSE parse warning for chunk: {Data}", data);
            }
        }
    }

    _logger.LogInformation("AI audit stream completed ({TokenCount} chars received)", fullText.Length);

    // Structured JSON extraction (unchanged)
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

**Additional changes in this file:**
- Add `using System.Net.Http.Headers;` to the top
- Remove `using OpenAI;`, `using OpenAI.Chat;`, `using System.ClientModel;`
- Remove the `_logger.LogInformation("SpecAuditService initialized...")` message about model/URL (it can stay — harmless)

### 2. `backend/src/Endpoints/AuditEndpoints.cs`

**No changes needed.** The existing endpoint code remains exactly as-is:
- The `catch (OperationCanceledException)` blocks (client abort vs. server timeout) still work because `HttpClient.SendAsync` will throw `OperationCanceledException` when `ct` fires
- The `try`/`catch`/`finally` structure for SSE output is unchanged
- The diagnose endpoints are unchanged

## Edge Cases the Implementation Must Handle

1. **`data: [DONE]`** — must break out of the read loop cleanly
2. **Heartbeat/keepalive lines** — empty `data: ` lines or lines without `data: ` prefix are silently skipped
3. **HTTP error from Groq** (429, 401, 500) — `httpResponse.EnsureSuccessStatusCode()` throws `HttpRequestException`, caught by the `catch (Exception ex)` block in `AuditEndpoints`
4. **Cancellation during SSE read** — `await reader.ReadLineAsync(ct)` throws `OperationCanceledException`, caught by the existing catch blocks
5. **Partial/broken JSON in chunk** — caught by `try/catch (JsonException)`, logged as warning, chunk skipped
6. **Missing `choices` array or `delta.content`** — `TryGetProperty` / check array length to avoid `KeyNotFoundException`
7. **Network error mid-stream** — `HttpClient.SendAsync` or `ReadLineAsync` throws, caught upstream
8. **Empty response (no chunks before `[DONE]`)** — `fullText` will be empty, `ExtractStructuredJson` returns null, logging covers this

## Existing Patterns to Follow

- **HttpClient usage per request**: same pattern as `DiagnoseRawMode` in `AuditEndpoints.cs` — create local `using var client = new HttpClient()`, set `Timeout`, use `AuthenticationHeaderValue`
- **SSE line-by-line reading**: standard pattern from the `DiagnoseRawMode` approach, extended with `StreamReader.ReadLineAsync` in a `while` loop
- **Cancellation propagation**: `ct` is passed to every async call (`SendAsync`, `ReadAsStreamAsync`, `ReadLineAsync`) — same as the current approach

## No Files to Create

No new files are needed. Everything goes into `SpecAuditService.cs`.

## Verification

1. `dotnet build` — 0 errors
2. `dotnet test` — all existing tests pass (they test `BuildUserMessage`, `ExtractStructuredJson`, diagnose endpoints — none test the SDK streaming path directly, so they should be unaffected)
3. Manual test: POST a 355-char spec → completes in <10s with visible chunks
4. Manual test: POST a 6995-char spec → completes in <45s with visible chunks
5. Manual test: Press Escape during streaming → next audit still works
6. Manual test: `GET /api/diagnose?mode=sdk` still works (uses non-streaming SDK path, unchanged)
7. Manual test: `GET /api/diagnose?mode=raw` still works (raw HttpClient non-streaming, unchanged)
