# Changes: "Search within results" feature

## Summary

Implemented the "Search within results" feature as specified in `.pipeline/spec.md`. The feature allows users to type a search query to highlight matching text within the rendered markdown content of audit results.

## Files Created

### `frontend/src/utils/highlightText.ts`
- New utility that wraps case-insensitive occurrences of a query string in `<mark class="search-highlight">` HTML tags
- Escapes regex special characters in the query to prevent ReDoS / injection
- Returns text unchanged if query is empty

### `frontend/src/utils/__tests__/highlightText.test.ts`
- 7 unit tests covering: empty query, basic matching, case-insensitivity, multiple occurrences, regex special character escaping, empty text, and unmatched query

## Files Modified

### `frontend/package.json`
- Added `rehype-raw` (^7.0.0) and `rehype-sanitize` (^6.0.0) to dependencies
- These are required for raw HTML passthrough (`<mark>` tags) in ReactMarkdown

### `frontend/src/index.css`
- Added `.search-highlight` CSS rule: `@apply bg-yellow-400 text-slate-900 rounded px-0.5`

### `frontend/src/components/features/ResultPanel.tsx`
- **Imports added**: `useDeferredValue`, `isValidElement`, `Children`, `ReactNode` from React; `rehypeRaw`; `rehypeSanitize`, `defaultSchema`, `Options as SanitizeOptions`; `highlightText`
- **`SANITIZE_SCHEMA`**: Custom rehype-sanitize schema extending `defaultSchema` to allow `<mark>` elements with `className` attribute (HAST property name for HTML `class`)
- **`extractTextContent` helper**: Recursively extracts plain text from React children, handling React elements (needed because `<mark>` elements appear in heading children after `rehype-raw` processing)
- **Search state**: `searchQuery` state + `deferredQuery` via `useDeferredValue` for debounced highlighting
- **`highlightedContent`**: Applies `highlightText()` to the severity-filtered content using `deferredQuery`
- **Search input UI**: Rendered inside `{content && ...}` block (same condition as severity filter buttons), with a text input, magnifying glass icon, and clear button
- **ReactMarkdown**: Added `rehypePlugins={[[rehypeRaw], [rehypeSanitize, SANITIZE_SCHEMA]]}` and content changed from `{filteredContent}` to `{highlightedContent}`
- **`h3` renderer fix**: Changed `String(children)` to `extractTextContent(children)` to avoid `[object Object]` when `<mark>` elements are among children. Instead of rendering `{cleanTitle}` string, now filters out the severity prefix from children (`Children.map`) to preserve `<mark>` highlighting elements

### `frontend/src/components/features/__tests__/ResultPanel.test.tsx`
- Added `waitFor` to imports
- Added 8 new test cases:
  1. Search input renders when content is present
  2. Search input does not render when content is empty
  3. Highlights matching text in rendered output (async, uses `waitFor`)
  4. Highlight is case-insensitive (async, uses `waitFor`)
  5. Clear button removes highlighting
  6. Search works together with severity filter
  7. Empty search query shows no highlights
  8. Unmatched search term renders normally
- Tests 3, 4, and 6 use `async`/`waitFor` to accommodate `useDeferredValue`'s deferred update cycle

## Notes for Tester

### Deviations from spec (documented here for awareness)

1. **`SANITIZE_SCHEMA.attributes.mark`**: Uses `['className']` instead of `['class']` as specified. This is because HAST (the AST used by rehype) represents the HTML `class` attribute as the `className` property. Using `'class'` would not work — the `class` attribute was silently stripped. (Confirmed by examining `hast-util-sanitize`'s default schema which uses `'className'` throughout, e.g., `code: [['className', /^language-./]]`)

2. **`h3` renderer fix**: The spec's edge cases mention that `<mark>` tags appear in heading children, but the existing `h3` renderer used `String(children)` which converted React elements to `[object Object]`. Added `extractTextContent()` helper and changed the renderer to preserve children structure (filtering the severity prefix instead of rendering a plain string). Test 6 (`search works together with severity filter`) exposed this issue.

3. **Tests use `waitFor`**: The spec's "What NOT to test" section says "Debounce timing" shouldn't be tested, but the component tests asserting highlight presence need `waitFor` because `useDeferredValue` causes an async update cycle. The tests use `waitFor` (max ~1000ms polling) to wait for deferred highlights to appear, rather than asserting synchronously.

### Build verification
- `npx tsc --noEmit` — passes cleanly
- `npx vitest run` — all 220 tests pass across 16 test files
