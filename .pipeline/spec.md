# Copy individual finding

## OPEN QUESTIONS

1. **Copy icon visibility**: Should the copy button be always visible on each severity block, or only appear on hover? Hover-only (`group-hover:opacity-100`) keeps the UI cleaner for dense reports. **Recommendation**: hover-only, matching common patterns like GitHub code-block copy buttons.

2. **Copy feedback style**: The existing full-copy button in `App.tsx` uses text change ("Copy" → "Copied!"). For the per-block icon, **recommendation**: change the icon from clipboard to checkmark for 2 seconds, with `aria-label` changing to "Copied!" to support accessibility.

3. **Non-finding blocks**: Should `### Summary` or `## Governance Score` blocks get copy icons? The feature request says "severity block", implying only `### [CRITICAL|WARNING|INFO]` blocks. **Recommendation**: Only finding blocks get copy icons; non-finding blocks render as-is.

4. **Block identity during streaming**: Using block text as the "copied" identifier (instead of array index) prevents feedback drift when new blocks stream in. **Recommendation**: Use `copiedBlockText: string | null` state keyed by the block's raw text.

---

## Architecture Overview

The feature lives entirely within `ResultPanel.tsx` with a small addition to `filterMarkdown.ts`. No new components, no backend changes, no new dependencies.

**Data flow:**

```
raw markdown content (from App.tsx)
  → filterMarkdownBySeverity()          (existing — removes hidden severity blocks)
    → splitIntoBlocks()                 (NEW — splits filtered content by severity headings)
      → blocks: [{ text, severity }]
        → per-block: highlightText()    (existing — wraps search matches in <mark>)
          → per-block: <ReactMarkdown>  (one instance per block)
            → finding blocks get an extra wrapper div + copy icon button
              → onClick → navigator.clipboard.writeText(block.text)
```

**Why split into per-block ReactMarkdown instances instead of keeping a single ReactMarkdown?**

- The `h3` custom renderer only has access to the heading's own children. It cannot know the full block text (heading + body paragraphs).
- By splitting blocks in the component, each finding block becomes a self-contained unit that can carry its own copy button with the full block's plain text readily available.
- Each block's text is also available *unhighlighted* for the copy action, so search `<mark>` tags never leak into clipboard content.

---

## Files to Create or Modify

| Action | Path | Description |
|--------|------|-------------|
| MODIFY | `frontend/src/utils/filterMarkdown.ts` | Export `splitIntoBlocks` + `MarkdownBlock` type |
| MODIFY | `frontend/src/components/features/ResultPanel.tsx` | Split blocks, render per-block ReactMarkdown, add copy icon + handler |
| MODIFY | `frontend/src/components/features/__tests__/ResultPanel.test.tsx` | Add 5+ new test cases for individual copy |
| CREATE | `frontend/src/utils/__tests__/splitIntoBlocks.test.ts` | Unit tests for `splitIntoBlocks` |

---

## 1. Modify `frontend/src/utils/filterMarkdown.ts`

### Add exports

After `filterMarkdownBySeverity`, add:

```ts
export interface MarkdownBlock {
  text: string;
  severity: SeverityLevel | null;
}

/**
 * Splits markdown content into blocks at severity-heading boundaries.
 * Each block is either a finding (has a severity header) or non-finding content.
 * Uses the same splitter regex as filterMarkdownBySeverity.
 */
export function splitIntoBlocks(content: string): MarkdownBlock[] {
  if (!content) return [{ text: '', severity: null }];

  const blockSplitter = /\n(?=### \[(?:CRITICAL|WARNING|INFO)\])/;
  const blocks = content.split(blockSplitter);
  return blocks.map((block) => ({
    text: block,
    severity: extractSeverityFromBlock(block),
  }));
}
```

`extractSeverityFromBlock` is already a module-private function in the same file — `splitIntoBlocks` can call it directly.

### Edge cases handled

- Empty string → returns a single block with `{ text: '', severity: null }`
- Content with no severity headings → single block, `severity: null`
- Malformed/incomplete severity headers (e.g. `### [CRITI`) → `severity: null`, text passes through

---

## 2. Modify `frontend/src/components/features/ResultPanel.tsx`

### 2.1 Import additions

