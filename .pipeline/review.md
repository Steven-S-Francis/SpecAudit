# Review: History records stuck on "(pending)" / "Running..." when audit fails

## VERDICT: SHIP

## Findings

All 6 verification requirements are met. The implementation is correct, secure, and well-structured.

### Checklist

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| 1 | `HistoryRecord` interface has `error?: string` | ✅ | `frontend/src/hooks/useHistory.ts` line 11 |
| 2 | Save effect fires on both `'complete'` and `'error'` | ✅ | `App.tsx` line 132: `state.status === 'complete' || state.status === 'error'` |
| 3 | On error, `state.error` saved as `error` field (not as result) | ✅ | `App.tsx` line 138: `error: state.status === 'error' ? (state.error ?? undefined) : undefined` |
| 4 | Sidebar shows red "Failed" for error records | ✅ | `HistorySidebar.tsx` lines 143-147 (badge) and 157-159 (subtitle), both `text-red-400` |
| 5 | Existing localStorage records without `error` handled gracefully | ✅ | `error?: string` is optional; load validation (lines 24-31) doesn't require it |
| 6 | No regressions — all 311 tests pass | ✅ | `test-results.md`: 282 frontend + 29 backend = 311 passing, TypeScript zero errors |

### Spec Conformance

The implementation faithfully addresses the root cause chain described in the spec:

1. **Fix 1** (`error?: string` on `HistoryRecord`): ✅ Added at line 11 of `useHistory.ts`.
2. **Fix 2** (save effect on error): ✅ The `useEffect` guard at line 132 checks both statuses; `state.error` is in the dependency array.
3. **Fix 3** (red "Failed" display): ✅ Three-way logic in both badge and status line.

**Minor cosmetic deviation (non-blocking):** The spec's Fix 3a shows `<span>Failed</span>` (no parentheses, capitalized), but the implementation uses `<span>(failed)</span>` (lowercase, with parentheses). This matches the existing `(pending)` convention and is consistent with `changes.md`. Functionally identical.

**Minor structural deviation (non-blocking):** The spec's Fix 2 shows two separate `if/else` branches for `'complete'` and `'error'` with `result: null` explicitly set on error. The implementation uses a single `addRecord` call with `result: state.result`. This is functionally equivalent because `state.result` is `null` when `state.status === 'error'`. No behavioral difference.

### Security Review — ✅ No issues

- No raw exception messages, stack traces, or internal details exposed to client.
- No new endpoints or routes — purely frontend React changes.
- No injection vectors: the `error` field is rendered as React text content (auto-escaped), and the `title` attribute on the "Failed" paragraph is set via JSX attribute (React escapes).
- No secrets, API keys, or credentials in source.

### Correctness Review — ✅ No issues

- **Async discipline**: All calls to `history.addRecord` are synchronous (not promises). No fire-and-forget concerns.
- **State race conditions**: The effect depends on `state.status`, `state.error`, and `currentAuditId` — all updated synchronously by the audit hook before the effect fires. The `addRecord` callback uses functional `setRecords` update to avoid stale closure issues.
- **Runtime type safety**: `state.error ?? undefined` properly converts `string | null` to `string | undefined`, matching the optional field semantics. No rogue `as` casts.
- **Error swallowing**: No empty catch blocks introduced. Existing catch blocks in `useHistory.ts` are justified (localStorage unavailability).
- **Edge case — `state.error` is `null`**: Handled via `?? undefined` — no spurious empty string stored.
- **Edge case — existing records without `error`**: Reads back as `undefined`, which is falsy, so they appear as pending or completed (correct).

### Code Quality Review — ✅ Clean

- No dead code introduced.
- No cross-platform issues (no line splitting, path separators, or regex changes).
- No performance concerns.
- Test quality: Existing test suite covers history CRUD, sidebar rendering, interaction, and persistence. The change is straightforward enough that the existing 282 frontend tests + existing test patterns provide adequate coverage.

### Backend Test Verification

Both frontend **and** backend test suites were run:
- Frontend: **282 tests** across **19 files** — ✅ Pass
- Backend: **29 tests** across **6 files** — ✅ Pass
- Total: **311 tests** — ✅ All passing
- TypeScript: `tsc --noEmit` — ✅ Zero errors

## Required Actions

None. This is ready to ship.

## Suggested Commit Message

```
fix: save history records with error state when audit fails

- Add `error?: string` to `HistoryRecord` interface
- Update save-to-history effect to fire on both 'complete' and 'error' status
- Show red "(failed)" badge and "Failed" text for error records in sidebar
- Handle null-to-undefined conversion for optional error field
- Gracefully handle legacy records without error field

All 311 tests pass (282 frontend + 29 backend), TypeScript zero errors.
```

## Sign Off

**Reviewer:** Senior Code Reviewer  
**Date:** 2026-06-04  
**Verdict:** SHIP
