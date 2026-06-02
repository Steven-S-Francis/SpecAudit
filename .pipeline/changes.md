# Changes

## [Unreleased] — Fix Blank PDF Export

### `frontend/src/utils/exportPdf.ts`

- **Modified** the `element.style.cssText` assignment (line 84–88) to replace off-screen positioning with an on-screen, near-invisible approach.
  - `position:fixed;left:-9999px` → `position:absolute;left:0;top:0` (keeps element in viewport so `html2canvas` can capture it).
  - Added `z-index:-1000` to push element behind all content.
  - Added `opacity:0.001` (near-zero but not zero, because some render engines skip `opacity:0` elements).
  - Added `pointer-events:none` to prevent interaction with the invisible overlay.
  - Remaining layout and font properties are unchanged.

**Root cause:** `html2canvas` cannot render elements positioned off-screen at `left:-9999px`, producing a blank PDF.

**Risk:** Low — trivial CSS-only change; element cleanup in the `try/finally` block is unaffected.
