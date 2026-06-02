# Auto-Scroll Results

## Open Questions
None.

## Overview

When an audit streams its result, the page should auto-scroll to keep the latest content visible. If the user scrolls up to read earlier content, auto-scrolling pauses. A "Scroll to bottom" button appears when auto-scroll is paused; clicking it re-enables auto-scroll and scrolls to bottom.

## Implementation Plan

### 1. New hook: `useAutoScroll` — `frontend/src/hooks/useAutoScroll.ts`

A custom hook that manages auto-scroll state for a scrollable container.

**Signature:**
```ts
function useAutoScroll(options: {
  deps: unknown[];      // when these change, auto-scroll triggers if at bottom
  threshold?: number;   // px from bottom to consider "at bottom" (default 50)
}): {
  containerRef: React.RefObject<HTMLDivElement | null>;
  showScrollButton: boolean;
  scrollToBottom: () => void;
}
```

**Behavior:**
1. Creates an internal `containerRef` for the consumer to attach to a scrollable `<div>`.
2. In a `useEffect`, binds a passive `scroll` event listener to the container. On each scroll, checks `scrollHeight - scrollTop - clientHeight < threshold` to determine if user is at bottom. Updates `showScrollButton` state (`true` = user is NOT at bottom).
3. On every change in `deps`, if currently at bottom, calls `scrollToBottom()` to keep content snapped to bottom.
4. `scrollToBottom()` scrolls the container to `scrollHeight` with `behavior: 'smooth'`, sets internal `isAtBottom` ref to `true`, sets `showScrollButton` to `false`.

**Pattern:** Follows existing hook conventions in `useAudit.ts` and `useTheme.ts`.

### 2. New component: `ScrollButton` — `frontend/src/components/ui/ScrollButton.tsx`

A small floating "Scroll to bottom" chevron button.

**Props:**
```ts
interface ScrollButtonProps {
  onClick: () => void;
}
```

**Appearance:**
- Absolute-positioned at bottom-right of the scroll container (`absolute bottom-3 right-3`).
- `bg-slate-700 hover:bg-slate-600 light:bg-slate-300 light:hover:bg-slate-400` background.
- `text-slate-200 light:text-slate-700` chevron-down SVG icon.
- `rounded-full p-2 shadow-lg w-8 h-8`.
- `transition-opacity duration-200` — parent conditionally renders or uses `opacity` classes.
- Rendered only when `showScrollButton` is true (conditional render, no fade-out state needed).

### 3. Modify `ResultPanel` — `frontend/src/components/features/ResultPanel.tsx`

**Changes:**
1. Import `useAutoScroll` and `ScrollButton`.
2. Call `useAutoScroll({ deps: [content] })`.
3. Wrap the entire output in a scrollable container div with `ref={containerRef}`.
4. Container classes: `relative w-full mt-6 max-h-[60vh] overflow-y-auto rounded-lg`.
5. Inside the container, render either:
   - Skeleton pulsing bars (when no content and not streaming), OR
   - Markdown content + streaming cursor + optional `ScrollButton`
6. `ScrollButton` is rendered below the markdown content, inside the scroll container, positioned absolutely.

**Structure:**
```tsx
const { containerRef, showScrollButton, scrollToBottom } = useAutoScroll({ deps: [content] });

return (
  <div ref={containerRef} className="relative w-full mt-6 max-h-[60vh] overflow-y-auto rounded-lg">
    {content === '' && !isStreaming ? (
      <>
        {/* pulsing skeleton bars — no outer wrapper, scroll container provides it */}
        <div className="bg-slate-800 animate-pulse rounded h-4 mb-3 w-full light:bg-slate-200" />
        <div className="bg-slate-800 animate-pulse rounded h-4 mb-3 w-5/6 light:bg-slate-200" />
        <div className="bg-slate-800 animate-pulse rounded h-4 mb-3 w-4/6 light:bg-slate-200" />
      </>
    ) : (
      <div className="font-mono text-sm text-slate-200 light:text-slate-800">
        <ReactMarkdown ...existing-components...>{content}</ReactMarkdown>
        {isStreaming && <span className="..." />}
      </div>
    )}
    {showScrollButton && <ScrollButton onClick={scrollToBottom} />}
  </div>
);
```

The skeleton previously had `<div className="w-full mt-6">` as its outer wrapper. This is now replaced by the scroll container's `w-full mt-6`. The skeleton's `animate-pulse` divs render directly (no intermediate wrapper), which keeps the existing test assertion (`container.querySelectorAll('.animate-pulse')`) passing.

### 4. Tests

#### `useAutoScroll.test.tsx` (new) — `frontend/src/hooks/__tests__/useAutoScroll.test.tsx`
- **Test 1:** Auto-scrolls to bottom when content changes and user is at bottom
  - Render a test component with `useAutoScroll`, attach ref to a scrollable div
  - Set `deps` to `[content]`, change content, verify `scrollTop` is at bottom
- **Test 2:** Does NOT scroll when user has scrolled up
  - Scroll up, change content, verify `scrollTop` hasn't changed
- **Test 3:** `scrollToBottom` scrolls and resets `showScrollButton`

#### `ScrollButton.test.tsx` (new) — `frontend/src/components/ui/__tests__/ScrollButton.test.tsx`
- **Test:** Renders button with aria-label, fires onClick on click

#### Existing `ResultPanel.test.tsx` — no changes needed
- Skeleton test still passes (animate-pulse divs still present)
- Content tests still pass (markdown rendering unchanged)
- Cursor tests still pass

## Files Changed
- **NEW:** `frontend/src/hooks/useAutoScroll.ts`
- **NEW:** `frontend/src/components/ui/ScrollButton.tsx`
- **MODIFIED:** `frontend/src/components/features/ResultPanel.tsx`
- **NEW:** `frontend/src/hooks/__tests__/useAutoScroll.test.tsx`
- **NEW:** `frontend/src/components/ui/__tests__/ScrollButton.test.tsx`
