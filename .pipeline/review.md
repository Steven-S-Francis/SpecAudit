# Pipeline Review
**Date:** 2026-06-02

## Scope
Rate-limit retry with exponential backoff (1s, 2s, 4s, max 3 retries) for the SpecAudit frontend. Two files modified: frontend/src/api/auditClient.ts (rate-limit sentinel detection) and frontend/src/hooks/useAudit.ts (retry logic). Four new tests across two test files.

## Assessment

- **Spec Compliance: NEEDS WORK** — auditClient.ts matches the spec exactly (sets err.name = 'RateLimitError' on rate-limit sentinels). However, useAudit.ts deviates from the spec: the spec showed unconditional retryCount.current = 0 at the top of audit() (which would cause infinite retries), but the implementation uses an isRetry parameter to guard the reset. This is actually a fix to a spec bug, but it means the spec no longer reflects the implementation. The isRetry parameter was never described in the spec. The pipeline artifacts (test-results.md) also claim a "Known Bug: Infinite Retry Loop" that does not exist in the actual code -- the isRetry guard correctly prevents it.

- **Build: FAILS** -- npm run build (which runs tsc -b && vite build) fails with:
  src/hooks/useAudit.ts(29,9): error TS18047: 'abortRef.current' is possibly 'null'.
  When isRetry is true, the if (!isRetry) block is skipped, so abortRef.current is never reassigned. TypeScript correctly flags abortRef.current.signal as potentially null. The test-results.md incorrectly claims ZERO ERRORS. Fix: Add a non-null assertion (abortRef.current!.signal) or a runtime guard.

- **Test Quality: GOOD** -- All 4 new tests are meaningful:
  1. RateLimitError name detection (positive)
  2. Non-rate-limit error name (negative)
  3. Retry after RateLimitError -> success
  4. Retry exhaustion -> error state
  All 67 frontend tests pass (10/10 files), all 11 backend tests pass. The retry-exhaustion test has a misleading comment ("attempt 4 -- should not be reached" although it is reached), but the test logic is correct. Tests use vi.useFakeTimers() plus manual act() advancement, which is functional but somewhat fragile.

- **Security: PASS** -- No concerns. Rate-limit detection is purely client-side string matching; no new network or data exposure.

- **Performance: PASS** -- At most 3 retries with exponential backoff. Minimal overhead.

- **Correctness: PASS (with notes)** -- The isRetry parameter correctly prevents retryCount reset during recursive retries. The recursive call audit(payload, true) is fire-and-forget (not awaited), which means calling code cannot await the retry result. This is acceptable for a UI hook (React re-renders pick up state changes) but should be documented. The useCallback with [] deps is safe (only captures refs and setState, which are stable). No infinite retry bug exists in the actual code.

## Recommendations

1. Fix TypeScript error on line 29 of useAudit.ts: change abortRef.current.signal to abortRef.current!.signal.
2. Update spec to document the isRetry parameter approach instead of the unconditional retryCount.current = 0 reset.
3. Update test-results.md to remove the false "Known Bug: Infinite Retry Loop" claim -- the bug only exists in the spec, not the implementation.
4. Fix misleading comment in useAudit.test.tsx line 195: "attempt 4 -- should not be reached" should say "attempt 4 -- triggers error path (retryCount 3 >= maxRetries 3)".

## Verdict

**VERDICT: BLOCK**

The npm run build command fails with a TypeScript strict-null error. The code cannot be compiled or shipped in its current state. The fix is a single-character change (abortRef.current!.signal). After the fix is applied, verify that npm run build, npm run test -- --run, and dotnet test SpecAudit.slnx all pass before shipping.
