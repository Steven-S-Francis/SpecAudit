# Fix: Scroll Button Overlap — Use `sticky` Instead of `absolute`

## Open Questions
None.

## Problem

The scroll button wrapper uses `absolute bottom-3 right-3` inside a `relative` scroll container. This pins the button to the bottom of the scroll container's *content box*, so when the user scrolls down, the button scrolls up with the content and overlaps it instead of staying visible at the bottom of the *viewport*.

## Fix

Replace the wrapper's `absolute` with `sticky` so the button stays visible at the bottom-right of the visible viewport of the scroll container.

---

## Changes

### `frontend/src/components/features/ResultPanel.tsx` (line 108)

Change the wrapper div classes from `absolute bottom-3 right-3` to:

```
sticky bottom-3 z-10 flex justify-end pr-3 pointer-events-none
```

- `sticky bottom-3` — sticks to bottom of scroll viewport
- `z-10` — renders above scrolled content when stuck
- `flex justify-end` — pushes child button to right edge
- `pr-3` — 12px right padding (matches previous `right-3` offset)
- `pointer-events-none` — allows click-through on wrapper area so content underneath remains interactive

### `frontend/src/components/ui/ScrollButton.tsx` (line 10)

Add `pointer-events-auto` to the button's className to re-enable clicking on the button itself (overriding `pointer-events-none` from parent wrapper).

---

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/components/features/ResultPanel.tsx` | Change `absolute bottom-3 right-3` → `sticky bottom-3 z-10 flex justify-end pr-3 pointer-events-none` |
| `frontend/src/components/ui/ScrollButton.tsx` | Add `pointer-events-auto` to button className |

## Edge Cases

| Scenario | Expected |
|----------|----------|
| No content | Button not rendered (existing guard already correct) |
| Short content (no scroll) | Button sticks at bottom-right of viewport |
| Long content (scrolled) | Button floats at bottom-right of visible viewport |
| Scrolled to very bottom | Button sits at natural in-flow position after content |
| Click-through | Wrapper is `pointer-events-none`, button is `pointer-events-auto` — clicks pass through wrapper to content, button clicks still work |
