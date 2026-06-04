# Fix 3 Review Issues — Session History Feature

Targeted fixes for the 3 issues flagged as **NEEDS WORK** in `.pipeline/review.md`.

---

## Issue 1: Missing absolute timestamp tooltip

**Description**: Record rows in the sidebar show a relative timestamp ("2 min ago") but have no `title` attribute, so no full date appears on hover.

**File to modify**: `frontend/src/components/features/HistorySidebar.tsx`

**Change**: Add `title={new Date(record.timestamp).toLocaleString()}` to the `<p>` element that renders the relative time (currently line 141-143).

**Before** (lines 141-143):
```tsx
<p className="text-xs text-slate-500 mt-0.5 light:text-slate-400">
  {relativeTime(record.timestamp)}
</p>
```

**After**:
```tsx
<p className="text-xs text-slate-500 mt-0.5 light:text-slate-400" title={new Date(record.timestamp).toLocaleString()}>
  {relativeTime(record.timestamp)}
</p>
```

**Edge cases**:
- `record.timestamp` is always a number (`Date.now()`) per the `HistoryRecord` type — no null/undefined guard needed.
- `toLocaleString()` uses the browser's default locale; no custom formatting required.

---

## Issue 2: No pending indicator for in-progress audits

**Description**: Records with `result === null` (audit still running or aborted) appear identical to completed records. Per the spec's edge-cases table, they should show a "pending" visual indicator.

**File to modify**: `frontend/src/components/features/HistorySidebar.tsx`

**Change**: In the record row's timestamp area (lines 141-143), conditionally render based on `record.result`:
- If `record.result === null`: show `"Running..."` instead of the relative time, plus a muted yellow `(pending)` label.
- If `record.result !== null`: keep existing behaviour (relative time).

**Before** (lines 141-143):
```tsx
<p className="text-xs text-slate-500 mt-0.5 light:text-slate-400">
  {relativeTime(record.timestamp)}
</p>
```

**After**:
```tsx
<p className="text-xs text-slate-500 mt-0.5 light:text-slate-400"
   title={record.result === null ? undefined : new Date(record.timestamp).toLocaleString()}>
  {record.result === null ? (
    <>
      <span className="text-yellow-500 dark:text-yellow-400">(pending)</span>
      {' '}Running...
    </>
  ) : (
    relativeTime(record.timestamp)
  )}
</p>
```

**Edge cases**:
- `record.result` can be `string | null` — check `=== null` exactly.
- When `result === null`, omit the `title` attribute (no absolute time to show). Using `undefined` in JSX omits the attribute.
- The `className` on the `<p>` remains unchanged for consistent styling.
- The `(pending)` label uses `text-yellow-500` (dark) / `text-yellow-400` (light) for a muted yellow that matches the existing colour palette.

---

## Issue 3: Backend test results not reported in test-results.md

**Description**: `.pipeline/test-results.md` only lists frontend tests (282 in 19 files). Backend tests (29 tests in 6 files) are omitted entirely.

**File to modify**: `.pipeline/test-results.md`

**Change**: Add a "Backend Tests" section after the existing "Frontend Tests" section noting that 29 backend tests pass unchanged. Since no backend files were modified (`git diff HEAD -- backend/` is empty), the backend results from the parent build are accepted without re-running. Alternatively, if `dotnet test` is run as part of the fix pipeline, report live results.

**After addition** (insert between line 18 and line 20):
```markdown
## Backend Tests
- Count: 29 tests in 6 files
- Status: ✅ Pass (no backend files changed — skipped, parent build results carried forward)
- Failures: None
```

**If `dotnet test` is actually run** (preferred), replace the `Status` note with:
```markdown
## Backend Tests
- Count: 29 tests in 6 files
- Status: ✅ Pass
- Failures: None
```

**Also update** the summary `Count` line (line 11) to reflect the total:
```
- Count: 311 tests across 25 files (282 frontend + 29 backend)
```

---

## Verification

1. **Issue 1**: Open the sidebar, hover over a timestamp → browser tooltip shows the full locale-formatted date (e.g. `6/4/2026, 7:46:30 PM`).
2. **Issue 2**:
   - Trigger an audit → before it completes, the sidebar record shows `(pending) Running...` with yellow text.
   - After completion, the record shows the relative time as before.
   - Load a record where `result === null` (e.g. from localStorage) → same pending indicator.
3. **Issue 3**: `.pipeline/test-results.md` includes a backend tests section with 29 passing tests.
4. **Regression**: `npm test` passes all existing frontend tests (12 hook + 8 sidebar + 5 App = 25 history tests, plus the rest of the 282 test suite).
5. **Build**: `npm run build` succeeds with zero errors.
6. **Lint**: No new TypeScript or ESLint warnings.
