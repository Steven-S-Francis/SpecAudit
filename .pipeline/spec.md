# Spec File Upload (Drag-and-Drop + File Picker)

## Background

Users have OpenAPI spec files (.yaml, .yml, .json) on disk and currently must copy-paste text into a textarea. For large specs this is error-prone (truncation, encoding issues). This feature adds a drag-and-drop zone and a "Browse files" button as alternative input methods.

The existing paste-into-textarea flow remains unchanged — file upload is just an additional way to populate the same textarea.

## Files to Modify

### 1. `frontend/src/components/features/InputPanel.tsx`

**What changes:**
- Add state for: `dragOver` (boolean), `fileInfo` (name + size or null), `fileLoadStatus` (`'idle' | 'loading' | 'error'`), `fileError` (string | null)
- Add a **drag-and-drop zone** (styled `<div>`) above the textarea
- Add a **hidden `<input type="file">`** with `accept=".yaml,.yml,.json"`
- Add a **"Browse files" button** that clicks the hidden file input
- After a file is selected/dropped: validate, read, populate textarea
- Show **file name + size** after selection
- Show **loading state** during FileReader read
- Show **error messages** for invalid type, read failure, or file too large
- Existing `spec`, `format`, `count`, `isOverLimit`, `isEmpty` state remains unchanged

**New internal state (add inside the component function):**

```tsx
const [dragOver, setDragOver] = useState(false);
const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null);
const [fileLoadStatus, setFileLoadStatus] = useState<'idle' | 'loading' | 'error'>('idle');
const [fileError, setFileError] = useState<string | null>(null);
const fileInputRef = useRef<HTMLInputElement>(null);
```

**New helper functions to add inside the component (before the return):**

```tsx
const ALLOWED_EXTENSIONS = ['.yaml', '.yml', '.json'];
const MAX_FILE_SIZE = 500_000; // 500 KB — same spirit as 100k char limit but for raw bytes

function isValidFile(file: File): boolean {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function handleFile(file: File) {
  // Reset state
  setFileError(null);
  setFileLoadStatus('loading');

  // Validate extension
  if (!isValidFile(file)) {
    setFileError(`Unsupported file type. Accepted: .yaml, .yml, .json`);
    setFileLoadStatus('error');
    return;
  }

  // Validate size
  if (file.size > MAX_FILE_SIZE) {
    setFileError(`File too large (${formatFileSize(file.size)}). Max: ${formatFileSize(MAX_FILE_SIZE)}.`);
    setFileLoadStatus('error');
    return;
  }

  // Show file info
  setFileInfo({ name: file.name, size: file.size });

  // Read content
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target?.result;
    if (typeof text === 'string') {
      setSpec(text);
      setFileLoadStatus('idle');
    }
  };
  reader.onerror = () => {
    setFileError('Failed to read file. Please try again.');
    setFileLoadStatus('error');
    setFileInfo(null);
  };
  reader.readAsText(file);
}
```

**Drag-and-drop event handlers (add before the return):**

```tsx
function handleDragOver(e: React.DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  setDragOver(true);
}

function handleDragLeave(e: React.DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  setDragOver(false);
}

function handleDrop(e: React.DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  setDragOver(false);

  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleFile(files[0]);
  }
}

function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
  const files = e.target.files;
  if (files && files.length > 0) {
    handleFile(files[0]);
  }
  // Reset so re-selecting the same file triggers onChange again
  e.target.value = '';
}
```

**New JSX to insert right before the textarea (inside the `<div className="flex flex-col gap-4">`):**

```tsx
{/* Drag-and-drop zone */}
<div
  onDragOver={handleDragOver}
  onDragLeave={handleDragLeave}
  onDrop={handleDrop}
  className={`
    relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
    transition-colors duration-150
    ${dragOver
      ? 'border-indigo-400 bg-indigo-950/30'
      : 'border-slate-600 hover:border-slate-400 bg-slate-900/50'
    }
    light:${dragOver
      ? 'border-indigo-400 bg-indigo-50'
      : 'border-slate-300 hover:border-slate-400 bg-slate-50'
    }
  `}
  onClick={() => fileInputRef.current?.click()}
>
  {/* Hidden file input */}
  <input
    ref={fileInputRef}
    type="file"
    accept=".yaml,.yml,.json"
    className="hidden"
    onChange={handleFileInputChange}
  />

  {fileLoadStatus === 'loading' ? (
    <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
      <Spinner size="sm" />
      Reading file...
    </div>
  ) : fileInfo ? (
    <div className="text-sm text-slate-300">
      <span className="font-medium text-indigo-300">{fileInfo.name}</span>
      <span className="text-slate-500 ml-2">({formatFileSize(fileInfo.size)})</span>
      <span className="block text-xs text-slate-500 mt-1">Click or drag to replace</span>
    </div>
  ) : (
    <>
      <div className="text-slate-400 text-sm">
        <span className="text-indigo-400 font-medium">Browse files</span>
        <span className="text-slate-500"> or drag & drop here</span>
      </div>
      <div className="text-xs text-slate-600 mt-1">Supports .yaml, .yml, .json (max 500 KB)</div>
    </>
  )}
</div>

{/* Error message */}
{fileError && (
  <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/30 border border-red-800/50 rounded-lg px-3 py-2 light:text-red-600 light:bg-red-50 light:border-red-200">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
    {fileError}
  </div>
)}
```

