# Search within results

## OPEN QUESTIONS

1. **Minimum query length**: Should single-character searches be allowed, or require ≥2 characters? Searching for a single letter like "e" on a large report could highlight thousands of matches and degrade performance. **Recommendation**: No minimum — empty string disables highlighting, any non-empty query triggers it. The debounce handles the performance case. If rendering is still too slow, we can add a minimum later.

2. **Highlight in code blocks**: Should matches inside `<code>` elements (both inline and block) be highlighted? Highlighting inside block code could visually clutter the output since code often contains special characters like `/`, `.`, or `-` that users might search for. **Recommendation**: Highlight everywhere for now. The `<mark>` styling is subtle (yellow background, dark text) and won't obscure content.

3. **Case sensitivity**: Should the search be case-sensitive or case-insensitive? **The spec assumes case-insensitive** (matching the user's expectation for finding text in a document). If you want case-sensitive, change the `RegExp` flag from `'gi'` to `'g'`.

---

## Architecture Overview

The search feature lives entirely within the existing `ResultPanel` component. No new components, no backend changes, no markdown pipeline changes.

**Data flow:**

```
raw markdown content
  → filterMarkdownBySeverity()  (existing — removes hidden severity blocks)
    → severity-filtered markdown string
      → highlightTextInMarkdown()  (NEW — wraps matches with <mark> tags)
        → markdown with injected <mark> HTML
          → ReactMarkdown with rehype-raw + rehype-sanitize
            → rendered DOM with highlighted matches
```

**Why inject `<mark>` HTML tags into the markdown string instead of modifying ReactMarkdown renderers?**
- Simpler: only one new utility function + two remark plugin additions, vs. modifying every custom renderer
- Works for ALL markdown elements, not just the ones with custom overrides
- The `<mark>` HTML tag passes through `rehype-raw` and renders as a native `<mark>` element

**Why use `rehype-raw`?**
- `react-markdown` v10 strips raw HTML by default for security. `rehype-raw` enables HTML passthrough.
- `rehype-sanitize` ensures only safe HTML tags pass through (we configure it to allow `<mark>`).
- Without this, `<mark>` tags in the markdown string would be rendered as literal text.

**Debounce approach:**
- Use `useDeferredValue` (React 19 built-in) to defer search highlighting re-renders
- The search input state updates immediately (responsive typing)
- The `deferredQuery` value lags behind, so markdown re-processing (splitting + highlighting + ReactMarkdown render) happens at lower priority
- No explicit timeout needed — React schedules the deferred work during idle periods

## Files to Create or Modify

| Action | Path | Description |
|--------|------|-------------|
| CREATE | `frontend/src/utils/highlightText.ts` | Utility to inject `<mark>` tags into markdown text |
| MODIFY | `frontend/src/components/features/ResultPanel.tsx` | Add search input, deferred query state, wire up highlighting |
| MODIFY | `frontend/src/components/features/ResultPanel.tsx` | Add `rehype-raw` + `rehype-sanitize` plugins to ReactMarkdown |
| MODIFY | `frontend/package.json` | Add `rehype-raw` and `rehype-sanitize` dependencies |
| MODIFY | `frontend/src/components/features/__tests__/ResultPanel.test.tsx` | Add search + highlight test cases |

---

## 1. New file: `frontend/src/utils/highlightText.ts`

### Purpose

Injects `<mark>` HTML tags around case-insensitive matches of `query` in plain text. Operates on the **raw markdown string** before it enters ReactMarkdown.

### Signature

```ts
/**
 * Wraps all case-insensitive occurrences of `query` in `<mark>` tags.
 * Returns the original string unchanged if query is empty.
 * Escapes special regex characters in query to prevent ReDoS.
 */
export function highlightText(text: string, query: string): string;
```

### Implementation

```ts
/**
 * Wraps all case-insensitive occurrences of `query` in `<mark>` tags.
 * Returns the original string unchanged if query is empty.
 * Escapes special regex characters in query to prevent ReDoS / injection.
 */
export function highlightText(text: string, query: string): string {
  if (!query || !text) return text;

  // Escape special regex characters
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Split and rejoin with <mark> tags — avoids re-entrant matching
  return text.replace(
    new RegExp(escaped, 'gi'),
    (match) => `<mark class="search-highlight">${match}</mark>`,
  );
}
```

**Edge cases handled:**
- Empty query → returns text unchanged (no-op)
- Empty text → returns empty string
- Query not found → text unchanged
- Query with regex special chars (`(`, `)`, `*`, `+`, etc.) → escaped before building RegExp
- Overlapping matches → `String.replace` handles non-overlapping matches; overlapping (e.g., "aaa" searching for "aa") is rare and `replace` only replaces the first match in each overlap group, which is acceptable
- Matches spanning markdown syntax characters (e.g., `###`) → `<mark>` is injected around the match; since markdown headings are defined by leading `###`, the `###` is still at the start of the line, so markdown parsing is unaffected

---

## 2. Modify `frontend/src/components/features/ResultPanel.tsx`

### 2.1 Add imports

Add these imports at the top:

```ts
import { useDeferredValue } from 'react';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { type Options as SanitizeOptions } from 'rehype-sanitize';
import { highlightText } from '../../utils/highlightText';
```

### 2.2 Allow `<mark>` in rehype-sanitize

Define a custom sanitize schema that permits `<mark>` elements:

```ts
const SANITIZE_SCHEMA: SanitizeOptions = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'mark'],
  attributes: {
    ...defaultSchema.attributes,
    mark: ['class'],
  },
};
```

(The exact import of `defaultSchema` needs verification — it may be `defaultSchema` or a named export from `rehype-sanitize`. The Coder should check the actual export.)

### 2.3 Add search state and deferred query

Inside the `ResultPanel` function, after existing state:

```ts
const [searchQuery, setSearchQuery] = useState('');
const deferredQuery = useDeferredValue(searchQuery);
```

### 2.4 Add search input UI

Add the search input between the `{content && ...}` severity filter group and the `<div className="font-mono ...">` markdown area.

Place it after the severity filter buttons (line 99) and before the markdown content div (line 101):

```tsx
{/* Search input */}
<div className="relative mb-3">
  <input
    type="text"
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    placeholder="Search results…"
    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 pl-8 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 light:bg-white light:border-slate-300 light:text-slate-800"
    aria-label="Search within results"
  />
  {/* Search icon (magnifying glass) */}
  <svg
    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none"
    xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
  {/* Clear button — only visible when query is non-empty */}
  {searchQuery && (
    <button
      onClick={() => setSearchQuery('')}
      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 light:hover:text-slate-600"
      aria-label="Clear search"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  )}
</div>
```

### 2.5 Apply highlighting to content

Replace the `filteredContent` variable assignment (line 62) with:

```ts
const filteredContent = filterMarkdownBySeverity(content, hiddenSeverities);
const highlightedContent = highlightText(filteredContent, deferredQuery);
```

### 2.6 Pass highlighted content and add rehype plugins

Replace the ReactMarkdown invocation (lines 102–143) with:

```tsx
<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  rehypePlugins={[
    [rehypeRaw],
    [rehypeSanitize, SANITIZE_SCHEMA],
  ]}
  components={{ /* … unchanged … */ }}
>
  {highlightedContent}
</ReactMarkdown>
```

**Note on component ordering:** If the rehype plugin declaration format differs from the above (e.g., flat array vs. nested), the Coder should refer to the `react-markdown` v10 documentation for the exact plugin array shape.

### 2.7 Search input visibility

The search input should only render when `content` is present (same condition as the severity filter buttons). Wrap the search input block in the same `{content && (...)}` condition that wraps the severity buttons.

### 2.8 Full renderer changes summary

The modified component flow (inside the `!showSkeleton` branch):

```
{content && (
  <>
    <Severity filter buttons />       (existing, unchanged)
    <Search input />                  (NEW)
  </>
)}
<div className="font-mono text-sm …">
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    rehypePlugins={[[rehypeRaw], [rehypeSanitize, SANITIZE_SCHEMA]]}
    components={{ /* same custom renderers */ }}
  >
    {highlightedContent}
  </ReactMarkdown>
  {isStreaming && <Blinking cursor />}  (existing, unchanged)
</div>
{content && <ScrollButton … />}        (existing, unchanged)
```

---

## 3. Modify `frontend/package.json`

Add these to `dependencies`:

```json
"rehype-raw": "^7.0.0",
"rehype-sanitize": "^6.0.0"
```

These versions are compatible with `react-markdown ^10.1.0`. Verify exact latest versions with `npm info rehype-raw versions --json` and `npm info rehype-sanitize versions --json`.

---

## 4. Add test file entries to `frontend/src/components/features/__tests__/ResultPanel.test.tsx`

Add the following test cases inside the existing `describe('ResultPanel', () => { … })` block.

### 4.1 Search input renders when content is present

```ts
it('renders search input when content is present', () => {
  render(<ResultPanel content="# Test" isStreaming={false} />);
  expect(screen.getByPlaceholderText('Search results…')).toBeInTheDocument();
});

it('does not render search input when content is empty', () => {
  render(<ResultPanel content="" isStreaming={false} />);
  expect(screen.queryByPlaceholderText('Search results…')).not.toBeInTheDocument();
});
```

### 4.2 Search highlighting in rendered output

```ts
it('highlights matching text in rendered output', () => {
  const markdown = '## Governance Score\nScore: 8.5';
  render(<ResultPanel content={markdown} isStreaming={false} />);
  const input = screen.getByPlaceholderText('Search results…');
  fireEvent.change(input, { target: { value: 'Governance' } });
  // The <mark> element should contain 'Governance'
  const highlights = container.querySelectorAll('mark.search-highlight');
  expect(highlights.length).toBeGreaterThanOrEqual(1);
  expect(highlights[0]).toHaveTextContent('Governance');
  expect(highlights[0].className).toContain('search-highlight');
});

it('highlight is case-insensitive', () => {
  const markdown = '### [CRITICAL] Missing Auth';
  render(<ResultPanel content={markdown} isStreaming={false} />);
  const input = screen.getByPlaceholderText('Search results…');
  fireEvent.change(input, { target: { value: 'missing' } });
  const highlights = container.querySelectorAll('mark.search-highlight');
  expect(highlights.length).toBeGreaterThanOrEqual(1);
  expect(highlights[0]).toHaveTextContent('Missing');
});
```

### 4.3 Clear button resets highlights

```ts
it('clear button removes highlighting', () => {
  const markdown = '## Governance Score\nScore: 8.5';
  render(<ResultPanel content={markdown} isStreaming={false} />);
  const input = screen.getByPlaceholderText('Search results…');
  fireEvent.change(input, { target: { value: 'Governance' } });
  expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Clear search'));
  expect(input).toHaveValue('');
  const highlights = container.querySelectorAll('mark.search-highlight');
  expect(highlights.length).toBe(0);
});
```

### 4.4 Search + severity filter interaction

```ts
it('search works together with severity filter', () => {
  const markdown = '### [CRITICAL] Missing Auth\n---\n### [WARNING] Missing 404';
  render(<ResultPanel content={markdown} isStreaming={false} />);
  // Hide CRITICAL
  fireEvent.click(screen.getByRole('button', { name: 'CRITICAL' }));
  // Search for 'Missing'
  const input = screen.getByPlaceholderText('Search results…');
  fireEvent.change(input, { target: { value: 'Missing' } });
  // Only WARNING finding should be visible and highlighted
  expect(screen.queryByText('Missing Auth')).not.toBeInTheDocument();
  expect(screen.getByText('Missing 404')).toBeInTheDocument();
});
```

### 4.5 Empty search shows no highlights

```ts
it('empty search query shows no highlights', () => {
  const markdown = '## Governance Score\nScore: 8.5';
  const { container } = render(<ResultPanel content={markdown} isStreaming={false} />);
  const highlights = container.querySelectorAll('mark.search-highlight');
  expect(highlights.length).toBe(0);
});
```

### 4.6 Search term not found renders normally

```ts
it('unmatched search term renders normally', () => {
  const markdown = '## Governance Score\nScore: 8.5';
  render(<ResultPanel content={markdown} isStreaming={false} />);
  const input = screen.getByPlaceholderText('Search results…');
  fireEvent.change(input, { target: { value: 'ZZZNOTFOUND' } });
  const highlights = container.querySelectorAll('mark.search-highlight');
  expect(highlights.length).toBe(0);
  expect(screen.getByText('Governance Score')).toBeInTheDocument();
});
```

---

## 5. CSS for `<mark>` highlights

Add to `frontend/src/index.css` or a CSS module. Since Tailwind v4 is used with `@import "tailwindcss"`, add a custom utility. The `<mark>` tag uses the `search-highlight` class.

Add this to `frontend/src/index.css`:

```css
mark.search-highlight {
  @apply bg-yellow-400 text-slate-900 rounded px-0.5;
}
```

**Light mode compatibility:** The yellow background is equally visible in both dark and light mode. The `text-slate-900` ensures contrast against the yellow background.

---

## Edge Cases

### 5.1 Empty search query
- `highlightText` returns text unchanged.
- No `<mark>` tags injected.
- No performance impact.

### 5.2 Search term not found
- `String.replace` returns the original string unchanged.
- No `<mark>` tags injected.
- Content renders normally.

### 5.3 Special regex characters in query
- `.*+?^${}()|[]\` are all escaped before constructing the RegExp.
- Searching for `(CRITICAL)` will match the literal string `(CRITICAL)` in the markdown.

### 5.4 Query appears inside markdown formatting (e.g., searching for `CRITICAL`)
- The match `CRITICAL` appears inside `[CRITICAL]` in the raw markdown heading `### [CRITICAL] Missing Auth`.
- `highlightText` replaces it with `<mark class="search-highlight">CRITICAL</mark>`, resulting in:
  `### [<mark class="search-highlight">CRITICAL</mark>] Missing Auth`
- ReactMarkdown parses this as a heading (`###`) with inline content containing `<mark>`. This works correctly.

### 5.5 Query appears inside severity filter badges
- The severity filter buttons (CRITICAL / WARNING / INFO) are outside the markdown area and are NOT affected by highlighting.
- The badge text inside the markdown content (the `<span className={styles.badge}>` in the h3 renderer) IS highlighted because the `<mark>` tag is in the raw markdown before ReactMarkdown renders it.

### 5.6 Streaming content
- The search input state persists across content updates.
- `deferredQuery` updates asynchronously, so rapid streaming chunks don't trigger re-highlighting on every chunk.
- The user can continue typing search terms while content streams in.

### 5.7 Very large reports (>10k lines)
- `highlightText` uses a single `String.replace` call — O(n) in content length.
- ReactMarkdown parsing is the bottleneck. `useDeferredValue` ensures this work is deferred.
- If performance is still poor, the search input could be disabled during streaming (`isStreaming` prop), but this is NOT in scope.

### 5.8 Copy / Export / Download
- All export functions (`handleCopy`, `handleDownload`, `handleExportPdf`, `handleExportJson`) use the raw `strippedResult` string from `App.tsx` — they NEVER see the highlighted HTML.
- No search artifacts leak into exports.

### 5.9 Multiple matches in the same line
- `String.replace` with `g` flag replaces all matches in the string.
- Overlapping matches (e.g., text `"aaaa"` searching for `"aa"`) result in two non-overlapping `<mark>` tags: `<mark>aa</mark><mark>aa</mark>`. This is acceptable behavior.

### 5.10 Null/undefined content
- `highlightText` handles empty/falsy text by returning it unchanged.
- The `{content && ...}` guard ensures the search input is not rendered when content is empty.

---

## Testing Strategy

### Unit tests for `highlightText.ts`

Create `frontend/src/utils/__tests__/highlightText.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { highlightText } from '../highlightText';

describe('highlightText', () => {
  it('returns text unchanged for empty query', () => {
    expect(highlightText('hello world', '')).toBe('hello world');
  });

  it('wraps matching text in <mark> tags', () => {
    expect(highlightText('hello world', 'world'))
      .toBe('hello <mark class="search-highlight">world</mark>');
  });

  it('is case-insensitive', () => {
    expect(highlightText('Hello World', 'world'))
      .toBe('Hello <mark class="search-highlight">World</mark>');
  });

  it('highlights all occurrences', () => {
    expect(highlightText('test test test', 'test'))
      .toBe(
        '<mark class="search-highlight">test</mark> '
        + '<mark class="search-highlight">test</mark> '
        + '<mark class="search-highlight">test</mark>'
      );
  });

  it('escapes regex special characters', () => {
    expect(highlightText('cost (total)', '(total)'))
      .toBe('cost <mark class="search-highlight">(total)</mark>');
  });

  it('returns empty string for empty text', () => {
    expect(highlightText('', 'test')).toBe('');
  });

  it('returns text unchanged when query not found', () => {
    expect(highlightText('hello world', 'xyz')).toBe('hello world');
  });
});
```

### Component tests (in `ResultPanel.test.tsx`)

Already listed in Section 4 above. Follow the existing test patterns:
- Render with `@testing-library/react`
- Use `fireEvent` for interactions
- Use `container.querySelectorAll` for checking `<mark>` elements
- Use `screen.getByText` / `screen.queryByText` for visible content assertions

### What NOT to test

- **Debounce timing**: `useDeferredValue` is a React 19 primitive — we test behavior, not timing. The component tests verify that highlights appear after changing the search value, which is sufficient.
- **rehype plugin integration**: This is `react-markdown` internals. Trust that `rehype-raw` + `rehype-sanitize` works as documented.
- **Performance under load**: Manual testing during review.

---

## Implementation Order

1. `npm install rehype-raw rehype-sanitize` in `frontend/`
2. Create `frontend/src/utils/highlightText.ts`
3. Create `frontend/src/utils/__tests__/highlightText.test.ts`
4. Add `.search-highlight` CSS rule to `frontend/src/index.css`
5. Modify `frontend/src/components/features/ResultPanel.tsx`:
   - Add imports
   - Add `SANITIZE_SCHEMA`
   - Add search state + deferred query
   - Add search input UI (conditionally rendered)
   - Apply `highlightText` to filtered content
   - Add `rehypePlugins` to ReactMarkdown
6. Add test cases to `frontend/src/components/features/__tests__/ResultPanel.test.tsx`
7. `npx tsc --noEmit && npx vitest run` — ensure all tests pass
8. Manual smoke test: open the app, run an audit, type in the search input, verify highlights appear
