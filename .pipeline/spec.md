# Export as Markdown Download Button

## Open Questions
None.

## Overview

Add a "Download" button next to the existing "Copy" button in the "Audit Results" header. Clicking it downloads the audit result as a `.md` file using a blob URL and a temporary `<a>` element.

## Implementation

### File to modify: `frontend/src/App.tsx`

**Pattern to follow:** The existing `handleCopy` callback and its associated `<Button>` at lines 17–25 and 64–73. The download button will sit alongside it with identical visibility/disabling rules.

**Changes:**

1. Add a `handleDownload` callback using `useCallback`:
   ```ts
   const handleDownload = useCallback(() => {
     try {
       const blob = new Blob([state.result], { type: 'text/markdown;charset=utf-8' });
       const url = URL.createObjectURL(blob);
       const a = document.createElement('a');
       a.href = url;
       a.download = `specaudit-report-${Date.now()}.md`;
       document.body.appendChild(a);
       a.click();
       document.body.removeChild(a);
       URL.revokeObjectURL(url);
     } catch {
       // Download API unavailable — silently ignore
     }
   }, [state.result]);
   ```

2. Add a `<Button variant="ghost" size="sm">` **after** the Copy button (inside the same `{state.result && (...)}` block):
   - Label: `Download`
   - `disabled` when `state.status === 'streaming'`
   - `onClick={handleDownload}`
   - SVG download icon before the text

**Download icon SVG:**
```svg
<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
  <polyline points="7 10 12 15 17 10" />
  <line x1="12" y1="15" x2="12" y2="3" />
</svg>
```

### Test changes

**File modified:** `frontend/src/components/features/__tests__/App.test.tsx`

Add new `describe('App Download Button', () => { ... })` block following the existing pattern of `describe('App Copy Button', ...)`.

**New tests (4):**
1. **Hides Download button when result is empty** — mock idle state, assert `screen.queryByText('Download')` is null
2. **Shows Download button when result has content** — mock complete state with result, assert `screen.getByText('Download')` is in document
3. **Disables Download button when streaming** — mock streaming state, assert button is disabled
4. **Downloads file on click** — mock `URL.createObjectURL`, `URL.revokeObjectURL`, mock `document.createElement('a')`, click the download button, assert blob is created with correct content and type, assert `<a>` is clicked with correct download filename

## Files Changed

- **MODIFIED:** `frontend/src/App.tsx`
- **MODIFIED:** `frontend/src/components/features/__tests__/App.test.tsx`
