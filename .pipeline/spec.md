# Spec: Replace html2pdf.js with pdfmake (Native PDF Generation)

## Overview

The "Export PDF" feature produces a blank file because `html2pdf.js` uses `html2canvas` (DOM screenshot), which cannot reliably render off-screen elements. The fundamental fix is to **replace the screenshot-based approach** with a **native PDF generation library** that builds PDFs from data, not from DOM screenshots.

**Approach:** Replace `html2pdf.js` with `pdfmake`, which generates PDFs from a declarative JSON document definition. The markdown content is parsed line-by-line and converted into pdfmake's content array format. No DOM elements, no screenshot, no `html2canvas` — the PDF is generated natively by the library.

---

## OPEN QUESTIONS

1. **pdfmake import with Vite:** The standard import `import pdfMake from 'pdfmake/build/pdfmake'` is a deep import that may conflict with Vite's dependency pre-bundling. If Vite complains, add `'pdfmake'` to `optimizeDeps.exclude` in `vite.config.ts`. The build agent should verify and fix this.
2. **VFS fonts import:** The default pdfmake build requires `vfs_fonts.js` (Roboto). The import pattern depends on the pdfmake version. The build agent should try: `import pdfFonts from 'pdfmake/build/vfs_fonts'; pdfMake.vfs = pdfFonts.vfs;` and adjust if the structure differs (e.g., `pdfFonts.pdfMake.vfs` or using `pdfMake.addVirtualFileSystem(pdfFonts)` instead).

---

## Files to Modify

| File | Action |
|---|---|
| `frontend/package.json` | **Modify** — replace `html2pdf.js` dependency with `pdfmake` and `@types/pdfmake` |
| `frontend/src/utils/exportPdf.ts` | **Rewrite** — complete replacement (remove all DOM/`html2canvas` code, add pdfmake docDefinition builder) |
| `frontend/src/utils/__tests__/exportPdf.test.ts` | **Rewrite** — mock pdfmake instead of html2pdf.js |
| `frontend/vite.config.ts` | **Possibly modify** — add `'pdfmake'` to `optimizeDeps.exclude` if deep import fails |
| `frontend/src/components/features/__tests__/App.test.tsx` | **No change** — `exportPdf` interface is unchanged |

### Not modified (interface is stable)
- `frontend/src/App.tsx` — imports and calls `exportPdf(result)` which is unchanged
- Any other file — `exportPdf` is only imported in `App.tsx`

---

## Detailed Design

### 1. Dependency Changes (`package.json`)

```diff
- "html2pdf.js": "^0.14.0",
+ "pdfmake": "^0.3.7",
...
+ "@types/pdfmake": "^0.3.7",
```

### 2. New `exportPdf.ts` — Signature (unchanged)

```ts
export async function exportPdf(content: string, filename?: string): Promise<void>
```

Same signature. `content` is the raw markdown string. `filename` defaults to `specaudit-report-<timestamp>.pdf`.

### 3. Internal Structure

The file should export one public function and one (testable) internal function:

```ts
export async function exportPdf(content: string, filename?: string): Promise<void>

// Exported for testing only — converts markdown to pdfmake content array
export function markdownToContent(markdown: string): Record<string, unknown>[]
```

### 4. Markdown → pdfmake Content Mapping

Each markdown element maps to a specific pdfmake content node:

#### Title Block
Generated at the top of every PDF:
```ts
{
  stack: [
    { text: 'SpecAudit Report', fontSize: 22, bold: true, color: '#1e40af', margin: [0, 0, 0, 4] },
    { text: `Generated ${new Date().toLocaleString()}`, fontSize: 10, color: '#64748b', margin: [0, 0, 0, 24] },
  ],
}
```

#### h1 Headings (`# Title`)
```ts
{ text: 'Title', fontSize: 18, bold: true, margin: [0, 16, 0, 8], color: '#0f172a' }
```

#### h2 Headings (`## Title`)
```ts
{ text: 'Title', fontSize: 14, bold: true, margin: [0, 14, 0, 6], color: '#0f172a' }
```

#### Severity Blocks (`### [CRITICAL] Title`)
Rendered as a 3-column table with `layout: 'noBorders'`:
- Column 1: 4px wide, `fillColor` = severity color (acts as left border)
- Column 2: `'auto'` width, severity badge text, matching severity color
- Column 3: `'*'` width, title text, matching severity color

