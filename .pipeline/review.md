# Review: 5 UX Fixes — Session History Sidebar

## VERDICT: SHIP

## Checklist

| # | Fix | Status | Evidence |
|---|-----|--------|----------|
| 1 | Title extraction | ✅ | `HistoryRecord` has `title?: string` (`useHistory.ts:10`); `extractSpecTitle` parses JSON, extracts `info.title` (`useHistory.ts:67-77`); `addRecord` auto-populates via `record.title ?? extractSpecTitle(record.spec) ?? undefined` (`useHistory.ts:102`); `formatSpecPreview` prefers `record.title`, falls back to `specName`, then raw spec; returns `{ primary, subtitle }` object (`HistorySidebar.tsx:33-53`); JSX renders subtitle conditionally via IIFE (`HistorySidebar.tsx:137-154`) |
| 2 | Close button overlap | ✅ | Old `fixed top-4 left-4 z-50` toggle button completely removed; Close (X) button is first child of sidebar header div, before "History" `<h2>` (`HistorySidebar.tsx:100-112`); X button calls `onToggle`; Backdrop calls `onClose?.()` (`HistorySidebar.tsx:75`); Escape handler calls `onClose?.()` (`HistorySidebar.tsx:58`) |
| 3 | Sidebar width | ✅ | `w-72` replaced with `w-80 md:w-96` (`HistorySidebar.tsx:83`) — 320px mobile, 384px desktop |
| 4 | Toggle overlaps title | ✅ | `sidebarOpen` state lifted to `App.tsx:25` (`const [sidebarOpen, setSidebarOpen] = useState(true)`); Hamburger button in page header left of "SpecAudit" title (`App.tsx:169-180`); `open`, `onToggle`, `onClose` props passed to `<HistorySidebar>` (`App.tsx:161-163`); No `fixed` toggle remains in sidebar; Backdrop and Escape both call `onClose?.()` |
| 5 | Spec replacement | ✅ | `loadKeyRef` (`useRef(0)`) declared (`App.tsx:26`); `loadKeyRef.current += 1` in `handleLoadRecord` (`App.tsx:111`); `key={loadKeyRef.current}` on `<InputPanel>` (`App.tsx:199`); `useRef` imported (`App.tsx:1`) |

## Findings

### Spec Conformance
All 5 fixes are implemented exactly as specified. The four code files listed in the spec (`useHistory.ts`, `HistorySidebar.tsx`, `App.tsx`, `HistorySidebar.test.tsx`) account for all production code changes. The pipeline meta-files (`changes.md`, `spec.md`, `test-results.md`) were updated for documentation and test-result tracking, which is expected.

### Security
No security issues found:
- No information disclosure (catch blocks either silent or sanitized; no raw exception messages forwarded)
- No missing authentication/authorization (no new endpoints; all client-side)
- Unvalidated external input: `JSON.parse` results in `extractSpecTitle` have proper runtime type guards (`typeof parsed === 'object'`, `typeof parsed.info?.title === 'string'`)
- No injection vectors (no HTML/SQL/shell interpolation)
- No secrets exposure

### Correctness
No correctness issues found:
- Async discipline: `useCallback` dependency arrays are correct; no fire-and-forget issues
- State race conditions: `loadKeyRef.current` is a ref mutation inside synchronous click handler — no race possible
- Runtime type safety: `JSON.parse` in `extractSpecTitle` uses runtime type checking before accessing `info.title`
- No empty catch blocks that silently swallow critical errors (catches in `extractSpecTitle`, `loadRecords`, `saveRecords` all have appropriate handling)

### Code Quality (non-blocking)
- Tests were updated to reflect the new prop interface (`open`, `onToggle`, `onClose`) and verify new behavior
- Tests check both happy paths and behavioral changes (close button calls `onToggle`, Escape calls `onClose`)
- No dead code, cross-platform issues, or performance concerns in the changed files

### Backend Tests
Both frontend (282 tests, 19 files) and backend (29 tests, 6 files) are reported in `test-results.md` — total 311 tests, all passing.

## Suggested Commit Message

```
feat: 5 UX fixes for Session History sidebar

- Extract OpenAPI info.title from JSON specs for better spec preview
- Move close (X) button inside sidebar header to prevent overlap
- Widen sidebar from w-72 (288px) to w-80 md:w-96 (320/384px)
- Lift sidebar open state to App.tsx; add hamburger to page header
- Force InputPanel remount via key on each history record load
```

## Sign Off

All 5 fixes verified against spec. All 311 tests pass (282 frontend + 29 backend). No security or correctness issues. **Ship it.**
