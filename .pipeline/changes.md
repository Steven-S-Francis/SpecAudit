# Group 1 Changes — Critical bugs (A, G, H)

## Files Changed

### `backend/src/Endpoints/AuditEndpoints.cs` (Fix A)
- **Line 50:** Changed `ex.Message` to `"An error occurred. Please try again."` for all non-429 exceptions.
- The 429 rate-limit message is unchanged. Only non-429 exceptions now get a generic sanitized message instead of leaking the raw exception text.

### `frontend/src/hooks/useAudit.ts` (Fix G)
- **Line 53:** Added `await` before `audit(payload, true)` so the recursive retry call is awaited instead of fire-and-forget.
- This ensures the outer Promise does not resolve while retry work is still in flight, and prevents AbortController leaks.

### `frontend/src/api/auditClient.ts` (Fix H)
- Added `isValidStructuredData` type guard function (lines 4–28) that validates the shape of parsed structured JSON before passing it to `onStructured`.
- Updated the `[SPECAUDIT_STRUCTURED]` handler (lines 79–92) to wrap `onStructured` call in an `if (isValidStructuredData(data))` check.

### `frontend/src/api/__tests__/auditClient.test.ts` (Test fix)
- Updated the "does not pass structured chunk to onChunk" test to use valid structured payload (with proper `summary` and `findings` fields), since the new type guard requires a valid shape.

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` (frontend) | ✅ Passed (no errors) |
| `dotnet build` (backend) | ✅ Passed (0 warnings, 0 errors) |
| `npx vitest run --reporter=verbose` | ✅ **199 passed** (15 files, 0 failures) |

## Notes for Tester

- **Fix A**: The catch block now sends the generic message for any non-429 exception. To verify: mock the service to throw `new InvalidOperationException("some internal detail")` and confirm the SSE output contains `"An error occurred. Please try again."` rather than `"some internal detail"`.
- **Fix G**: The `await` makes the retry serial. The existing "retries and succeeds after RateLimitError" test still passes, confirming the retry logic works with `await`.
- **Fix H**: The type guard rejects malformed payloads. Existing test "calls onStructured when chunk contains [SPECAUDIT_STRUCTURED] prefix" (valid data) passes. New edge cases (missing `summary`, wrong field types) are now silently ignored rather than calling `onStructured` with garbage.
