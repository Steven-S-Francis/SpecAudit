# Fix: Scroll Button Inside Result Container

## Open Questions
None.

## Overview

Correct a previous misconception: the scroll button should live **inside** the audit result scroll container (as originally designed), not fixed at the viewport bottom. This restores the original architecture while keeping the up/down toggle improvement from the previous round.

---

## Changes

### `frontend/src/components/features/ResultPanel.tsx`
- Re-add `useAutoScroll` import and hook call (was incorrectly moved to `App.tsx`)
- Remove `containerRef` prop — container ref is owned internally again
- Re-add `ScrollButton` import and render inside the scroll container div with `absolute bottom-3 right-3` positioning
- `ScrollButton` uses `direction` prop from `isAtBottom` state:
  - `isAtBottom === true`: `direction="up"`, `onClick={scrollToTop}`
  - `isAtBottom === false`: `direction="down"`, `onClick={scrollToBottom}`

### `frontend/src/App.tsx`
- Remove `useAutoScroll` import
- Remove `ScrollButton` import
- Remove `const { containerRef, isAtBottom, scrollToBottom, scrollToTop } = useAutoScroll(...)` hook call
- Remove `containerRef={containerRef}` from `<ResultPanel>` usage
- Remove the `{state.result && (<div className="fixed bottom-6 right-6 z-50"><ScrollButton>...</ScrollButton></div>)}` block

### `frontend/src/components/features/__tests__/ResultPanel.test.tsx`
- Remove `dummyRef` variable
- Remove `containerRef={dummyRef}` from all `<ResultPanel>` render calls

### Unchanged, already correct
- `frontend/src/hooks/useAutoScroll.ts` — returns `isAtBottom`, `scrollToTop`, `scrollToBottom`
- `frontend/src/components/ui/ScrollButton.tsx` — accepts `direction` prop (`up`/`down`)
- `frontend/src/components/ui/Button.tsx` — has `inline-flex items-center gap-1` base classes
- `frontend/src/hooks/__tests__/useAutoScroll.test.tsx` — tests for `isAtBottom`/`scrollToTop`
- `frontend/src/components/ui/__tests__/ScrollButton.test.tsx` — tests for both directions

---

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/components/features/ResultPanel.tsx` | Re-add `useAutoScroll` + `ScrollButton` inside container; remove `containerRef` prop |
| `frontend/src/App.tsx` | Remove `useAutoScroll`, `ScrollButton`, hook call, and fixed ScrollButton render |
| `frontend/src/components/features/__tests__/ResultPanel.test.tsx` | Remove `containerRef` prop from all renders |