```ts
{
  table: {
    widths: [4, 'auto', '*'],
    body: [[
      { text: '', fillColor: '#ef4444' },
      { text: 'CRITICAL', fillColor: '#fef2f2', color: '#dc2626', bold: true, fontSize: 10, margin: [6, 4, 6, 4] },
      { text: 'Description text', fillColor: '#fef2f2', color: '#dc2626', bold: true, fontSize: 11, margin: [0, 4, 8, 4] },
    ]],
  },
  layout: 'noBorders',
  margin: [0, 6, 0, 6],
}
```

Color mapping:
| Severity | Border/Badge | Background |
|---|---|---|
| `CRITICAL` | `#ef4444` / `#dc2626` | `#fef2f2` |
| `WARNING` | `#f59e0b` / `#d97706` | `#fffbeb` |
| `INFO` | `#3b82f6` / `#2563eb` | `#eff6ff` |

#### Fenced Code Blocks (```` ``` ````)
```ts
{
  text: 'code content here',
  background: '#1e293b',
  color: '#e2e8f0',
  fontSize: 9,
  margin: [0, 8, 0, 8],
  // pdfmake preserves whitespace by default for text nodes
}
```
Note: No monospace font available in default Roboto-only setup. Code blocks are visually distinct via dark background and light text color.

#### Inline Code (`` `code` ``)
Handled as part of paragraph parsing (see below). Rendered with `background: '#f1f5f9'` and `color: '#b45309'`.

#### Bold (`**text**`)
Handled as part of paragraph parsing. Rendered with `bold: true`.

#### Horizontal Rules (`---`)
```ts
{
  canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#e2e8f0' }],
  margin: [0, 12, 0, 12],
}
```

#### Regular Paragraphs (plain text lines)
- Lines that don't match any special pattern
- Parse inline **bold** and `inline code` within the line
- Use pdfmake's inline styling via mixed array:

```ts
{
  text: [
    { text: 'Regular text before ' },
    { text: 'bold text', bold: true },
    { text: ' and ' },
    { text: 'inline code', background: '#f1f5f9', color: '#b45309' },
    { text: '.' },
  ],
  fontSize: 11,
  lineHeight: 1.5,
  margin: [0, 4, 0, 4],
}
```

Implementation approach for inline parsing:
- Use regex split: split on `(\*\*[^*]+\*\*|`[^`]+`)` to get tokens
- Each token is either plain text, **bold** (strip `**`, set `bold: true`), or `inline code` (strip backticks, set background/color)
- If a line has no inline formatting, render as `{ text: line, ... }` (simple form)

Edge case for paragraphs: **skip empty lines** and lines that were already consumed by severity/code-block processing.

### 5. `exportPdf` Function Logic

```
1. Guard: if (!content) return
2. Import pdfmake and set up VFS fonts
3. Call markdownToContent(content) to build content array
4. Build docDefinition:
   {
     pageSize: 'A4',
     pageMargins: [40, 60, 40, 60],
     info: {
       title: 'SpecAudit Report',
       author: 'SpecAudit',
       subject: 'OpenAPI Contract Audit Report',
     },
     content: [
       titleBlock,
       ...markdownToContent(content),
     ],
     defaultStyle: {
       font: 'Roboto',
       fontSize: 11,
       color: '#334155',
     },
   }
5. Call pdfMake.createPdf(docDefinition).download(filename)
6. If error, throw (caller in App.tsx catches and ignores)
```

### 6. Error Handling

- If `pdfMake.createPdf` or `.download()` throws, re-throw the error (caller in `App.tsx` already wraps in try/catch that silently ignores)
- If `content` is empty string, return immediately (no-op)

---

## Tests

### Mock Strategy

The test mocks `pdfmake/build/pdfmake` and provides a `createPdf` spy. No VFS fonts needed in tests.

```ts
vi.mock('pdfmake/build/pdfmake', () => {
  const mockDownload = vi.fn().mockResolvedValue(undefined);
  const mockCreatePdf = vi.fn(() => ({ download: mockDownload }));
  return {
    default: {
      createPdf: mockCreatePdf,
      vfs: {},
      fonts: {},
    },
  };
});
```

### Test Cases for `exportPdf.test.ts`

1. **exports `exportPdf` and `markdownToContent`** — both are callable functions
2. **`exportPdf` returns early when content is empty** — no `createPdf` call
3. **`exportPdf` creates PDF with correct content** — `createPdf` called once; docDefinition has expected structure (pageSize A4, has content array)
4. **Custom filename is used** — `.download()` called with custom name
5. **Default filename format** — `.download()` called with name matching `specaudit-report-\d+\.pdf`
6. **Title block is included** — first content element has 'SpecAudit Report' text
7. **Severity block is converted to table** — severity `### [CRITICAL] Test` produces a table content node with `noBorders` layout
8. **Code block is converted** — code in backticks produces a text node with `background` property
9. **Heading h1 is converted** — `# Title` produces a bold text node with `fontSize: 18`
10. **Heading h2 is converted** — `## Title` produces a bold text node with `fontSize: 14`
11. **Horizontal rule is converted** — `---` produces a canvas node with a line
12. **Inline bold is parsed** — `**bold**` in a paragraph produces a bold text segment
13. **Inline code is parsed** — `` `code` `` in a paragraph produces a text segment with `background`
14. **Error propagation** — if `createPdf` throws, `exportPdf` rejects with the same error

