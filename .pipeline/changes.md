## Changes made

### 1. `frontend/src/components/features/ResultPanel.tsx`
- **Added `style={{ padding: '5px' }}`** to the outer container `<div>` (line ~51). This gives the result content a 5px padding inside the scrollable container.

### 2. `frontend/src/App.tsx`
- **Added `displayContent` variable** (line ~18) that strips trailing ` ```json...``` ` code blocks from `state.result` using the regex `/```json[\s\S]*?```\s*$/gm`. These blocks are used only by the JSON export button and should not be visible in the markdown preview.
- **Changed `ResultPanel` `content` prop** from `state.result` to `displayContent`, so the user sees the cleaned markdown without the trailing JSON block.

### Tester focus
- Verify the result container now has visible 5px padding around its content.
- Verify that when `state.result` contains a trailing ` ```json...``` ` block, it is stripped from the display but still available for the JSON export button (which reads `state.result` directly via `handleCopy`/`handleDownload`/`handleExportPdf`).
- Confirm no regression: TypeScript `tsc --noEmit` passes, all 177 tests pass.
