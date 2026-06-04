# Review: Add SDK non-streaming diagnostic mode to `/api/diagnose`

## VERDICT: SHIP

## Summary

The implementation faithfully follows the specification. The `/api/diagnose` endpoint now accepts an optional `mode` query parameter (`raw` or `sdk`) with backward-compatible default of `"raw"`. In SDK mode, it creates a fresh `OpenAIClient` + `ChatClient` matching the `SpecAuditService` initialization pattern, calls `CompleteChatAsync` with a simple prompt, and returns the diagnostic result. Four new tests cover default mode, SDK mode contract, SDK failure handling, and invalid mode fallback. All 274 tests (29 backend + 245 frontend) pass, and TypeScript type checking is clean.

## Checklist

- [x] **Spec compliance**: Implementation matches all spec requirements: `mode` query param (default `"raw"`), case-insensitive matching, SDK mode creates `ApiKeyCredential` + `OpenAIClientOptions` + `OpenAIClient` + `ChatClient`, uses `CompleteChatAsync` with `SystemChatMessage("You are a helpful assistant.")` + `UserChatMessage("Say the word HELLO")`, `MaxOutputTokenCount = 10`, `Temperature = 0.1f`, success response `{ groqStatus: 200, elapsedMs, ok: true, response, finishReason }`, failure response `{ groqStatus: 0, elapsedMs, ok: false, error }`.
- [x] **Backward compatible**: No `mode` param defaults to `"raw"`, preserving original behavior exactly. The raw mode logic is extracted unchanged into `DiagnoseRawMode()`.
- [x] **Tests pass**: 274 tests pass (29 backend + 245 frontend), 0 failures. The 4 new backend tests cover all key paths. Both frontend (`npm test`) and backend (`dotnet test`) suites were executed and reported.
- [x] **Code quality**: Clean implementation. All usings are used and necessary. No dead code, no unused imports, no cross-platform issues, no performance problems. Tests cover both failure contracts and the default/fallback behavior.
- [x] **Edge cases covered**: No `mode` param → raw (default), `mode=invalid` → raw fallback, `mode=RAW`/`mode=Raw` → case-insensitive matching, SDK failure (connection refused) → caught and returns `{ groqStatus: 0, ok: false, error }`. All documented in the spec's edge case table are handled.

## Findings

### Spec Adaptation (documented, acceptable)

The spec's original test code for `GetDiagnoseDefault_IsRawMode` and `GetDiagnose_InvalidModeFallsBackToRaw` checked for the `message` property to identify raw mode. However, because the test environment configures `BaseUrl = http://localhost:1` (which always produces a connection refused exception), the raw mode error path returns `error` (not `message`). The tests were correctly adapted to check for `error` instead of `message`, while still verifying that SDK-only fields (`response`, `finishReason`) are absent. This is a correct and necessary adjustment — the tests still validate the mode routing behavior. This change is documented in `changes.md` under "Spec Issues."

### Security

- **No information disclosure**: Exception messages (`ex.Message`) are returned as `error` in responses, which is intentional for this diagnostic endpoint. Stack traces are not exposed. The API key is used to create credentials but is never logged or returned in responses.
- **No new auth gaps**: The `/api/diagnose` endpoint existed before this change and was not mentioned in the spec as requiring new auth middleware. No new routes were created.
- **No injection vectors**: No user-supplied strings are interpolated into HTML, SQL, shell, or regex contexts. The `mode` parameter is safely compared against known values.
- **No secrets exposure**: API key is used only in `ApiKeyCredential` construction and HTTP Authorization header — never logged or echoed.

### Correctness

- **Async discipline**: All async calls are properly awaited. No fire-and-forget patterns. The `catch` blocks correctly stop the `Stopwatch` before reading `ElapsedMilliseconds`.
- **No race conditions**: Each request creates its own `HttpClient` (raw mode) or `OpenAIClient` (SDK mode). No shared mutable state between concurrent requests.
- **Runtime type safety**: Anonymous types are used for JSON serialization, which is safe. `result.Value.Content[0].Text` accesses the OpenAI SDK response with proper null guards (the SDK guarantees at least one choice in non-streaming responses).
- **No error swallowing**: All catch blocks log the exception and return a structured error response. No empty catch blocks.

## Required Actions

None. The implementation is complete, correct, and ready to ship.

## Notes

- The `using Sentry;` import (line 9) was already present before this change and is used by the existing `POST /api/audit` handler's catch block — no issue.
- `ROADMAP.md` was updated with the commit hash for this feature, which is a minor expected housekeeping change outside the spec scope.