**Imports to add at the top of the file:**
- `import { useState, useRef } from 'react';` (change existing `useState` import to include `useRef`)
- `import { Spinner } from '../ui/Spinner';`

**Note on light mode:** The `light:` prefix class in Tailwind v4 works differently. The spec above shows the intent — implementer must verify the exact Tailwind v4 syntax for light mode variants. If `light:` doesn't work as shown, use standard dark-mode-first classes (the default is dark theme; light mode is the variant). Since this is a dark-first app, the default classes target dark theme, and light variants use `light:` prefix. Adjust if needed based on Tailwind v4 behavior.

**Edge cases this component must handle:**
1. User drops a non-YAML/JSON file → show file type error (do NOT read the file)
2. User drops a file > 500 KB → show size error (do NOT read the file)
3. FileReader fails (extremely rare) → show generic read error
4. User drags a file over the zone but then drags it away → zone visual resets (handleDragLeave)
5. User clicks the zone with no file selected → file picker opens naturally
6. User clicks "Browse files" → file picker opens (hidden input clicked)
7. After file is loaded, user edits textarea content → textarea works as before, fileInfo still shown (user can click to replace)
8. User drops multiple files → only first file is processed (`files[0]`)
9. Empty file → reads as empty string, populates textarea, same as pasting nothing (the Run button will be disabled due to isEmpty)
10. File with encoding other than UTF-8 → `readAsText` defaults to UTF-8; other encodings like UTF-16 may produce garbled text. This is acceptable — user can paste manually. (No action needed.)
11. Race condition: user drops file B while file A is still loading → `handleFile` resets state, only B's content ends up in textarea (by design)

### 2. `frontend/src/components/features/__tests__/InputPanel.test.tsx`

**What changes:** Add test cases for the new file upload functionality.

**New test cases to add:**

```
1. Renders drag-and-drop zone with instruct text
2. Clicking drag zone opens file picker (verify hidden input exists)
3. Shows file info (name + size) after dropping a valid .yaml file
4. Shows file info after dropping a valid .json file
5. Populates textarea with file content after drop
6. Shows loading state while reading (use fake timers + delayed FileReader)
7. Shows error for non-YAML/JSON file type
8. Shows error for file exceeding size limit
9. Shows error when FileReader fails (mock onerror)
10. Drag-over class toggles on dragover/dragleave events
11. Replacing file works (drop a second file after first)
12. Browse button triggers hidden input click
```

Testing approach:
- For drag-and-drop, use `fireEvent.drop(zone, { dataTransfer: { files: [file] } })`
- For file picker, use `fireEvent.change(hiddenInput, { target: { files: [file] } })`
- Use `vi.spyOn` to mock `FileReader` for testing loading/error states
- Use fake file objects: `new File(['content'], 'spec.yaml', { type: 'application/x-yaml' })`

### 3. No changes needed in `frontend/src/App.tsx`

The `App.tsx` passes `onSubmit` to `InputPanel` already. Since we're populating the existing `spec` state (which feeds into the existing textarea), the file content flows through the same `onSubmit` path. **No App.tsx changes required.**

## Existing Patterns to Follow

- **Component style:** Follow the existing `InputPanel.tsx` pattern — function component, inline handlers, Tailwind classes, dark-first theming with `light:` prefix.
- **UI component usage:** Use `<Spinner size="sm" />` for the loading indicator (already imported/used in the project). Use the existing `<Button variant="ghost">` pattern if adding UI buttons.
- **Testing patterns:** Follow existing `InputPanel.test.tsx` — `@vitest-environment jsdom`, `render`, `fireEvent`, `vi.fn()`, `screen.getByText`/`getByRole`.
- **State management:** Keep state local to InputPanel (no lifting up to App needed). The component already owns `spec` state via `useState`.
- **No backend changes:** This is entirely frontend-only.

## Verification

1. `npm run build` — 0 errors (Vite build)
2. `npm test` — all existing InputPanel tests pass, plus new file upload tests
3. Manual: Open app → drag a `spec.yaml` onto the zone → file name+size appear → textarea populated with content → click "Run Audit" → audit runs as before
4. Manual: Click "Browse files" → select a `spec.json` from disk → same result
5. Manual: Drop a `readme.txt` → error message "Unsupported file type" shown
6. Manual: Drop a very large file (>500 KB) → error message "File too large" shown
7. Manual: Drop a valid file → observe loading state (brief) → textarea populated → edit textarea → file info still shown → click zone again to replace
8. Manual: Paste text directly into textarea (file upload path not used) → existing flow unchanged
