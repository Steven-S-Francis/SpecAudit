# Remove RateLimitError retry logic from `useAudit`

## Files to modify

| File | Action |
|---|---|
| `frontend/src/hooks/useAudit.ts` | Edit |
| `frontend/src/hooks/__tests__/useAudit.test.tsx` | Edit — remove two retry tests, keep all other tests |

## Changes to `frontend/src/hooks/useAudit.ts`

### 1. Remove `maxRetries` constant (line 17)

Delete the line:
```typescript
const maxRetries = 3;
```

### 2. Flatten the `catch` block (lines 41-62)

**Before:**
```typescript
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setState(s => ({ ...s, status: 'idle' }));
        retryCount.current = 0;
      } else if (
        (err as Error).name === 'RateLimitError' &&
        retryCount.current < maxRetries
      ) {
        retryCount.current++;
        setState({ status: 'loading', result: '', findings: [], summary: null, error: null, specFormat: payload.specFormat ?? null });
        const delay = 1000 * Math.pow(2, retryCount.current - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        await audit(payload, true);
      } else {
        retryCount.current = 0;
        setState(s => ({
          ...s,
          status: 'error',
          error: (err as Error).message,
        }));
      }
    }
```

**After:**
```typescript
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setState(s => ({ ...s, status: 'idle' }));
        retryCount.current = 0;
      } else {
        retryCount.current = 0;
        setState(s => ({
          ...s,
          status: 'error',
          error: (err as Error).message,
        }));
      }
    }
```

All non-`AbortError` errors (including `RateLimitError`, network errors, server errors, etc.) now immediately set `status: 'error'` with the error message.

### 3. Remove unused `retryCount` reset calls (already done in the "after" above)

The `retryCount.current = 0` in the `else` branch is preserved. The `catch` block no longer increments `retryCount`.

## Changes to `frontend/src/hooks/__tests__/useAudit.test.tsx`

Delete these two test cases (lines 154-228):

1. **`'retries and succeeds after RateLimitError'`** (lines 154-188)
2. **`'shows error after RateLimitError retries are exhausted'`** (lines 190-228)

Keep all other tests intact:

| Test | Keep? |
|---|---|
| `returns initial state with idle status` | ✓ |
| `sets loading then streaming when audit is called` | ✓ |
| `sets status to complete after auditStream resolves` | ✓ |
| `sets error status when auditStream throws` | ✓ |
| `sets idle status on AbortError` | ✓ |
| `abort cancels the ongoing audit and sets idle` | ✓ |
| `reset clears result and sets idle` | ✓ |
| `onStructured callback updates findings and summary in state` | ✓ |

The existing test `'sets error status when auditStream throws'` already covers the new behavior for `RateLimitError` — it mocks a generic `Error` rejection and asserts `status: 'error'` / correct error message. That same path now handles `RateLimitError` too.

## Edge cases

- **`AbortError`**: Still handled separately — resets state to `idle`, no error shown. Unchanged.
- **`RateLimitError`**: Now falls through to the `else` branch, immediately showing `status: 'error'` with the message. No retries.
- **Other errors (network, 500, generic `Error`)**: Same behavior as before — immediate error state.
- **`retryCount.current`**: Is still reset to `0` in both error paths (idle and error). The ref is no longer incremented anywhere.

## Verification

1. `npm run build` — 0 errors
2. `npm test` — all tests pass (the two removed retry tests, the `maxRetries` constant, and the retry code path no longer exist)
3. Manual: send `{"spec":"sss"}` → gets 429 → error shown immediately with no retries
