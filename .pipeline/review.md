# Review: Update `GET /api/diagnose` to hit Groq chat completions API

## VERDICT: SHIP

## Findings

### Spec Conformance — ✅ PASS

- **Handler replacement**: The handler body has been replaced exactly as specified. The old `client.GetAsync("models")` pattern is replaced with `HttpRequestMessage` POST to `{BaseUrl}/chat/completions` with a minimal chat completion payload (`model`, `messages`, `max_tokens: 10`, `stream: false`).
- **Response shape**:
  - HTTP 200: returns `{ groqStatus, elapsedMs, ok: true, message: null }` ✓
  - HTTP 4xx/5xx: returns `{ groqStatus, elapsedMs, ok: false, message: "<200-char excerpt>" }` ✓
  - Exception path: returns `{ groqStatus: 0, elapsedMs, ok: false, error: "..." }` (no `message` field) ✓
- **`using System.Text;`** added (line 2) for `Encoding.UTF8` ✓
- **Test renamed**: `GetDiagnose_HandlesUnreachableEndpointGracefully` → `GetDiagnose_HandlesChatCompletionsFailureGracefully` with updated doc comment ✓
- **Only the 5 expected files** were modified (2 source + 3 pipeline docs). No unexpected changes.
- **No superset or subset** — the implementation exactly matches the spec's `After` code block.

### Security — ✅ PASS

- **No stack trace leakage**: The `catch` block returns `ex.Message` (not `ex.ToString()`). Standard .NET exception messages (e.g., "No connection could be made because the target machine actively refused it.") contain no stack frames, internal paths, or secrets.
- **No API key exposure**: The API key is sent in the `Authorization` header (not in the URL, body, or response). The test suite confirms `GET /api/config` does not return the API key.
- **No injection vectors**: The endpoint takes no user input (pure `GET` with no query parameters). The request body is constructed from configuration values, not user-supplied strings.
- **No auth bypass**: The endpoint uses the same `IOptions<AiOptions>` injection and auth header pattern as the existing code.
- **Response body excerpt safety**: The `message` field is at most 200 characters of the external API response body — self-limiting and diagnostic-only.

### Correctness — ✅ PASS

- **Async discipline**: All async calls (`client.SendAsync`, `response.Content.ReadAsStringAsync`) are properly awaited. No fire-and-forget patterns.
- **Error handling**: The `try`/`catch` properly captures all `Exception` types. The `catch` block logs the error (with structured logging) and returns a well-formed response. No empty `catch` blocks; no error swallowing.
- **State safety**: Each request creates a fresh `HttpClient` disposed via `using`. No shared mutable state. Safe under concurrent requests.
- **Boundary safety**: The 200-char excerpt uses `responseBody[..200]` guarded by `responseBody.Length > 200`, preventing out-of-range exceptions.
- **Disposal**: `HttpClient` and `HttpResponseMessage` are disposed via `using`. `HttpRequestMessage` is not disposed but this is acceptable — it has no unmanaged resources in modern .NET, and the pattern matches the spec exactly.
- **Runtime type safety**: No `as` casts, no `JSON.parse` without validation (C# with `JsonSerializer`), no unguarded property access on external data.

### Testing — ✅ PASS

- **Backend tests**: All **25** pass (including the renamed `GetDiagnose_HandlesChatCompletionsFailureGracefully`).
- **Frontend tests**: All **245** pass across 17 test files (vitest).
- **TypeScript**: `tsc --noEmit` passes with zero errors.
- **Test coverage note**: All 4 diagnose tests exercise the exception path (connection refusal via `http://localhost:1`). The HTTP-error-path (`message` field from non-200 responses) is not covered. This gap is documented in `test-results.md` and acknowledged as a pre-existing limitation that was also present before this change. It is not a regression.

### Code Quality — ✅ PASS (non-blocking observations)

- **No dead code**: All new code is referenced and used.
- **No cross-platform issues**: No hardcoded path separators, no `\n`-only splits, no regex anchors.
- **No performance concerns**: Single-shot diagnostic endpoint with a 10-second timeout. No loops, no allocations beyond the response body.
- **No startup validation gaps**: Configuration validation (`AiOptions` missing fields) is separately covered by `AiOptionsValidationTests` (3 tests, all passing).

## Required Actions

None. All criteria pass. This change is ready to commit.

## Suggested Commit Message

```
fix: update /api/diagnose to test chat completions endpoint

Replace the GET /v1/models ping with a POST /chat/completions request
that exercises the full inference pipeline (auth, routing, serialization,
deserialization). Returns a `message` field with a 200-char excerpt on
HTTP errors, and `error` on exceptions.

Closes: <ticket-if-applicable>
```
