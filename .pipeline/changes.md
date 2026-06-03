# Changes: "Copy individual finding" feature

## Summary

Implemented the "Copy individual finding" feature as specified in `.pipeline/spec.md`. Each severity finding block now has a hover-visible copy icon that copies the block's raw markdown text to the clipboard, with visual feedback (clipboard → checkmark icon swap for 2 seconds).

## Files Created

### `frontend/src/utils/__tests__/splitIntoBlocks.test.ts`
- 6 unit tests for `splitIntoBlocks`:
  1. Splits multiple severity blocks (CRITICAL, WARNING, INFO)
  2. Returns null severity for non-finding content
  3. Handles mixed content (non-finding followed by findings)
  4. Handles empty string
  5. Preserves block text content
  6. Does not split on partial/incomplete severity headers

## Files Modified

### `frontend/src/utils/filterMarkdown.ts`
- Added `MarkdownBlock` interface export (`{ text: string; severity: SeverityLevel | null }`)
- Added `splitIntoBlocks()` export: splits markdown content at severity-heading boundaries using the same regex as `filterMarkdownBySeverity`, returns `MarkdownBlock[]`
- Calls the existing private `extractSeverityFromBlock()` helper for each block

### `frontend/src/components/features/ResultPanel.tsx`
- **Import added**: `splitIntoBlocks` from `../../utils/filterMarkdown`
- **New state**: `copiedBlockText: string | null` — tracks which block's text was last copied (keyed by block text, not index)
- **New callback**: `handleCopyBlock` — calls `navigator.clipboard.writeText()`, sets `copiedBlockText`, clears after 2 seconds with `setTimeout`. Errors are silently ignored (matches existing pattern)
- **Architectural change**: Single `<ReactMarkdown>` rendering `highlightedContent` replaced with per-block rendering:
  - `filteredContent` is split into blocks via `splitIntoBlocks()`
  - Each block is highlighted individually via `highlightText()`
  - Each block gets its own `<ReactMarkdown>` instance
  - Finding blocks (`severity !== null`) get a parent `<div className="relative group">` with a copy button
  - Non-finding blocks render as-is without a copy button
  - Streaming cursor remains after all blocks
- **Copy button**: Absolute-positioned top-right, `opacity-0 group-hover:opacity-100` for hover visibility, clipboard/checkmark SVGs, `aria-label` and `title` toggle between "Copy finding" and "Copied!"
- **Removed**: `highlightedContent` variable (replaced by per-block highlighting inside the `.map()`)
- **Added**: `blocks` variable from `splitIntoBlocks(filteredContent)`

### `frontend/src/components/features/__tests__/ResultPanel.test.tsx`
- Added 6 new test cases inside the existing `describe('ResultPanel', () => { ... })` block:
  1. **Copy button renders on severity finding block** — verifies a CRITICAL block has a "Copy finding" button
  2. **No copy button on non-severity block** — verifies Governance Score block has no copy button
  3. **Clicking copy button copies the finding block text** — mocks clipboard API, asserts `writeText` called with block content (including markdown markers, without `<mark>` tags)
  4. **Shows checkmark icon after copy** — asserts `aria-label` changes to "Copied!" after click
  5. **Hides copy button when severity is filtered out** — hides CRITICAL, verifies only WARNING block's copy button remains
  6. **Copy buttons during streaming** — verifies copy button and streaming cursor both render simultaneously

## Deviations from spec

1. **`MarkdownBlock` type import omitted**: The spec says to add `import { splitIntoBlocks, type MarkdownBlock }` but `MarkdownBlock` is not directly referenced in the component (type is inferred from `splitIntoBlocks()` return). With `noUnusedLocals: true` in `tsconfig.app.json`, the unused import would fail compilation. The type import was removed to avoid this error while keeping all functionality identical.

## Notes for Tester

### Focus areas
- **Copy button**: Hover over a CRITICAL/WARNING/INFO finding to see the copy icon appear (opacity transition). Clicking it should copy the full block text to clipboard.
- **Visual feedback**: After clicking copy, the icon should change to a checkmark and the tooltip/aria-label should say "Copied!" for 2 seconds.
- **Filter interaction**: When a severity is toggled off, its finding blocks (and copy buttons) should disappear. The remaining severity copy buttons should still work.
- **Streaming**: During streaming, partial finding blocks should still have copy buttons. The streaming cursor should remain visible after all blocks.
- **Non-finding blocks**: Blocks like `## Governance Score` or `### Summary` should NOT have copy buttons.
- **Search + copy**: Copying a block should copy the raw markdown text without `<mark>` highlighting tags (use `block.text` not `highlightedBlock`).

### Build verification
- `npx tsc --noEmit` — passes cleanly
- `npx vitest run` — all 232 tests pass across 17 test files (17 new tests added: 6 splitIntoBlocks + 6 ResultPanel + 5 from previous infrastructure)
