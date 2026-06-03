# Changes: Severity Filter

## Files changed

| Action | Path |
|--------|------|
| **CREATE** | `frontend/src/utils/filterMarkdown.ts` |
| **CREATE** | `frontend/src/utils/__tests__/filterMarkdown.test.ts` |
| **MODIFY** | `frontend/src/components/features/ResultPanel.tsx` |
| **MODIFY** | `frontend/src/components/features/__tests__/ResultPanel.test.tsx` |

## What each change does

### `frontend/src/utils/filterMarkdown.ts` (NEW)
- Pure utility function `filterMarkdownBySeverity(content, hiddenSeverities)` that removes finding blocks (`### [SEVERITY]`) whose severity is in the hidden set
- Helper `extractSeverityFromBlock` checks if a block starts with `### [CRITICAL]`, `### [WARNING]`, or `### [INFO]` using regex
- Non-finding blocks (Summary, Governance Score, plain headings) always pass through
- Edge cases handled: empty content, partial streaming, no separators, block order preserved

### `frontend/src/utils/__tests__/filterMarkdown.test.ts` (NEW)
- 13 tests covering all specified scenarios:
  - All severities visible → full content unchanged
  - Each severity type filtered individually
  - Multiple severities filtered simultaneously
  - Non-finding sections preserved when all severities hidden
  - Plain h3 headings without severity pass through
  - Empty content returns empty
  - Content with no findings unchanged
  - Single finding hidden → empty
  - Malformed/partial severity header passes through
  - Block order preserved
  - Non-finding separator (`---` in Governance Score) preserved

### `frontend/src/components/features/ResultPanel.tsx` (MODIFY)
- Added imports: `useState`, `useCallback` from React; `filterMarkdownBySeverity` from new utility
- Added internal filter state: `Record<SeverityLevel, boolean>` defaulting all to `true`
- Added `toggleSeverity` callback using `useCallback`
- Computes `hiddenSeverities` Set and `filteredContent` via `filterMarkdownBySeverity`
- Renders three toggle buttons (CRITICAL, WARNING, INFO) in a flex row above the markdown content
  - Active buttons use `SEVERITY_STYLES[severity].badge` classes (same as severity badges)
  - Inactive buttons are muted with `text-slate-500 border-slate-600 opacity-50`
- Replaced `{content}` with `{filteredContent}` in ReactMarkdown children
- No changes to Props interface, skeleton, streaming cursor, scroll button, or severity badge rendering
- Filter buttons only render when `content` is non-empty

### `frontend/src/components/features/__tests__/ResultPanel.test.tsx` (MODIFY)
- Added `fireEvent` and `within` imports from `@testing-library/react`
- Fixed existing badge tests (lines 36-65) to scope queries within `.font-mono` container (since toggle buttons now also render severity text)
- Fixed "plain H3 without severity" test to scope severity badge checks within markdown area
- Added 10 new tests for severity filter:
  - Three toggle buttons render when content is present
  - No toggle buttons when content is empty
  - Clicking CRITICAL/WARNING/INFO toggle hides respective findings
  - Clicking toggle again re-shows findings
  - Non-finding content (Governance Score) unaffected by filter
  - Filter works during streaming (streaming cursor still present)

### Fix: TypeScript TS2345 errors in `querySelector` calls

- **File**: `frontend/src/components/features/__tests__/ResultPanel.test.tsx`
- **What**: Changed 4 occurrences of `container.querySelector('.font-mono')` to `container.querySelector<HTMLElement>('.font-mono')` to resolve TS2345 errors
- **Why**: `querySelector` returns `Element | null` by default, but `within()` from `@testing-library/react` expects `HTMLElement`. The generic type parameter narrows the return type.
- **Lines affected**: 40, 52, 63, 76 (declarations); lines 77-79 used `markdownArea!` which was fine once the source type was correct)
- **Verification**: `npx tsc --noEmit` (zero errors), `npx tsc -b` (build passes), `npx vitest run` (198/198 tests pass)

## Tester focus

- `npx tsc --noEmit` — zero errors ✅
- `npm test -- --run` — all 198 tests pass (15 files) ✅
- Verify CRITICAL toggle hides CRITICAL findings in UI
- Verify WARNING toggle hides WARNING findings
- Verify INFO toggle hides INFO findings
- Verify toggling back on re-shows findings
- Verify Governance Score and Summary remain visible when all severities hidden
- Verify toggle buttons adopt severity badge colors when active, gray when inactive
- Verify no toggle buttons appear in empty/skeleton state
- Verify streaming cursor still renders when `isStreaming={true}`
