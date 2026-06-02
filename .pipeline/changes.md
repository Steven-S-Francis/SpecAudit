# Changes: Strip JSON block from all user-facing exports

## File changed
- `frontend/src/App.tsx`

## What changed
- **Renamed** `displayContent` → `strippedResult` (line 19): clearer name since it's now used by all user-facing exports, not just display.
- **`handleCopy`** (line 23, 29): now copies `strippedResult` instead of `state.result`; dependency changed to `[strippedResult]`.
- **`handleDownload`** (line 33, 45): now downloads `strippedResult` instead of `state.result`; dependency changed to `[strippedResult]`.
- **`handleExportPdf`** (line 49, 53): now exports `strippedResult` instead of `state.result`; dependency changed to `[strippedResult]`.
- **`handleExportJson`** (lines 55-81): **unchanged** — still uses `state.findings`/`state.summary` with `state.result` fallback when no structured data exists.
- **`ResultPanel`** (line 180): now receives `strippedResult` instead of `displayContent`.

## Effect
The trailing ```json...``` block is no longer included in Copy, Download (.md), Export PDF, or the UI render. It remains accessible only via the Export JSON button.

## Tester focus
- `npx tsc --noEmit` — zero errors ✅
- `npm test -- --run` — all 177 tests pass ✅
- Verify Copy button copies markdown without the trailing JSON block
- Verify Download (.md) file has no trailing JSON block
- Verify Export PDF has no trailing JSON block
- Verify Export JSON still works (uses findings/summary, falls back to result)
