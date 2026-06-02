# Feature: Export as PDF — Generate a downloadable PDF report from the audit result

## Open Questions

1. **Filename convention for the PDF?** Spec currently uses `specaudit-report-<timestamp>.pdf` to match the existing `.md` download pattern. Confirm or propose alternative.

2. **Should the PDF include a header/title line** (e.g. "SpecAudit Audit Report" + date), or should it be a pixel-perfect capture of the rendered markdown as it appears in `ResultPanel`? The spec below assumes a **styled capture** (mirroring the on-screen look). This risks fragility with long content. If a simple text-only PDF is preferred, swap the approach to render markdown via a plain-HTML template instead of capturing the DOM. Flagging for decision.

3. **Should the button show a loading/spinning state** during PDF generation (which can take 1–3 seconds for long reports)? The spec below adds a local `pdfLoading` state and disables the button + shows "Exporting…" text while generating.

---

## Overview

Add an **"Export PDF"** button alongside the existing **"Download"** (Markdown) button in `App.tsx`. When clicked, the button captures the rendered markdown content (including severity blocks, code blocks, headings, etc.) as a multi-page PDF and triggers a browser download.

---

## Files to Create or Modify

### 1. `frontend/src/App.tsx` — **modify**

#### Changes:

1. **Add** `pdfLoading` local state:
   ```ts
   const [pdfLoading, setPdfLoading] = useState(false);
   ```

2. **Add** `handleExportPdf` callback (pattern-copy from `handleDownload`):

   ```ts
   const handleExportPdf = useCallback(async () => {
     if (!state.result || pdfLoading) return;
     setPdfLoading(true);
     try {
       await exportPdf(state.result);
     } catch {
       // PDF generation failed — silently ignore (UI stays usable)
     } finally {
       setPdfLoading(false);
     }
   }, [state.result, pdfLoading]);
   ```

3. **Add** the "Export PDF" Button **after** the existing Download button (inside the `{state.result && (...)}` fragment, line 80–104):

   ```tsx
   <Button
     variant="ghost"
     size="sm"
     disabled={state.status === 'streaming' || pdfLoading}
     onClick={handleExportPdf}
   >
     <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
       <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
       <polyline points="14 2 14 8 20 8" />
       <line x1="16" y1="13" x2="8" y2="13" />
       <line x1="16" y1="17" x2="8" y2="17" />
       <polyline points="10 9 9 9 8 9" />
     </svg>
     {pdfLoading ? 'Exporting…' : 'Export PDF'}
   </Button>
   ```

4. **Import** the new `exportPdf` function at the top of the file:
   ```ts
   import { exportPdf } from './utils/exportPdf';
   ```

**Pattern reference:** The existing `handleDownload` (lines 27–41) and its corresponding `<Button>` (lines 90–102) serve as the template for the new `handleExportPdf` callback and button.

---

### 2. `frontend/src/utils/exportPdf.ts` — **create**

New utility module that encapsulates all PDF generation logic.

#### Exported function signature:

```ts
/**
 * Converts markdown content into a multi-page PDF document and triggers
 * a browser download.
 *
 * @param content - Raw markdown string (same as state.result)
 * @param filename - Optional output filename (default: `specaudit-report-<timestamp>.pdf`)
 */
export async function exportPdf(
  content: string,
  filename?: string
): Promise<void>
```

#### Implementation approach:

