# SpecAudit Frontend

React 19 + Vite 8 + Tailwind CSS v4 frontend for the SpecAudit AI-powered API audit tool.

## Setup

```bash
npm install
npm run dev        # starts at http://localhost:5173 (proxies /api to http://localhost:5000)
```

## Key Architecture

- **SSE streaming**: `api/auditClient.ts` — raw `fetch` + `ReadableStream` reader; manual SSE parsing
- **State machine**: `hooks/useAudit.ts` — `idle → loading → streaming → complete → error`
- **Session history**: `hooks/useHistory.ts` — localStorage with LRU eviction at 4 MB
- **Toast system**: `hooks/useToast.ts` + `ToastContainer.tsx` — React context-based notifications
- **Provider config**: `components/ui/ProviderSelector.tsx` — dropdown fetched from `GET /api/providers`
- **Severity filter**: `utils/filterMarkdown.ts` — block splitting at `### ` headings
- **Export**: `utils/exportPdf.ts` — pdfmake; `App.tsx` for clipboard, download, JSON export

## Key Files

| File | Purpose |
|------|---------|
| `src/types/audit.ts` | All TypeScript interfaces |
| `src/api/auditClient.ts` | SSE stream client |
| `src/hooks/useAudit.ts` | Audit state machine |
| `src/hooks/useHistory.ts` | localStorage history |
| `src/hooks/useToast.ts` | Toast/snackbar context |
| `src/hooks/useAutoScroll.ts` | Scroll-to-bottom logic |
| `src/hooks/useTheme.ts` | Dark/light mode |
| `src/App.tsx` | Shell, layout, export handlers |
| `src/components/features/InputPanel.tsx` | Spec input + file upload |
| `src/components/features/ResultPanel.tsx` | Markdown renderer + severity styling |
| `src/components/ui/ProviderSelector.tsx` | Provider/model dropdown |
| `src/components/ui/ToastContainer.tsx` | Toast stack display |
| `src/components/features/HistorySidebar.tsx` | Collapsible history sidebar |

## Tests

~314 tests using vitest + jsdom + testing-library. Run with `npm test`.

## UI Components

- `Button`: `primary | ghost | danger` variants, `sm | md` sizes
- `Card`: Content container with border
- `Spinner`: `sm | md | lg` animated loading indicator
- `ThemeToggle`: Sun/moon icon button
- `ScrollButton`: Up/down floating scroll control
