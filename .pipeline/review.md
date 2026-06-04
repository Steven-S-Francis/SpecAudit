# Review: Move OpenAI client creation per-request to fix HTTP/2 connection pool poisoning

## VERDICT: SHIP

## Findings

### 1. Spec Compliance — ✅ PASS

| Requirement | Status | Notes |
|---|---|---|
| Only `backend/src/Services/SpecAuditService.cs` modified | ✅ | Only this file changed per `git diff` |
| Remove `private readonly ChatClient _chatClient` field | ✅ | Confirmed removed |
| Remove OpenAI SDK init from constructor | ✅ | Constructor now only assigns `_options` and `_logger` + logs |
| Add per-request client creation in `AuditAsync` | ✅ | `ApiKeyCredential` + `OpenAIClientOptions` + `OpenAIClient` + `GetChatClient` created at method top |
| Use local `chatClient` instead of `_chatClient` | ✅ | `chatClient.CompleteChatStreamingAsync(...)` |
| Everything after `await foreach` unchanged | ✅ | `ExtractStructuredJson`, logging, `yield return` pattern identical |
| No changes to other files | ✅ | `AuditEndpoints.cs`, `AiOptions.cs`, `.csproj`, tests all untouched |

### 2. Minor Deviation — `using` omitted (CORRECT)

The spec called for `using var client = new OpenAIClient(...)`. However, verification against the SDK's API surface (`api/OpenAI.netstandard2.0.cs`) confirms that **`OpenAIClient` does not implement `IDisposable`** in SDK v2.10.0. Using `using` would cause **CS1674** compile error.

The implementation omits `using`, matching the existing pattern in `AuditEndpoints.cs::DiagnoseSdkMode` (line 173). This is the **correct** approach — the object is not disposable, so garbage collection handles cleanup normally. No resource leak exists.

### 3. Security — ✅ SAFE (No Issues)

- **No information disclosure**: Log messages only emit metadata (model ID, char counts, token counts). Exception messages are not forwarded to clients.
- **No auth bypass**: No new endpoints added; `/api/audit` retains `RequireRateLimiting("AuditPolicy")`.
- **No injection vectors**: AI response processed through `ExtractStructuredJson` which uses `JsonDocument.Parse` with try/catch — safe.
- **No secrets exposure**: API key read from `_options.ApiKey` (DI-injected config), never logged or returned to clients.

### 4. Correctness — ✅ PASS (No Issues)

- **Async discipline**: `await foreach` correctly awaits the streaming call. No fire-and-forget.
- **State race conditions**: Each request creates its own `OpenAIClient` + `ChatClient` — no shared mutable state across requests.
- **Runtime type safety**: `JsonDocument.Parse` wrapped in try/catch in `ExtractStructuredJson`. No unsafe casts.
- **Error handling**: Empty `catch (JsonException) { }` on line 225 is the same pattern as before — it's intentional: `findingsCount` defaults to 0 and the log line still executes.

### 5. Edge Cases (from spec) — ✅ HANDLED

| Edge Case | Status | Notes |
|---|---|---|
| Disposed client during streaming | ✅ N/A | `OpenAIClient` not disposable; `chatClient` is local variable scoped to method |
| Cancellation during client creation | ✅ | Setup is synchronous; `CancellationToken` only used in `CompleteChatStreamingAsync` |
| Exception before disposal | ✅ N/A | No `IDisposable` to leak |
| Rapid successive requests | ✅ | Fresh connection pool per request — no cross-request poisoning |
| HTTP/2 connection reset | ✅ | Previous request's connection cannot affect new request |
| Null/empty API key | ✅ | Throws at network call (same as before) |
| Invalid endpoint URL | ✅ | Throws at network call (same as before) |

### 6. Test Results — ✅ ALL 29 PASS

All 29 tests pass across 5 test files (static unit tests + integration tests). No test changes were needed — tests use `WebApplicationFactory<Program>` integration testing and don't mock `ChatClient`.

### 7. Code Quality — ✅ Clean

- Per-request client creation follows the **existing project pattern** (`DiagnoseSdkMode` in `AuditEndpoints.cs`)
- Inline comment `// OpenAI client now created per-request in AuditAsync` aids readability
- No dead code, no cross-platform issues, no performance concerns

## Required Actions

None. The implementation is complete, correct, and ready to merge.

## Suggested Commit Message

```
perf: move OpenAI client creation per-request to fix HTTP/2 connection pool poisoning

Create a fresh OpenAIClient + ChatClient per AuditAsync invocation
instead of holding a singleton ChatClient in the constructor.
This ensures each audit request gets a clean HTTP/2 connection pool,
preventing silent failures when a pooled connection enters a bad state
after streaming completes or is aborted.

Closes #<issue>
```