At the top of the file, add to existing imports:

```ts
import { splitIntoBlocks, type MarkdownBlock } from '../../utils/filterMarkdown';
```

### 2.2 New state and callback

Inside the `ResultPanel` function, after existing state declarations:

```ts
const [copiedBlockText, setCopiedBlockText] = useState<string | null>(null);

const handleCopyBlock = useCallback(async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    setCopiedBlockText(text);
    setTimeout(() => setCopiedBlockText(null), 2000);
  } catch {
    // Clipboard API unavailable — silently ignore (matches existing pattern)
  }
}, []);
```

### 2.3 Replace the markdown rendering section

Remove the existing `highlightedContent` variable assignment and the single `<ReactMarkdown>` block. Replace them with:

```ts
const filteredContent = filterMarkdownBySeverity(content, hiddenSeverities);
const blocks = splitIntoBlocks(filteredContent);
```

Then replace the entire `<div className="font-mono text-sm text-slate-200 light:text-slate-800">` block with:

```tsx
<div className="font-mono text-sm text-slate-200 light:text-slate-800">
  {blocks.map((block, index) => {
    const highlightedBlock = highlightText(block.text, deferredQuery);
    const isFinding = block.severity !== null;

    return (
      <div key={index} className={isFinding ? 'relative group' : ''}>
        {isFinding && (
          <button
            onClick={() => handleCopyBlock(block.text)}
            className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 light:bg-slate-200 light:hover:bg-slate-300 light:border-slate-300 text-slate-400 hover:text-slate-200 light:text-slate-500 light:hover:text-slate-700"
            aria-label={copiedBlockText === block.text ? 'Copied!' : 'Copy finding'}
            title={copiedBlockText === block.text ? 'Copied!' : 'Copy finding'}
          >
            {copiedBlockText === block.text ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
        )}
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[
            [rehypeRaw],
            [rehypeSanitize, SANITIZE_SCHEMA],
          ]}
          components={{
            h3({ children }: HeadingProps) {
              const text = extractTextContent(children);
              const severity = parseSeverity(text);
              if (severity) {
                const styles = SEVERITY_STYLES[severity];
                const prefix = `[${severity}]`;
                const contentChildren = Children.map(children, (child) => {
                  if (typeof child === 'string' && child.startsWith(prefix)) {
                    const rest = child.slice(prefix.length).trimStart();
                    return rest || undefined;
                  }
                  return child;
                });
                return (
                  <div className={styles.wrapper}>
                    <span className={styles.badge}>{severity}</span>
                    <span className={`font-semibold ${styles.label}`}>{contentChildren}</span>
                  </div>
                );
              }
              return <h3 className="text-slate-100 font-semibold text-base mt-6 mb-2 light:text-slate-900">{children}</h3>;
            },
            code({ children, className }: CodeProps) {
              const isBlock = className?.includes('language-');
              return isBlock
                ? <pre className="bg-slate-900 border border-slate-700 rounded-lg p-4 overflow-x-auto my-3 text-xs text-slate-300 light:bg-slate-100 light:border-slate-300 light:text-slate-600"><code>{children}</code></pre>
                : <code className="bg-slate-800 text-amber-300 px-1.5 py-0.5 rounded text-xs light:bg-slate-200 light:text-amber-700">{children}</code>;
            },
            hr(_props: HrProps) {
              return <hr className="border-slate-700 my-4 light:border-slate-300" />;
            },
            strong({ children }: StrongProps) {
              return <strong className="text-slate-100 font-semibold light:text-slate-900">{children}</strong>;
            },
            p({ children }: ParaProps) {
              return <p className="text-slate-400 text-sm leading-relaxed mb-2 light:text-slate-500">{children}</p>;
            },
          }}
        >
          {highlightedBlock}
        </ReactMarkdown>
      </div>
    );
  })}
  {isStreaming && (
    <span className="inline-block w-2 h-4 bg-slate-400 animate-pulse ml-1 align-text-bottom light:bg-slate-500" />
  )}
</div>
```

### 2.4 Remove obsolete variable

Remove the `highlightedContent` variable declaration:
```ts
const highlightedContent = highlightText(filteredContent, deferredQuery);
```
This is replaced by per-block highlighting inside the map.

---

