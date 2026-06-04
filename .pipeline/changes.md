# Changes Made — Spec File Upload Feature

## Files Modified

### 1. `frontend/src/components/features/InputPanel.tsx`

**What changed:** Added drag-and-drop file upload zone and file picker support above the existing textarea.

**Specific changes:**
- **Imports:** Updated `useState` import to include `useRef`; added `Spinner` import from `../ui/Spinner`
- **New state variables:** `dragOver`, `fileInfo` (name + size), `fileLoadStatus` ('idle' | 'loading' | 'error'), `fileError`, and `fileInputRef`
- **Helper functions:** `isValidFile` (checks .yaml/.yml/.json extensions), `formatFileSize` (human-readable byte sizes), `handleFile` (validates extension/size, reads via FileReader, populates textarea)
- **Drag event handlers:** `handleDragOver`, `handleDragLeave`, `handleDrop` (prevents defaults, toggles `dragOver` state, processes first dropped file)
- **File input handler:** `handleFileInputChange` for the hidden `<input type="file">`
- **New JSX:** Drag-and-drop zone div with dashed border, conditional content (loading spinner, file info with name+size, or default "Browse files" text), hidden file input, and error message banner with alert icon
- **No existing functionality was modified** — the textarea, format buttons, Run/Stop buttons, and character counter remain unchanged

### 2. `frontend/src/components/features/__tests__/InputPanel.test.tsx`

**What changed:** Added 12 test cases for the file upload feature.

**Specific changes:**
- Added `act` to the `@testing-library/react` import
- Added helper functions: `getDropZone()` (finds zone via the hidden file input's parent), `setupMockFileReader()` (uses a `MockFileReader` class that tracks all instances)
- **12 new test cases:**
  1. Renders drag-and-drop zone with instruct text
  2. Clicking drag zone opens file picker (verify hidden input exists)
  3. Shows file info (name + size) after dropping a valid .yaml file
  4. Shows file info after dropping a valid .json file
  5. Populates textarea with file content after drop
  6. Shows loading state while reading (with act-wrapped callback)
  7. Shows error for non-YAML/JSON file type
  8. Shows error for file exceeding size limit
  9. Shows error when FileReader fails (with act-wrapped callback)
  10. Drag-over class toggles on dragover/dragleave events
  11. Replacing file works (drop a second file after first)
  12. Browse button triggers hidden input click

**Testing approach:**
- `fireEvent.drop(zone, { dataTransfer: { files: [...] } })` for drag-and-drop
- `setupMockFileReader()` creates a `MockFileReader` class (not `vi.fn()`, to avoid constructor issues) and tracks instances
- All `onload`/`onerror` callback invocations wrapped in `act()` to trigger React state updates
- Tests 7 and 8 (file type and size errors) don't need FileReader since errors occur before reading

## Build & Test Status

- `npm run build` — 0 errors (TypeScript + Vite build passed)
- `npx vitest run` — 257 tests passed across 17 test files (37 InputPanel tests: 25 existing + 12 new)

## Tester Focus

1. Verify drag-and-drop works with real .yaml/.yml/.json files
2. Verify "Browse files" click opens native file picker
3. Verify error states (invalid extension, file too large, read failure)
4. Verify replacing a loaded file via drag works
5. Verify the existing paste-into-textarea flow still works unchanged
