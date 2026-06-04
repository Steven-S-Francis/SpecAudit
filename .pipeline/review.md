# Review: Remove RateLimitError retry logic from `useAudit`

## VERDICT: SHIP

## Checklist

| # | Check | Result |
|---|---|---|
| 1 | `maxRetries` constant removed from `useAudit.ts` | ✅ |
| 2 | `catch` block flattened: only `AbortError` → idle, else → error | ✅ |
| 3 | `RateLimitError` retry branch (with exponential backoff) fully removed | ✅ |
| 4 | `retryCount.current` no longer incremented anywhere (only reset to 0) | ✅ |
| 5 | Two retry test cases removed from test file | ✅ |
| 6 | All 7 remaining tests intact, no test regressions | ✅ |
| 7 | **309 tests pass** (280 frontend + 29 backend) — both suites executed | ✅ |
| 8 | `npm run build` — 0 errors (per changes.md) | ✅ |
| 9 | No unintended files changed (only the 2 specified source files + pipeline docs) | ✅ |
| 10 | No remaining references to removed test names or removed constants | ✅ |
| 11 | `RateLimitError` still thrown by `auditClient.ts` (API layer) — unchanged, correct | ✅ |

## Spec Conformance — PASS

The implementation matches the spec exactly:

- **`useAudit.ts`**: `const maxRetries = 3;` deleted. The `else if (RateLimitError && retryCount < maxRetries)` branch with exponential backoff (`1000 * Math.pow(2, retryCount - 1)`) removed. The `catch` block now has exactly two paths: `AbortError` → idle, else → error. The `retryCount.current = 0` reset is preserved in both paths.
- **`useAudit.test.tsx`**: Both `'retries and succeeds after RateLimitError'` and `'shows error after RateLimitError retries are exhausted'` tests removed. All other 7 tests kept unchanged.
- No files were changed beyond what the spec lists (the `.pipeline/*.md` files are build artifacts).

## Security — PASS (no new issues)

- The error message is still exposed via `(err as Error).message` in the else branch — this is **pre-existing behavior** preserved by the spec. The change does not introduce any new information disclosure.
- No new endpoints, routes, or auth bypasses introduced.
- No secrets, credentials, or internal URLs exposed.
- No injection vectors introduced.

## Correctness — PASS

- **Async discipline**: The `catch` block no longer contains an `await new Promise(...)` or recursive `await audit(payload, true)` call — no new async issues introduced.
- **State race conditions**: The `setState` calls are properly functional updaters (`s => ({ ...s, ... })`) in the else branch, matching the existing pattern.
- **Runtime type safety**: The `(err as Error).name` and `(err as Error).message` pattern is unchanged. The code still relies on `name` property at runtime (not TypeScript types), which is correct for error discrimination.
- **Error swallowing**: No empty catch blocks. All errors are handled either by resetting to idle (`AbortError`) or setting error state (everything else).

## Code Quality — PASS (non-blocking notes)

- **`retryCount.current` usage**: The ref is declared on line 16, reset on lines 21, 39, 43, 45 (all appropriate contexts: new audit, success, abort, error). It is no longer incremented anywhere. The ref could technically be removed entirely in a future cleanup since it's only ever set to 0, but that's out of scope for this change.
- **`RateLimitError` still defined in `auditClient.ts`**: The API client still throws `RateLimitError` for 429 responses. This is correct — the API layer should identify rate limits; only the retry handling was removed. If the error message "Rate limit reached" appears, it will now show immediately as a user-facing error (which is the intended behavior per spec).

## Suggested Commit Message

```
Remove RateLimitError retry logic from useAudit hook

- Delete const maxRetries = 3
- Remove the RateLimitError retry branch (exponential backoff with up to 3 retries)
- Rate-limit errors (429) now immediately show error state like all other errors
- AbortError handling is unchanged (still sets idle status)
- Remove two retry-related test cases; keep all 7 other tests
```

## Sign Off

**Reviewer**: Senior Code Reviewer  
**Date**: 2026-06-04  
**Verdict**: SHIP — all spec requirements met, no security or correctness issues, all 309 tests passing, code is clean.
