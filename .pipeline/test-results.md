# Test Results
**Date:** Tue Jun 02 2026

## Backend Tests
- Total: 11
- Passed: 11
- Failed: 0

## Frontend Tests
- Total: 72
- Passed: 72
- Failed: 0

### Test file breakdown

| File | Tests | Status |
|------|-------|--------|
| `src/utils/__tests__/parseSSEChunks.test.ts` | 6 | ✅ |
| `src/utils/__tests__/parseSeverity.test.ts` | 6 | ✅ |
| `src/components/ui/__tests__/Button.test.tsx` | 3 | ✅ |
| `src/components/ui/__tests__/ThemeToggle.test.tsx` | 3 | ✅ |
| `src/components/ui/__tests__/ScrollButton.test.tsx` | 1 | ✅ |
| `src/api/__tests__/auditClient.test.ts` | 8 | ✅ |
| `src/hooks/__tests__/useAudit.test.tsx` | 9 | ✅ |
| `src/hooks/__tests__/useTheme.test.tsx` | 4 | ✅ |
| `src/hooks/__tests__/useAutoScroll.test.tsx` | 4 | ✅ |
| `src/components/features/__tests__/InputPanel.test.tsx` | 15 | ✅ |
| `src/components/features/__tests__/ResultPanel.test.tsx` | 8 | ✅ |
| `src/components/features/__tests__/App.test.tsx` | 5 | ✅ |

### New tests

**Auto-Scroll Results (5 new tests):**

- `src/hooks/__tests__/useAutoScroll.test.tsx` (4 tests):
  - ✅ scrolls to bottom when content changes and user is at bottom
  - ✅ does not scroll when user has scrolled up
  - ✅ shows scroll button when not at bottom and hides it after scrolling down
  - ✅ does not crash when scrollTo is unavailable

- `src/components/ui/__tests__/ScrollButton.test.tsx` (1 test):
  - ✅ renders button with chevron and fires onClick

## Summary
- Frontend: 72/72 passed, 12 files
- Backend: 11/11 passed
- Total: 83/83 passed, 0 failed

## Build
- Frontend `npm run build` (tsc + vite): ✅ Success (277 modules, 326ms)
