# Fix: Remove NetworkTimeout from OpenAI Client (was causing AI streaming to hang)

## Diagnosis

- **Curl test** confirmed the Groq API key is valid and `llama-3.3-70b-versatile` responds in under 5 seconds for a realistic OpenAPI spec.
- The 45-second CancellationToken timeout in `AuditEndpoints.cs` is correctly wired (`token.ThrowIfCancellationRequested()` in the foreach loop + three-tier catch blocks).
- **Root cause:** `NetworkTimeout = TimeSpan.FromSeconds(30)` in `SpecAuditService.cs` line 166 sets `HttpClient.Timeout`, which applies to the **entire HTTP request lifetime including reading streaming response chunks**. This conflicts with the OpenAI SDK's internal streaming pipeline, causing the SDK to either:
  - Throw `TaskCanceledException` after 30s (swallowed by catch block 2 as a generic timeout), or
  - Internally abort the stream read without surfacing the exception cleanly, resulting in zero text chunks before the 45s CancellationToken fires.

## Fix

**Single change:** Remove `NetworkTimeout = TimeSpan.FromSeconds(30)` from `SpecAuditService.cs`.

The 45-second CancellationToken in `AuditEndpoints.cs` remains as the sole timeout mechanism. It is enforced via:
1. The linked token passed to `CompleteChatStreamingAsync(..., token)` — the SDK may check it during HTTP operations.
2. `token.ThrowIfCancellationRequested()` at the top of the `await foreach` loop body — enforced between every chunk.
3. Catch block 2 (`catch (OperationCanceledException)` without `when` filter) — sends `[SPECAUDIT_ERROR]` timeout message to the client.

## Files to Modify

| Action | Path | Description |
|--------|------|-------------|
| MODIFY | `backend/src/Services/SpecAuditService.cs` | Remove line `NetworkTimeout = TimeSpan.FromSeconds(30)` from the `OpenAIClientOptions` initializer |

## Change Detail

### `backend/src/Services/SpecAuditService.cs`

**Current (lines 163–167):**
```csharp
var clientOptions = new OpenAIClientOptions
{
    Endpoint = new Uri(_options.BaseUrl),
    NetworkTimeout = TimeSpan.FromSeconds(30)
};
```

**New:**
```csharp
var clientOptions = new OpenAIClientOptions
{
    Endpoint = new Uri(_options.BaseUrl)
};
```

## Testing / Verification

1. `dotnet build` — must succeed with zero errors.
2. `dotnet test` — all 21 existing backend tests must pass.
3. **Manual test:** POST a small OpenAPI spec (e.g., the Petshop spec used in curl testing) to `POST /api/audit` locally or on Railway. Verify:
   - Audit completes in < 10 seconds (not 45s).
   - No `[SPECAUDIT_ERROR]` appears in the SSE stream.
   - Full markdown audit report + structured JSON sentinel are received.

## No Other Changes

- No changes to `AuditEndpoints.cs` (45s CTS, `token.ThrowIfCancellationRequested()`, three-tier catch blocks — all correct).
- No changes to `AiOptions`, `Program.cs`, or any other file.
- No changes to frontend.

## Edge Cases

| Edge Case | How it's handled |
|-----------|-----------------|
| **Groq genuinely slow (>45s)** | 45s CTS fires → catch block 2 sends `[SPECAUDIT_ERROR]` timeout to client. Same as before, but without NetworkTimeout racing against it. |
| **Groq instant response (<1s)** | Streaming completes normally → structured JSON extracted → both yield paths work correctly. |
| **Network glitch (connection loss)** | `HttpClient` eventually throws (after OS TCP timeout, typically 20-120s). The 45s CTS fires first, sending a clean timeout error. Acceptable behavior. |
| **Rate limit (429)** | Groq returns 429 immediately. The OpenAI SDK surfaces an exception with "429" in the message → catch block 3 sends the rate-limit-specific error message. No change in behavior. |
| **Client disconnects mid-stream** | `ct.IsCancellationRequested` is true → catch block 1 silently no-ops. No change. |
