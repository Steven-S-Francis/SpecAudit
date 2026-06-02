# Spec: Fix Blank PDF Export (Off-Screen Rendering Bug)

## Overview

**Root cause:** The `exportPdf` function in `frontend/src/utils/exportPdf.ts` uses `html2pdf.js` (which internally calls `html2canvas`) to render a PDF. It places a temporary `<div>` off-screen via `position:fixed;left:-9999px` before capturing. `html2canvas` cannot render elements positioned off-screen — the canvas captures a zero-area region, producing a completely blank PDF.

**Fix:** Replace the off-screen positioning with a zero-opacity on-screen approach. The element stays in the viewport at `(0,0)` but is made effectively invisible via `z-index`, near-zero `opacity`, and `pointer-events:none`.

---

## Files to Modify

| File | Action |
|---|---|
| `frontend/src/utils/exportPdf.ts` | **Modify** — one line (the `element.style.cssText` assignment) |

No other files need changes.

---

## Exact Change

### Before (line 84–87)

```ts
  element.style.cssText =
    'position:fixed;left:-9999px;top:0;width:800px;padding:40px;' +
    'font-family:Arial,Helvetica,sans-serif;color:#000;background:#fff;' +
    'line-height:1.5;font-size:12px;';
```

### After

```ts
  element.style.cssText =
    'position:absolute;left:0;top:0;width:800px;padding:40px;' +
    'z-index:-1000;opacity:0.001;pointer-events:none;' +
    'font-family:Arial,Helvetica,sans-serif;color:#000;background:#fff;' +
    'line-height:1.5;font-size:12px;';
```

### Diff Summary

| Property | Before | After | Rationale |
|---|---|---|---|
| `position` | `fixed` | `absolute` | Absolute positioning relative to `<body>` keeps the element in the document flow for html2canvas. Fixed positioning can behave differently in scrollable contexts and isn't needed here. |
| `left` | `-9999px` | `0` | Must be on-screen for html2canvas to capture. |
| `top` | `0` | `0` | Unchanged (already on-screen vertically). |
| `z-index` | *(none)* | `-1000` | Pushes element behind all other content so it's never visible to the user. |
| `opacity` | *(none)* | `0.001` | Nearly invisible. `opacity:0` is **not** used because some rendering engines (and html2canvas) may skip zero-opacity elements entirely during capture. `0.001` is visually imperceptible but still renders. |
| `pointer-events` | *(none)* | `none` | Prevents any mouse/touch interaction with the invisible overlay. |

---

## Edge Cases & Considerations

### 1. Why `opacity:0.001` instead of `0`?
Some browser rendering pipelines and html2canvas skip elements with `opacity:0` during compositing, which can still produce a blank capture. A near-zero value (`0.001`) guarantees the element is composited while being visually imperceptible to the user.

### 2. Why `position:absolute` instead of `fixed`?
- `fixed` positions relative to the viewport, which can interfere with html2canvas's internal coordinate calculations when the page is scrolled.
- `absolute` positions relative to the nearest positioned ancestor (here `<body>`), giving a stable, predictable origin at `(0,0)`.
- Since the element is appended to `document.body` and removed after capture, `absolute` is the safer choice.

### 3. Why `z-index:-1000`?
A sufficiently negative value ensures the element stays behind all legitimate page content. `-1000` is an arbitrary large negative number that guarantees this without relying on knowing the page's actual z-index stack.

### 4. Element cleanup still works
The `try/finally` block at lines 99–121 already calls `document.body.removeChild(element)`, so the invisible element is always cleaned up after the PDF is generated or if an error occurs.

### 5. No visual flash
Because the element has `opacity:0.001` and `z-index:-1000`, the user will never see it appear momentarily during PDF generation.

### 6. Screen readers / accessibility
`opacity:0.001` does **not** hide elements from assistive technology the way `display:none` or `aria-hidden=true` does. However, the element is:
- Only present in the DOM for the duration of the PDF export (synchronous-ish — a few hundred ms).
- Removed in the `finally` block.
- Contains no interactive content.
This is acceptable. If accessibility were a concern, an `aria-hidden="true"` attribute could be added, but this is not required for the fix.

---

## Testing & Verification Plan

Execute these three commands from the repository root:

| Step | Command | Expected Outcome |
|---|---|---|
| 1. TypeScript check | `npx tsc --noEmit` | Zero type errors (exit code 0). |
| 2. Unit tests | `npm test -- --run` | All tests pass. |
| 3. Docker build | `docker compose build` | Image builds without errors. |

Additionally, a manual smoke test should be performed:
- Open the app in a browser.
- Run a spec audit to produce results.
- Click **"Export as PDF"**.
- Verify the downloaded PDF is **not** blank and contains the expected report content.

---

## Summary

| Aspect | Detail |
|---|---|
| **Bug** | "Export as PDF" produces a blank file |
| **Root cause** | `html2canvas` cannot render elements at `left:-9999px` |
| **Fix** | Use on-screen, near-invisible positioning (`left:0;top:0;opacity:0.001;z-index:-1000;pointer-events:none`) |
| **File changed** | `frontend/src/utils/exportPdf.ts` (1 line) |
| **Risk** | Low — trivial CSS change, element cleanup unchanged |
| **Verification** | `npx tsc --noEmit`, `npm test -- --run`, `docker compose build` |