## 3. Modify `frontend/src/components/features/__tests__/ResultPanel.test.tsx`

Add these test cases inside the existing `describe('ResultPanel', () => { … })` block, after the search tests.

### 3.1 Copy button renders on severity blocks

```ts
it('renders copy button on severity finding block', () => {
  const markdown = '### [CRITICAL] Missing Auth\n\nDetails about the issue.';
  const { container } = render(<ResultPanel content={markdown} isStreaming={false} />);
  const markdownArea = container.querySelector<HTMLElement>('.font-mono');
  const copyBtn = within(markdownArea!).getByLabelText('Copy finding');
  expect(copyBtn).toBeInTheDocument();
});

it('does not render copy button on non-severity block', () => {
  const markdown = '## Governance Score\nScore: 8.5';
  const { container } = render(<ResultPanel content={markdown} isStreaming={false} />);
  const markdownArea = container.querySelector<HTMLElement>('.font-mono');
  expect(within(markdownArea!).queryByLabelText('Copy finding')).not.toBeInTheDocument();
});
```

### 3.2 Clicking copy button copies block text

```ts
it('clicking copy button copies the finding block text', async () => {
  // Mock clipboard API
  const writeText = vi.fn(() => Promise.resolve());
  Object.assign(navigator, { clipboard: { writeText } });

  const markdown = '### [CRITICAL] Missing Auth\n\n**Issue:** No authentication.';
  render(<ResultPanel content={markdown} isStreaming={false} />);
  const copyBtn = screen.getByLabelText('Copy finding');
  fireEvent.click(copyBtn);
  await waitFor(() => {
    expect(writeText).toHaveBeenCalledTimes(1);
    // The copied text should be the block without <mark> tags
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('### [CRITICAL] Missing Auth'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('**Issue:** No authentication.'));
  });
});
```

### 3.3 Copy visual feedback

```ts
it('shows checkmark icon after copy', async () => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn(() => Promise.resolve()) } });

  const markdown = '### [CRITICAL] Missing Auth';
  render(<ResultPanel content={markdown} isStreaming={false} />);
  const copyBtn = screen.getByLabelText('Copy finding');
  fireEvent.click(copyBtn);
  await waitFor(() => {
    // After copy, label changes to "Copied!"
    expect(screen.getByLabelText('Copied!')).toBeInTheDocument();
  });
});
```

### 3.4 No copy button when severity is filtered out

```ts
it('hides copy button when severity is filtered out', () => {
  const markdown = '### [CRITICAL] Missing Auth\n\n---\n### [WARNING] Missing 404';
  render(<ResultPanel content={markdown} isStreaming={false} />);
  // Click CRITICAL toggle to hide CRITICAL findings
  fireEvent.click(screen.getByRole('button', { name: 'CRITICAL' }));
  // The CRITICAL finding's copy button should not exist
  // Only the WARNING block should have a copy button
  const copyButtons = screen.getAllByLabelText('Copy finding');
  expect(copyButtons).toHaveLength(1);
  // The remaining copy button should be on the WARNING block
  expect(screen.getByText('Missing 404')).toBeInTheDocument();
});
```

### 3.5 Copy works during streaming

```ts
it('renders copy buttons during streaming', () => {
  const markdown = '### [WARNING] Incomplete spec';
  render(<ResultPanel content={markdown} isStreaming={true} />);
  expect(screen.getByLabelText('Copy finding')).toBeInTheDocument();
  // Streaming cursor should still be present
  expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
});
```

---

## 4. Create `frontend/src/utils/__tests__/splitIntoBlocks.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { splitIntoBlocks } from '../filterMarkdown';

const CRITICAL_BLOCK = '### [CRITICAL] Missing Auth\n\nDetails.';
const WARNING_BLOCK  = '### [WARNING] Missing 404\n\nDetails.';
const INFO_BLOCK     = '### [INFO] Missing Contact\n\nDetails.';
const NON_FINDING    = '## Governance Score\nScore: 8.5';

