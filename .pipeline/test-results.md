# Test Results
**Date:** 2026-06-02 14:31

## Backend Tests
- **Total:** 11
- **Passed:** 11
- **Failed:** 0

## Frontend Tests
- **Total:** 72
- **Passed:** 72
- **Failed:** 0

### Test file breakdown
| Test File | Tests | Status |
|-----------|-------|--------|
| `parseSSEChunks.test.ts` | 6 | ✅ |
| `parseSeverity.test.ts` | 6 | ✅ |
| `auditClient.test.ts` | 8 | ✅ |
| `useAudit.test.tsx` | 9 | ✅ |
| `useTheme.test.tsx` | 4 | ✅ |
| `useAutoScroll.test.tsx` | 4 | ✅ (NEW) |
| `Button.test.tsx` | 3 | ✅ |
| `ScrollButton.test.tsx` | 1 | ✅ (NEW) |
| `ThemeToggle.test.tsx` | 3 | ✅ |
| `InputPanel.test.tsx` | 15 | ✅ |
| `ResultPanel.test.tsx` | 8 | ✅ |
| `App.test.tsx` | 5 | ✅ |

### New tests

**useAutoScroll.test.tsx (4):**
- Scrolls to bottom when content changes and user is at bottom
- Does not scroll when user has scrolled up
- Shows scroll button when not at bottom and hides it after scrolling down
- Does not crash when scrollTo is unavailable

**ScrollButton.test.tsx (1):**
- Renders button with chevron and fires onClick

## Summary
**Verdict:** ALL PASS
- **Frontend:** 72/72 passed, 12 files
- **Backend:** 11/11 passed
- **Total:** 83/83 passed, 0 failed