### Test Cases for `App.test.tsx` Export PDF section

No changes needed. The existing 3 tests (hides when empty, shows when content, disables when streaming) test the button behavior, which is unchanged. The mock of `exportPdf` is already implicit (it's `vi.fn()` or the real implementation). Actually, the App tests use the real `exportPdf` import. Since `exportPdf` is async and calls pdfmake internally, we should mock it:

Add to `App.test.tsx`:
```ts
vi.mock('../../../utils/exportPdf', () => ({
  exportPdf: vi.fn(),
}));
```

And add a test that verifies `exportPdf` is called when the Export PDF button is clicked:
- Click Export PDF button
- Assert `exportPdf` was called with `state.result` as first argument

This ensures the button-to-function wiring is tested.

---

## Edge Cases

### 1. Empty content
Early return in `exportPdf` — no pdfmake call, no error.

### 2. Content with only severity blocks
All severity blocks map to tables; no plain paragraphs. Should work fine.

### 3. Mixed content (severity + code + text)
Each line type is processed independently. Last-incomplete-code-block edge case: if a code fence is opened but not closed, treat everything from the opening ``` to end of content as a code block.

### 4. Code blocks with language annotation
The regex should handle ```` ```yaml ```` — the language tag is ignored (for now).

### 5. Consecutive horizontal rules
Each `---` on its own line produces a canvas line. Multiple consecutive HRs produce stacked thin lines, which is acceptable.

### 6. Very long content (multi-page)
pdfmake handles page breaks automatically. No special handling needed.

### 7. Special characters (HTML entities, Unicode)
pdfmake handles Unicode text natively. No HTML escaping needed (unlike the old approach which escaped for HTML injection). The markdown is passed as-is to pdfmake text nodes.

### 8. Inline code at start/end of paragraph
The regex split should handle leading/trailing inline tokens. Test with `\`code\` starts the line` and `ends with \`code\``.

### 9. Bold inside inline code (nested)
Our markdown never produces this (AI output has consistent formatting), but the regex should handle it gracefully. Bold-pattern inside backticks should be treated as code, not bold. Priority: code backticks take precedence.

**Implementation hint:** When parsing inline tokens, first extract code spans (backtick-delimited), then parse bold in the remaining text segments.

---

## Verification

| Step | Command | Expected |
|---|---|---|
| 1. Install | `cd frontend && npm install` | No errors |
| 2. TypeScript | `npx tsc --noEmit` in repo root | Zero errors |
| 3. Unit tests | `npm test -- --run` in repo root | All tests pass |
| 4. Build | `npm run build` in `frontend/` | Zero errors |
| 5. Docker | `docker compose build` from repo root | Build succeeds |
| 6. Manual | Click Export PDF in browser | PDF has content, not blank |

---

## Summary

| Aspect | Detail |
|---|---|
| **Current approach** | `html2pdf.js` → `html2canvas` → DOM screenshot → PDF |
| **Problem** | Screenshot-based: fragile, blank on off-screen elements, requires DOM manipulation |
| **New approach** | `pdfmake` → declarative JSON docDefinition → native PDF |
| **Benefits** | No DOM, no screenshots, reliable multi-page, smaller bundle after removing html2pdf.js |
| **Files changed** | `package.json`, `exportPdf.ts`, `exportPdf.test.ts`, possibly `vite.config.ts` |
| **Risk** | Medium — complete replacement of core logic, but interface unchanged (App.tsx unaffected) |
| **Key complexity** | Markdown-to-pdfmake content converter must handle all formatting variants |
