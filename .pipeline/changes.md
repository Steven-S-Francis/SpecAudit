# Changes Summary — Export Audit Result as JSON

## Files Modified

### 1. `frontend/src/types/audit.ts`
- Added `specFormat: string | null` field to the `AuditState` interface (stores the spec format from the audit request, or `null` for auto-detect)
- Added new `AuditResult` export interface with fields: `version: 1`, `result: string`, `exportedAt: string`, `specFormat: string | null`

### 2. `frontend/src/hooks/useAudit.ts`
- Initial state now includes `specFormat: null`
- When audit starts (initial call, not retry): stores `payload.specFormat ?? null` in state
- On rate-limit retry: stores `payload.specFormat ?? null` (preserves format across retries)
- On `reset()`: resets `specFormat` to `null`

### 3. `frontend/src/App.tsx`
- Imported `AuditResult` type from `./types/audit`
- Added `handleExportJson` callback using the same Blob + temp `<a>` pattern as `handleDownload`:
  - Builds `AuditResult` object with `version: 1`, `state.result`, `new Date().toISOString()`, `state.specFormat`
  - Serializes with `JSON.stringify(auditResult, null, 2)`
  - Creates Blob with `type: 'application/json;charset=utf-8'`
  - Downloads as `specaudit-report-<timestamp>.json`
  - Wrapped in try/catch for safety
  - Dependencies: `state.result`, `state.specFormat`
- Added `Export JSON` button with braces `{ }` SVG icon immediately after the Export PDF button
  - Same `disabled` logic (`state.status === 'streaming'`)
  - Only rendered when `state.result` is truthy (same wrapper pattern)

### 4. `frontend/src/components/features/__tests__/App.test.tsx`
- Added import for `AuditResult` type
- Added shared test helpers: `SAMPLE_MARKDOWN` constant and `createTestResult()` factory function
- Added new `describe('App Export JSON Button', ...)` block with 16 tests:
  - Tests 1-3: Button visibility (hidden when empty, shown with content, disabled when streaming) — rendered via React Testing Library
  - Tests 4-5: Full download flow (correct JSON envelope, correct filename `.json` extension) — with Blob content parsing and DOM anchor verification
  - Tests 6-16: Pure unit tests for the `AuditResult` type and JSON serialization (field presence, ISO-8601 validation, null/yaml specFormat, JSON round-trip, pretty-print, Blob type, unicode handling, empty result)

### 5. `frontend/src/hooks/__tests__/useAudit.test.tsx`
- Updated two state equality assertions to include `specFormat: null` (initial state and reset state)

## Tester Focus Areas

1. **Button placement**: Export JSON button appears right after Export PDF, inside the same conditional fragment (`{state.result && ...}`)
2. **Disabled state**: All action buttons (Copy, Download, Export PDF, Export JSON) share the same `state.status === 'streaming'` disabled condition
3. **Filename pattern**: Uses `specaudit-report-<timestamp>.json` matching the existing `.md` / `.pdf` convention
4. **Error handling**: Try/catch block catches any Blob/URL API failures (same pattern as `handleDownload`)
5. **specFormat propagation**: Set once via `payload.specFormat ?? null` in the non-retry branch, preserved through retries, reset on new audit
6. **Build verification**: `npx tsc --noEmit` (zero errors), `npm test -- --run` (163 passed, 14 files), `npm run build` (succeeds)

## Deviations from Spec

- **Test file location**: The spec said to create `frontend/src/App.test.tsx` (new), but an existing App test file already exists at `frontend/src/components/features/__tests__/App.test.tsx`. Per user decision, the new tests were added to the existing file instead.
- **`vi.restoreAllMocks()`**: Used in the Export JSON describe block's `beforeEach` instead of `vi.clearAllMocks()` to properly clean up spies from prior test blocks (prevents `document.createElement` spy interference causing "Maximum call stack size exceeded").
- **Additional test**: Test 5 (filename validation) was enhanced to also verify `URL.createObjectURL` was called, since the unused variable caused a TypeScript `noUnusedLocals` error during `tsc -b`.
