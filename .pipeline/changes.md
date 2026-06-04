# Changes Made

## Summary
Removed the `RateLimitError` retry logic from `useAudit` hook. Rate-limit errors (429) now immediately show an error state instead of retrying with exponential backoff.

## Files Modified

### `frontend/src/hooks/useAudit.ts`
- **Removed** `const maxRetries = 3;` constant (line 17)
- **Removed** the `else if` branch that caught `RateLimitError` and performed up to 3 retries with exponential backoff (1s, 2s, 4s delays)
- All non-`AbortError` errors (including `RateLimitError`, network errors, server errors) now fall through to the `else` branch, which immediately sets `status: 'error'` with the error message
- `retryCount.current` is still reset to `0` in both error paths; it is no longer incremented anywhere

### `frontend/src/hooks/__tests__/useAudit.test.tsx`
- **Removed** test case `'retries and succeeds after RateLimitError'`
- **Removed** test case `'shows error after RateLimitError retries are exhausted'`
- All other 7 tests remain unchanged

## Verification
- `npm run build` — 0 errors, build succeeds
- `npx vitest run` — 280 tests pass across 19 test files

## What the Tester Should Focus On
1. Verify that sending a request that returns a `RateLimitError` (HTTP 429) now immediately shows an error state with no retry delay.
2. Verify that `AbortError` is still handled separately (sets `status: 'idle'`).
3. Verify that other errors (generic `Error`, network failures) still behave identically (immediate `status: 'error'`).
