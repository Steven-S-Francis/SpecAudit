# Test Results
**Date:** 2026-06-02 11:31

## Backend Tests
- **Total:** 11
- **Passed:** 11
- **Failed:** 0

### Test file breakdown
| Test File | Tests | Status |
|-----------|-------|--------|
| `UserMessageBuilderTests.cs` | 3 | ✅ All passed |
| `EndpointValidationTests.cs` | 6 | ✅ All passed |
| `AiOptionsValidationTests.cs` | 2 | ✅ All passed |

## Frontend Tests
- **Total:** 55
- **Passed:** 55
- **Failed:** 0

### Test file breakdown
| Test File | Tests | Status |
|-----------|-------|--------|
| `parseSSEChunks.test.ts` | 6 | ✅ All passed |
| `parseSeverity.test.ts` | 6 | ✅ All passed |
| `auditClient.test.ts` | 6 | ✅ All passed |
| `useAudit.test.tsx` | 7 | ✅ All passed |
| `InputPanel.test.tsx` | 15 | ✅ All passed |
| `ResultPanel.test.tsx` | 8 | ✅ All passed |
| `Button.test.tsx` | **3** | ✅ New — all passed |
| `App.test.tsx` | **4** | ✅ New — all passed |

### New tests for this feature

**`Button.test.tsx` (3 tests):**
- Default `size="md"` produces correct classes
- `size="sm"` produces correct classes
- Custom `className` merges with base classes

**`App.test.tsx` (4 tests):**
- Copy button hidden when result is empty
- Copy button visible when result has content
- Copy button disabled during streaming
- Click copies content and shows "Copied!" feedback

## Summary
**Verdict:** ALL PASS

- **Backend:** 11/11 passed
- **Frontend:** 55/55 passed (7 new tests: 3 for Button size prop, 4 for App copy button)
- **Total:** 66/66 passed, 0 failed