1. **Create a hidden off-screen container** with the same Tailwind-like styling as `ResultPanel` (severity blocks, code blocks, headings, paragraphs). This avoids modifying the visible DOM.
   - Use `document.createElement('div')`
   - Set `position: fixed; left: -9999px; top: 0; width: 800px;` (standard A4-like width for capture)
   - Apply inline styles that mirror the dark-theme appearance (bg-slate-950, text-slate-200, font-mono, etc.)
   - Render markdown to HTML **without** `ReactMarkdown` (since we're outside React) — instead, do simple regex replacements to mirror the same severity-block, code-block, heading structure as `ResultPanel`. However, to keep it simple and avoid duplicating full markdown parsing:

   **Alternative (recommended for simplicity):** Render the raw content into a `<pre>` or styled `<div>` with `white-space: pre-wrap` that preserves the markdown formatting, then capture that. This avoids reimplementing the ReactMarkdown pipeline in pure JS.

   **Better alternative (preferred):** Use a minimal client-side markdown-to-HTML conversion (e.g., use the `marked` library or write a lightweight converter that handles the severity-prefix patterns). Given the risk notes about fragility, the **spec recommends using `marked`** (a well-known, lightweight Markdown parser) to convert the content to HTML before injecting it into the hidden container. This gives a styled PDF without needing html2canvas to capture React-rendered DOM.

   **However**, to keep dependencies minimal and match the "capture" spirit, the spec below uses `html2canvas` + `jspdf` on a **hidden container that runs the same markdown through `marked`** for HTML conversion.

2. **Convert markdown to HTML** using a minimal parser:
   - Parse `[CRITICAL]`, `[WARNING]`, `[INFO]` headings into the same severity-block structure (with inline `border-left-color`, `background-color`, badge label).
   - Parse fenced code blocks (```language → `<pre><code>`)
   - Parse `#` / `##` / `###` headings
   - Parse `**bold**`, inline `` `code` ``
   - Everything else rendered as plain text

3. **Inject HTML into the hidden container**, append to `document.body`.

4. **Capture the container** with `html2canvas`:
   ```ts
   const canvas = await html2canvas(container, {
     scale: 2,           // retina-quality capture
     useCORS: false,      // no external images
     backgroundColor: '#020617', // slate-950
     allowTaint: false,
     logging: false,
   });
   ```

5. **If the canvas is tall** (content exceeds one page), split it into page-sized chunks:
   - A4 proportions: 210mm × 297mm → at 96 DPI → ~794px × 1123px per page
   - Use `canvas.getContext('2d').getImageData()` and `drawImage()` to extract page slices
   - For each page slice, create a new `jsPDF` page and add the sliced image via `addImage`

6. **Generate PDF** using `jspdf`:
   ```ts
   const pdf = new jspdf.jsPDF({ unit: 'px', format: 'a4' });
   const pageWidth = pdf.internal.pageSize.getWidth();
   const pageHeight = pdf.internal.pageSize.getHeight();
   const imgData = canvas.toDataURL('image/png');
   // ... slice and addImage for each page
   pdf.save(filename ?? `specaudit-report-${Date.now()}.pdf`);
   ```

7. **Clean up**: remove the hidden container from the DOM.

#### Edge cases the implementation must handle:

| Scenario | Expected behavior |
|----------|------------------|
| **Empty content** (`content === ''`) | Return immediately without generating PDF (no-op). |
| **Very long content** (e.g., 200+ findings) | Split across multiple A4 pages; no content clipped at page boundary. |
| **Narrow/normal output** | Canvas captured at 800px width; PDF uses A4 portrait. |
| **Severity blocks with long text** | Allow text to wrap within the block width; no horizontal overflow. |
| **Code blocks with long lines** | `overflow-x: auto` / `word-break: break-all` in the hidden container; jspdf captures the full rendered width. |
| **Special characters** (Unicode, emoji, HTML entities) | The markdown content is already plain text; html2canvas renders it as-is. |
| **Multiple sequential code blocks** | Each code block renders as a separate `<pre>`; no merging. |
| **Concurrent clicks** | `pdfLoading` state disables the button; no double-generation. |
| **Browser without Canvas support** (very old browsers) | The `try/catch` in `handleExportPdf` silently swallows the error; UI remains usable. |
| **Large content causing long generation** | Generation runs asynchronously; UI thread is not blocked. Button shows "Exporting…" during generation. |
| **jsPDF or html2canvas not available** (import failure) | The build-time TypeScript check covers imports; runtime failure caught by `try/catch`. |

---

### 3. `frontend/package.json` — **modify**

Add dependencies:

```json
"dependencies": {
  ...existing,
  "html2canvas": "^1.4.1",
  "jspdf": "^2.5.2"
}
```

Run `npm install` after editing (or let the Coder handle it).

---

## Existing Patterns to Follow

| Pattern | File to reference | How to apply |
|---------|-------------------|--------------|
| Download button placement | `App.tsx` lines 90–102 | Add Export PDF button right after Download, same variant/size (`ghost`, `sm`) |
| Handlers in App.tsx | `handleDownload` (lines 27–41) | Copy the pattern: `useCallback` wrapping an async-safe function, `try/catch`, no user feedback on failure |
| Loading/disabled state | `handleDownload` disable condition (line 86) | Reuse `state.status === 'streaming'` + add `pdfLoading` |
| Utility module location | `parseSeverity.ts` at `frontend/src/utils/parseSeverity.ts` | New file at `frontend/src/utils/exportPdf.ts` |
| Button component usage | `Button.tsx` | Use `<Button variant="ghost" size="sm">` consistently |
| SVG icon in button | Download button SVG (lines 96–100) | Use a document/page SVG icon for the PDF button |

---

## Testing (spec-only — not implementing tests)

The Coder should add a minimal test file at `frontend/src/utils/__tests__/exportPdf.test.ts` that:
- Verifies the function is defined and callable
- Verifies it throws/returns on empty content without calling html2canvas
- Uses a mock for `html2canvas` and `jspdf` to verify the multi-page slicing logic (if time allows)

The Coder should also update `frontend/src/components/features/__tests__/App.test.tsx` to verify the Export PDF button renders when `state.result` is non-empty and is disabled during streaming.

---

## Summary of Changes

| File | Action |
|------|--------|
| `frontend/package.json` | Add `html2canvas` and `jspdf` to `dependencies` |
| `frontend/src/utils/exportPdf.ts` | **Create** — utility for PDF generation |
| `frontend/src/App.tsx` | **Modify** — add `pdfLoading` state, `handleExportPdf` callback, and Export PDF button |
| `frontend/src/utils/__tests__/exportPdf.test.ts` | **Create** — unit tests for export logic |
| `frontend/src/components/features/__tests__/App.test.tsx` | **Modify** — add test for new button |
