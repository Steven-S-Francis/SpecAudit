# Fix: History records stuck on "(pending)" / "Running..." when audit fails

## Problem

When an audit errors (API failure, network error, etc.), `state.status` becomes `'error'`. The save-to-history `useEffect` in `App.tsx` only fires when `state.status === 'complete'`, so the record is never updated after the initial creation with `result: null`. The sidebar shows "(pending)" and yellow "Running..." indefinitely — there's no way to distinguish a failed audit from one still in progress.

## Root cause chain

1. `handleSubmit` creates a `HistoryRecord` with `result: null`
2. The `useEffect` at line 131 of `App.tsx` guards on `state.status === 'complete'`
3. When `useAudit` catches an error, it sets `state.status = 'error'` and `state.error = error.message`
4. The effect doesn't fire, so the record is never updated
5. The sidebar renders "(pending)" and "Running..." whenever `record.result === null` — permanently

## Changes

---

### Fix 1: Add `error?: string` to `HistoryRecord`

**File:** `frontend/src/hooks/useHistory.ts`

Add the optional `error` field after `result`:

```ts
export interface HistoryRecord {
  id: string;
  timestamp: number;
  spec: string;
  specFormat: 'yaml' | 'json' | null;
  result: string | null;
  error?: string;          // <-- add this
  specName: string | null;
  title?: string;
}
```

**Edge cases:**
- Older persisted records in localStorage won't have `error` — it's optional and `undefined` reads back as `undefined`, which is the same as "not failed".
- `error` is never serialized for successful audits — it stays `undefined`.

---

### Fix 2: Update save effect to also fire on error

**File:** `frontend/src/App.tsx`

**Change the `useEffect` guard** (line 132) from a single status check to handling both `'complete'` and `'error'`:

```ts
// Save to history when audit completes or errors
useEffect(() => {
  if (currentAuditId) {
    if (state.status === 'complete') {
      history.addRecord({
        id: currentAuditId,
        spec,
        specFormat: specFormat ?? null,
        result: state.result,
        specName: null,
      });
    } else if (state.status === 'error') {
      history.addRecord({
        id: currentAuditId,
        spec,
        specFormat: specFormat ?? null,
        result: null,
        error: state.error ?? undefined,
        specName: null,
      });
    }
  }
}, [state.status, currentAuditId, spec, specFormat, state.result, state.error, history]);
```

**Add `state.error` to the dependency array.**

**Edge cases:**
- `state.error` is `string | null` in `AuditState`. The `HistoryRecord.error` is `string | undefined`. Convert `null` to `undefined` via `?? undefined` to match the optional field semantics.
- If `state.status === 'error'` but `state.error` is somehow `null`, the record's `error` field is `undefined` — no spurious empty string or "null" string stored.
- If the user submits a new audit while a previous failed record still exists, `handleSubmit` creates a new record with `result: null` and no `error` — the old failed record stays in the list with its error state.

---

### Fix 3: Show red "Failed" instead of yellow "Running..." when `record.error` is set

**File:** `frontend/src/components/features/HistorySidebar.tsx`

**3a.** Update the `(pending)` badge next to the title (around line 143):

```tsx
{record.result === null && !record.error && (
  <span className="text-yellow-400 text-xs ml-2">(pending)</span>
)}
{record.error && (
  <span className="text-red-400 text-xs ml-2">Failed</span>
)}
```

**3b.** Update the subtitle line that shows "Running..." (around line 155-163):

```tsx
{record.result === null && !record.error ? (
  <p className="text-xs text-yellow-400 mt-0.5">
    Running...
  </p>
) : record.error ? (
  <p className="text-xs text-red-400 mt-0.5">
    Failed
  </p>
) : (
  <p className="text-xs text-slate-500 mt-0.5 light:text-slate-400" title={new Date(record.timestamp).toLocaleString()}>
    {relativeTime(record.timestamp)}
  </p>
)}
```

**Edge cases:**
- Record with both `result` and `error` set → `result` takes precedence, shows timestamp (success). This shouldn't happen in practice, but defensive ordering means `record.result !== null` is checked first in the existing ternary.
- Record with neither `result` nor `error` → shows "(pending)" badge + "Running..." (existing behavior for audits in progress).
- Record with `error` set and `result` null → shows "Failed" badge + "Failed" subtitle in red.
- The `title` attribute on the timestamp line isn't relevant for failed records — we show "Failed" instead.

## Verification

1. Trigger an audit that will fail (e.g., submit invalid spec, disconnect network mid-stream)
2. Observe the history sidebar:
   - The record should show a red "Failed" badge and red "Failed" text
   - It should NOT show yellow "(pending)" or "Running..."
3. Submit a valid audit:
   - New record shows "(pending)" briefly then the result preview + timestamp (unchanged behavior)
4. Reload the page:
   - Failed records persist with their error state from localStorage
5. Build: `npm run build` — 0 errors