describe('splitIntoBlocks', () => {
  it('splits multiple severity blocks', () => {
    const content = [CRITICAL_BLOCK, WARNING_BLOCK, INFO_BLOCK].join('\n---\n');
    const blocks = splitIntoBlocks(content);
    expect(blocks).toHaveLength(3);
    expect(blocks[0].severity).toBe('CRITICAL');
    expect(blocks[1].severity).toBe('WARNING');
    expect(blocks[2].severity).toBe('INFO');
  });

  it('returns null severity for non-finding content', () => {
    const blocks = splitIntoBlocks(NON_FINDING);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].severity).toBeNull();
  });

  it('handles mixed content: non-finding followed by findings', () => {
    const content = [NON_FINDING, CRITICAL_BLOCK, WARNING_BLOCK].join('\n---\n');
    const blocks = splitIntoBlocks(content);
    expect(blocks).toHaveLength(3);
    expect(blocks[0].severity).toBeNull();
    expect(blocks[1].severity).toBe('CRITICAL');
    expect(blocks[2].severity).toBe('WARNING');
  });

  it('handles empty string', () => {
    const blocks = splitIntoBlocks('');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe('');
    expect(blocks[0].severity).toBeNull();
  });

  it('preserves block text content', () => {
    const blocks = splitIntoBlocks(CRITICAL_BLOCK);
    expect(blocks[0].text).toBe(CRITICAL_BLOCK);
  });

  it('does not split on partial/incomplete severity headers', () => {
    const content = '### [CRITI\nSome content\n### [WARNING] Real warning';
    const blocks = splitIntoBlocks(content);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].severity).toBeNull();  // Not matched
    expect(blocks[1].severity).toBe('WARNING');
  });
});
```

---

## 5. Test considerations

### Which existing tests might break?

The structural change from a single ReactMarkdown to per-block ReactMarkdown instances **does not break any existing tests** because:

- All text content is still in the DOM at the same positions relative to parent elements like `.font-mono`.
- `screen.getByText()` queries the entire document and still works.
- `container.querySelectorAll('mark.search-highlight')` still finds `<mark>` elements regardless of DOM nesting.
- The streaming cursor is still after all blocks.
- The ScrollButton is still after all blocks.

### What NOT to test

- **Clipboard API failure case**: The existing pattern silently ignores errors. Trust that `navigator.clipboard.writeText` either resolves or throws.
- **Per-block ReactMarkdown rendering details**: Trust that each block is valid markdown and renders correctly through ReactMarkdown, just as the single-string version did.
- **CSS hover visibility**: The `opacity-0 group-hover:opacity-100` pattern is a visual concern; tests access the button directly via `getByLabelText`.

---

## 6. Edge cases

| Edge case | Handling |
|-----------|----------|
| Empty content | `filteredContent` is empty, `splitIntoBlocks('')` returns `[{ text: '', severity: null }]`, one block rendered with no copy button |
| Only non-finding content | Single block with `severity: null`, no copy button rendered |
| One finding block | Single block with severity, copy button rendered on that block |
| Search active when copying | `block.text` is the raw (unhighlighted) text; clipboard gets clean text, no `<mark>` tags |
| Streaming new blocks | Blocks are recomputed on each render; `copiedBlockText` uses text content (not index) so visual feedback stays on the correct block |
| Two blocks with identical text | Both show copied feedback simultaneously — acceptable, and vanishingly unlikely for audit findings |
| Very many blocks (>50) | Each block gets a ReactMarkdown instance; negligible overhead for typical report sizes (usually <50 findings) |
| Copy during streaming | Button renders immediately; if block text is partial (streaming chunk in middle) the user can copy partial content — same as copy-all behavior |

---

## 7. Implementation Order

1. Add `splitIntoBlocks` export to `frontend/src/utils/filterMarkdown.ts`
2. Create `frontend/src/utils/__tests__/splitIntoBlocks.test.ts`
3. Modify `frontend/src/components/features/ResultPanel.tsx`:
   - Add imports for `splitIntoBlocks`
   - Add `copiedBlockText` state and `handleCopyBlock` callback
   - Replace single ReactMarkdown with per-block rendering including copy icon
4. Add test cases to `frontend/src/components/features/__tests__/ResultPanel.test.tsx`
5. Run `npx tsc --noEmit && npx vitest run` — ensure all tests pass (existing + new)
6. Manual smoke test: run an audit, hover over a finding, click copy icon, verify clipboard content, verify checkmark feedback
