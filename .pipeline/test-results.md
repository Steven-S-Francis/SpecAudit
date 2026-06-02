# Test Results
**Date:** 2026-06-02 13:16

## Backend Tests
- **Total:** 11
- **Passed:** 11
- **Failed:** 0

## Frontend Tests
- **Total:** 67
- **Passed:** 67
- **Failed:** 0

### Test file breakdown
| Test File | Tests | Status |
|-----------|-------|--------|
| `parseSSEChunks.test.ts` | 6 | ✅ |
| `parseSeverity.test.ts` | 6 | ✅ |
| `auditClient.test.ts` | 8 | ✅ (2 new) |
| `useAudit.test.tsx` | 9 | ✅ (2 new) |
| `useTheme.test.tsx` | 4 | ✅ |
| `Button.test.tsx` | 3 | ✅ |
| `ThemeToggle.test.tsx` | 3 | ✅ |
| `InputPanel.test.tsx` | 15 | ✅ |
| `ResultPanel.test.tsx` | 8 | ✅ |
| `App.test.tsx` | 5 | ✅ |

### New tests

**auditClient.test.ts (2 new):**
- Rate-limit sentinel throws with name `RateLimitError`
- Non-rate-limit sentinel throws with name `Error`

**useAudit.test.ts (2 new):**
- Retries and succeeds after RateLimitError (with backoff)
- Shows error after RateLimitError retries are exhausted

## Summary
**Verdict:** ALL PASS
- **Frontend:** 67/67 passed, 10 files
- **Backend:** 11/11 passed
- **Total:** 78/78 passed, 0 failed
