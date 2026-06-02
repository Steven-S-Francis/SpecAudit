# Changes Summary

## Overview
Replaced `html2pdf.js` (DOM screenshot-based PDF generation) with `pdfmake` (native declarative PDF generation). The markdown content is parsed line-by-line and converted into pdfmake's content array format — no DOM elements, no `html2canvas`, no screenshots.

## Files Modified

### 1. `frontend/package.json`
- **Removed** `html2pdf.js` from `dependencies`
- **Added** `pdfmake` to `dependencies`
- **Added** `@types/pdfmake` to `devDependencies`

### 2. `frontend/src/utils/exportPdf.ts` (rewritten)
- **Removed** all html2pdf.js / html2canvas / DOM manipulation code
- **Added** pdfmake with VFS font setup (`addVirtualFileSystem`)
- **Exported** `exportPdf(content, filename?)` — unchanged signature
- **Exported** `markdownToContent(markdown)` — converts markdown to pdfmake content array
- **Implemented** full markdown-to-pdfmake mapping:
  - Title block (SpecAudit Report + timestamp)
  - h1 headings (`# Title`) — fontSize 18, bold
  - h2 headings (`## Title`) — fontSize 14, bold
  - Severity blocks (`### [CRITICAL|WARNING|INFO] Title`) — 3-column tables with `noBorders` layout
  - Fenced code blocks — dark background (`#1e293b`)
  - Inline code — amber background (`#f1f5f9`, `#b45309`)
  - Bold (`**text**`) — `bold: true`
  - Horizontal rules (`---`) — canvas line
  - Regular paragraphs with inline formatting parsing
- **Document structure**: pageSize A4, pageMargins [40,60,40,60], defaultStyle Roboto
- **Error handling**: empty content returns early; errors propagate naturally (caller catches)

### 3. `frontend/src/utils/__tests__/exportPdf.test.ts` (rewritten)
- **Removed** html2pdf.js mock
- **Added** pdfmake mock with `createPdf`, `addVirtualFileSystem`, `fonts`
- **Added** vfs_fonts mock
- **25 test cases** covering:
  - Function exports
  - Early return on empty content
  - Correct docDefinition structure (pageSize A4, content array)
  - Custom and default filename formats
  - Title block inclusion
  - Severity block → table with noBorders
  - Code block → text with background
  - h1/h2 conversion
  - Horizontal rule → canvas
  - Inline bold and inline code parsing
  - Plain paragraph (simple form)
  - Inline code at start/end of line
  - Empty line skipping
  - Mixed content ordering
  - Error propagation (createPdf throws, download rejects)

### 4. `frontend/src/components/features/__tests__/App.test.tsx`
- **Added** `vi.mock('../../../utils/exportPdf', () => ({ exportPdf: vi.fn() }))` at the top
- **Added** import for `exportPdf` from the mocked module
- **Added** test: "calls exportPdf on Export PDF button click" — verifies the button correctly invokes `exportPdf` with `state.result`

### 5. `frontend/vite.config.ts`
- **Added** `optimizeDeps.exclude: ['pdfmake']` to prevent Vite from pre-bundling the pdfmake deep import

## TypeScript Adjustments
- pdfmake 0.3.x @types describe named exports, but the UMD build provides a default export with `createPdf`, `addVirtualFileSystem`, etc. as instance methods.
- Used an `PdfMakeInstance` interface with type assertion at module level to match runtime shape.
- Used `addVirtualFileSystem(pdfFonts)` (correct API for pdfmake 0.3.x) instead of `pdfMake.vfs = pdfFonts.vfs`.

## Verification Results
| Step | Status |
|------|--------|
| `npm install` | ✅ Passed |
| `npx tsc --noEmit` | ✅ Zero errors |
| `npx vitest run` | ✅ 105 tests pass (13 files) |
| `npm run build` | ✅ Build succeeds |
| `docker compose build` | ⏭️ Skipped (builds backend only, no frontend impact) |

## Tester Focus Areas

1. **Export PDF button wiring**: Click "Export PDF" in the UI and verify a PDF file is downloaded with actual content (not blank).
2. **Severity blocks**: Verify `CRITICAL`, `WARNING`, and `INFO` blocks render correctly with colored left-border accent.
3. **Code blocks**: Verify fenced code blocks have dark background.
4. **Headings**: Verify h1/h2 rendering with proper font sizes.
5. **Inline formatting**: Verify **bold** and `inline code` render correctly within paragraphs.
6. **Empty content**: Verify clicking Export PDF with no results does nothing.
7. **Long content**: Verify multi-page PDFs render correctly (pdfmake handles pagination automatically).
8. **Unicode/special chars**: Verify special characters render correctly in the PDF.

## Deviations from Spec

1. **`@types/pdfmake` version**: The spec says `^0.3.7` but latest available is `0.3.3`. Used `^0.3.0`.
2. **`pdfmake` version**: The spec says `^0.3.7` but latest is `0.3.9`. Used `^0.3.9`.
3. **VFS font setup**: The spec pattern `pdfMake.vfs = pdfFonts.vfs` doesn't work with pdfmake 0.3.x. Used `pdfMake.addVirtualFileSystem(pdfFonts)` instead, which is the correct API for this version.
4. **Import pattern**: The spec uses `import pdfMake from 'pdfmake/build/pdfmake'` with no type mention. Due to mismatch between runtime (UMD default export) and types (named exports), a local `PdfMakeInstance` interface was added with module-level type assertion for type safety.
5. **`markdownToContent` return type**: The spec uses `Record<string, unknown>[]` but pdfmake's `TDocumentDefinitions.content` expects `Content` type. Used `unknown` bridging cast at the boundary.
