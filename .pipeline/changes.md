# Changes

## Fix: History stuck-as-pending bug

Three changes were made to ensure audit records that fail with an error are properly saved and displayed as "Failed" instead of remaining stuck in the "Running..." / pending state forever.

### Files changed

**`frontend/src/hooks/useHistory.ts`**
- Added `error?: string` field to the `HistoryRecord` interface so error messages can be stored alongside audit records.

**`frontend/src/App.tsx`**
- Updated the save-to-history `useEffect` (line 131) to also trigger when `state.status === 'error'`, not only when it's `'complete'`.
- When saving an errored record, the `error` field is populated with `state.error` (if present).
- Added `state.error` to the dependency array so the effect re-runs when the error message updates.

**`frontend/src/components/features/HistorySidebar.tsx`**
- Replaced the single `record.result === null` check with a three-way split in two places:
  1. **Badge next to the title**: now shows red "(failed)" when `record.error` is set, yellow "(pending)" when `record.result === null && !record.error`, and nothing for completed records.
  2. **Status line below the title**: now shows red "Failed" (with the error message as a tooltip) when `record.error` is set, yellow "Running..." when pending, and the relative timestamp when completed.

### Verification
- `npx tsc --noEmit` — 0 errors
- `npm run test` — all 282 tests pass across 19 test files

### Testing focus
- The tester should verify that when an audit errors, the history sidebar shows the record as "(failed)" with "Failed" text (and a tooltip with the error message).
- Verify that pending audits still show "(pending)" / "Running..." correctly.
- Verify that completed audits show the timestamp as before.
- Verify that the error record is persisted across page reloads (check `localStorage`).
