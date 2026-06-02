# SpecAudit — Test Results

## Summary

| Suite | Status | Tests |
|-------|--------|-------|
| Frontend (vitest) | ✅ ALL PASS | 63 passed (10 files) |
| Build (`tsc -b && vite build`) | ✅ ZERO ERRORS | — |
| Backend (dotnet test) | ✅ ALL PASS | 11 passed |

---

## Frontend Tests (63/63)

| File | Tests | Status |
|------|-------|--------|
| `src/api/__tests__/auditClient.test.ts` | 6 | ✅ |
| `src/utils/__tests__/parseSSEChunks.test.ts` | 6 | ✅ |
| `src/utils/__tests__/parseSeverity.test.ts` | 6 | ✅ |
| `src/hooks/__tests__/useAudit.test.tsx` | 7 | ✅ |
| `src/hooks/__tests__/useTheme.test.tsx` | 4 | ✅ (new) |
| `src/components/ui/__tests__/Button.test.tsx` | 3 | ✅ |
| `src/components/ui/__tests__/ThemeToggle.test.tsx` | 3 | ✅ (new) |
| `src/components/features/__tests__/InputPanel.test.tsx` | 15 | ✅ |
| `src/components/features/__tests__/ResultPanel.test.tsx` | 8 | ✅ |
| `src/components/features/__tests__/App.test.tsx` | 5 | ✅ (1 new) |

## New Tests Written

### `frontend/src/hooks/__tests__/useTheme.test.tsx` (4 tests)

| Test | Verifies |
|------|----------|
| `defaults to dark theme` | `theme` is `'dark'` on initial render |
| `toggle switches to light and back` | Toggling flips from dark → light → dark |
| `persists to localStorage` | `localStorage.getItem('specaudit-theme') === 'light'` after toggle |
| `applies light class to html element` | `document.documentElement` has `.light` class when theme is light, absent when dark |

### `frontend/src/components/ui/__tests__/ThemeToggle.test.tsx` (3 tests)

| Test | Verifies |
|------|----------|
| `renders sun icon in dark mode` | SVG with `<circle>` element when `theme="dark"` |
| `renders moon icon in light mode` | SVG with crescent `<path>` when `theme="light"` |
| `calls onToggle on click` | `fireEvent.click` triggers `onToggle` callback |

### `frontend/src/components/features/__tests__/App.test.tsx` (+1 test)

| Test | Verifies |
|------|----------|
| `renders theme toggle button in header` | Button with `aria-label` containing "Switch to" is present |

---

## Backend Tests (11/11)

| File | Tests | Status |
|------|-------|--------|
| `UserMessageBuilderTests.cs` | 3 | ✅ |
| `EndpointValidationTests.cs` | 6 | ✅ |
| `AiOptionsValidationTests.cs` | 2 | ✅ |
