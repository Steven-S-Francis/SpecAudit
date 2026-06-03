# Changes: Keyboard Shortcuts Feature

## Files Modified

### 1. `frontend/src/components/features/InputPanel.tsx`
- Added `handleKeyDown` function before the return statement that intercepts `Ctrl+Enter` / `Cmd+Enter` on the textarea
- The handler checks: input is non-empty, not over limit, status is not `loading` or `streaming` — matching the conditions when the Run Audit button is enabled
- Added `onKeyDown={handleKeyDown}` prop to the `<textarea>` element
- Added `title="Ctrl+Enter to run audit"` to the Run Audit button for hover tooltip
- Added `<kbd className="ml-1.5 text-xs opacity-60 hidden sm:inline">Ctrl+Enter</kbd>` inside the Run Audit button content
- Added `title="Escape to stop"` to the Stop button for hover tooltip
- Added `<kbd className="ml-1.5 text-xs opacity-60 hidden sm:inline">Esc</kbd>` inside the Stop button content

### 2. `frontend/src/App.tsx`
- Added a new `useEffect` block (after the existing provider name fetch effect, around line 94) that registers a global `window` `keydown` event listener
- The handler checks `e.key === 'Escape' && state.status === 'streaming'`, then calls `e.preventDefault()` and `abort()`
- Cleanup function removes the event listener on unmount
- Dependencies: `[state.status, abort]` — `state.status` keeps the closure fresh with latest streaming state; `abort` is stable from `useCallback`

### 3. `frontend/src/components/features/__tests__/InputPanel.test.tsx`
Added 9 new test cases (total: 16 → 25):
- `Ctrl+Enter with valid input calls onSubmit`
- `Cmd+Enter with valid input calls onSubmit`
- `Enter alone does NOT call onSubmit`
- `Ctrl+Enter when input is empty does nothing`
- `Ctrl+Enter when status is loading does nothing`
- `Ctrl+Enter when status is streaming does nothing`
- `Ctrl+Enter when input exceeds limit does nothing`
- `Ctrl+Enter hint kbd renders on Run Audit button`
- `Escape hint kbd renders on Stop button`

### 4. `frontend/src/components/features/__tests__/App.test.tsx`
Added new `describe('App Keyboard Shortcuts', ...)` block with 4 test cases (total: 37 → 41):
- `Escape during streaming calls abort`
- `Escape when idle does nothing`
- `Non-Escape keys ignored during streaming`
- `Escape in textarea during streaming calls abort`

## Test Results

- **TypeScript**: `npx tsc --noEmit` — passes with no errors
- **Tests**: `npx vitest run` — **245 tests, 17 files, all passing** (existing tests unaffected)
- New InputPanel tests: 9
- New App tests: 4

---

## Fix: Add `title` prop to Button component

**Problem:** Docker build failed because `InputPanel.tsx` passes `title="..."` to `<Button>`, but `Button.tsx` didn't accept a `title` prop.

**Solution:** Modified `frontend/src/components/ui/Button.tsx`:
1. Added `title?: string` to the `Props` type definition (line 9)
2. Destructured `title` from props (line 23)
3. Passed `title={title}` to the underlying `<button>` element (line 28)

**Verification:**
- `npx tsc --noEmit` — passes with zero errors
- `npx vitest run` — all 245 tests pass

## Tester Focus Areas

1. **Ctrl+Enter / Cmd+Enter on textarea**: Verify it triggers `onSubmit` with same conditions as clicking "Run Audit". Verify Enter alone still inserts newlines.
2. **Escape global listener**: Verify Escape calls `abort()` only during streaming. Verify non-Escape keys are ignored. Verify cleanup on unmount.
3. **Button hints**: Check `<kbd>` elements render inside both buttons with correct text. Check `title` attributes are present.
4. **Visual on mobile**: `hidden sm:inline` on the `<kbd>` elements — should be hidden on narrow screens.
