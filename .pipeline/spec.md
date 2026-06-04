# 5 UX Fixes — Session History Sidebar

Five targeted UX fixes for the History sidebar and its interaction with the main layout.

---

## Fix 1: Better spec preview — extract title from OpenAPI spec

**Problem:** `formatSpecPreview` uses the first 50 raw characters of the spec string, so two different JSON specs both show `{ "swagger": "2.0", "schemes": ["...` as their preview. The `specName` field is never populated (always passed as `null` from App.tsx).

**Solution:** Add a `title` field to `HistoryRecord`, auto-extract `info.title` from JSON OpenAPI specs, and display it as the primary label in the sidebar with a raw-spec subtitle.

### File: `frontend/src/hooks/useHistory.ts`

**1. Add `title` to `HistoryRecord` interface:**
```ts
export interface HistoryRecord {
  id: string;
  timestamp: number;
  spec: string;
  specFormat: 'yaml' | 'json' | null;
  result: string | null;
  specName: string | null;
  title?: string;               // <-- add this
}
```

**2. Add `extractSpecTitle` helper before `useHistory`:**
```ts
/**
 * Try to extract an OpenAPI info.title from the spec string.
 * Returns the title string or null if it can't be determined.
 */
function extractSpecTitle(spec: string): string | null {
  try {
    const parsed = JSON.parse(spec);
    if (parsed && typeof parsed === 'object' && typeof parsed.info?.title === 'string') {
      return parsed.info.title.trim();
    }
  } catch {
    // Not JSON — return null
  }
  return null;
}
```

**3. Update `addRecord` to auto-populate `title`:**
In `addRecord`, after constructing `fullRecord`, if `fullRecord.title` is not set, call `extractSpecTitle(fullRecord.spec)` and assign the result:
```ts
const addRecord = useCallback(
  (
    record: Omit<HistoryRecord, 'id' | 'timestamp'> & {
      id?: string;
      timestamp?: number;
    }
  ): HistoryRecord => {
    const fullRecord: HistoryRecord = {
      ...record,
      id: record.id ?? crypto.randomUUID(),
      timestamp: record.timestamp ?? Date.now(),
      title: record.title ?? extractSpecTitle(record.spec ?? record.spec) ?? undefined,
    };

    setRecords((prev) => {
      const existingIndex = prev.findIndex((r) => r.id === fullRecord.id);
      if (existingIndex !== -1) {
        const updated = [...prev];
        updated[existingIndex] = fullRecord;
        return updated;
      }
      return [fullRecord, ...prev];
    });

    return fullRecord;
  },
  []
);
```
> **Note:** In the `record` parameter, `spec` is always present (it's required on the passed object). The fallback `record.spec ?? record.spec` is just to satisfy TypeScript — it will never be undefined. Use an intermediate variable to simplify.

**Edge cases:**
- If the spec is not valid JSON, `extractSpecTitle` returns `null` and `title` stays `undefined` (not stored in the record).
- If the spec is JSON but has no `info.title` field (or it's not a string), returns `null`.
- YAML specs: title will not be extracted and will remain `undefined`. This is acceptable — the raw preview fallback still works.
- Empty string spec: `JSON.parse('')` throws, returns `null`.

### File: `frontend/src/components/features/HistorySidebar.tsx`

**4. Update `formatSpecPreview` to prefer `title` field:**
Change the function signature and logic:
```ts
function formatSpecPreview(record: HistoryRecord, max = 80): { primary: string; subtitle: string | null } {
  // Prefer extracted title
  if (record.title) {
    return {
      primary: record.title.length > 60 ? record.title.slice(0, 60) + '...' : record.title,
      subtitle: record.spec.length > max ? record.spec.slice(0, max) + '...' : record.spec,
    };
  }
  // Fall back to specName (legacy)
  if (record.specName) {
    return {
      primary: record.specName.length > 60 ? record.specName.slice(0, 60) + '...' : record.specName,
      subtitle: null,
    };
  }
  // Last resort: raw spec preview
  return {
    primary: record.spec.length > max ? record.spec.slice(0, max) + '...' : record.spec,
    subtitle: null,
  };
}
```

**5. Update the JSX that renders a record's display name (line 138-139):**
Replace the single `<p>` with:
```tsx
<div className="flex-1 min-w-0">
  {(() => {
    const { primary, subtitle } = formatSpecPreview(record);
    return (
      <>
        <p className="text-sm font-medium text-slate-200 truncate light:text-slate-700">
          {primary}
          {record.result === null && (
            <span className="text-yellow-400 text-xs ml-2">(pending)</span>
          )}
        </p>
        {subtitle && (
          <p className="text-xs text-slate-500 mt-0.5 truncate light:text-slate-400">
            {subtitle}
          </p>
        )}
      </>
    );
  })()}
  ...
</div>
```

> **Note:** Wrap in an IIFE (or extract a helper component) because you can't call hooks conditionally, and `formatSpecPreview` now returns an object. Alternatively, destructure at the top of the `<li>` body.

**Edge cases:**
- `record.title` is `undefined` → falls back to `specName` then raw spec.
- `record.title` plus `record.spec` > 80 chars → subtitle is truncated with ellipsis.
- No subtitle shown when `specName` or raw-spec fallback is used (matching current behaviour).

---

## Fix 2: Close button overlapping "History" header text

**Problem:** The toggle (X) button is `fixed top-4 left-4 z-50`, positioned at the viewport top-left. When the sidebar is open, this lands inside the sidebar's padded header area, overlapping the "History" title.

**Solution:** Move the close (X) button inside the sidebar's header row, next to the "History" title. The hamburger button moves to App.tsx's page header (handled in Fix 4).

### File: `frontend/src/components/features/HistorySidebar.tsx`

**1. Remove the entire fixed toggle button block** (current lines 55–84). It is replaced by:
- A hamburger button in App.tsx's header (see Fix 4)
- A close (X) button in the sidebar header (below)

**2. Add a close button as the first child of the sidebar header div** (currently line 114):
```tsx
<div className="flex items-center justify-between px-4 pb-3 border-b border-slate-800 light:border-slate-200">
  <div className="flex items-center gap-2">
    {/* Close (X) button — opens/closes sidebar */}
    <button
      onClick={onToggle}
      className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 light:hover:bg-slate-200 light:hover:text-slate-600 transition-colors"
      aria-label="Close history sidebar"
      title="Close history sidebar"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
    <h2 className="text-sm font-semibold text-slate-200 light:text-slate-700">History</h2>
  </div>
  {records.length > 0 && (
    <Button variant="ghost" size="sm" onClick={onClearAll} className="text-red-400 hover:text-red-300 light:text-red-500 light:hover:text-red-600">
      Clear all
    </Button>
  )}
</div>
```

**3. Update backdrop `onClick`** to call `onClose` instead of `setOpen(false)`:
```tsx
{open && (
  <div
    className="fixed inset-0 z-30 bg-black/50 md:hidden"
    onClick={onClose}
    aria-hidden="true"
  />
)}
```

**4. Update Escape key handler** to call `onClose`:
```tsx
const handleEscape = useCallback((e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    onClose?.();
  }
}, [onClose]);
```

**Edge cases:**
- `onClose` may be undefined (consumer doesn't provide it). Use optional chaining `onClose?.()`.
- The header `button` calls `onToggle` (not `onClose`) to match the semantics of a toggle button that also works as an open button if the sidebar were somehow rendered in a collapsed state inside a portal.

---

## Fix 3: Sidebar too narrow

**Problem:** Sidebar is `w-72` (288px), which is cramped for spec previews.

**Solution:** Increase width to 320px on mobile and 384px on desktop.

### File: `frontend/src/components/features/HistorySidebar.tsx`

**1. Change the `className` on the `<aside>` element** (current line 98):
```
w-72  →  w-80 md:w-96
```

The full class string becomes:
```tsx
className={`
  w-80 md:w-96 h-full flex-shrink-0
  bg-slate-900 border-r border-slate-800
  light:bg-slate-50 light:border-slate-200

  /* Mobile (< 768px / md): fixed overlay drawer that slides */
  fixed inset-y-0 left-0 z-40
  transition-transform duration-200 ease-in-out
  ${open ? 'translate-x-0' : '-translate-x-full'}

  /* Desktop (>= 768px / md): static in flex layout */
  md:static md:z-auto md:transition-none
  ${open ? 'md:block' : 'md:hidden'}
`}
```

**Edge cases:** None — this is a pure CSS change. No functionality is affected.

---

## Fix 4: Toggle button overlaps page title when sidebar collapsed

**Problem:** When the sidebar is collapsed, the toggle button is still `fixed top-4 left-4 z-50`, overlapping the "SpecAudit" page title in the header.

**Solution:** Lift the `open` state to App.tsx, remove the fixed toggle from HistorySidebar entirely, and add an inline hamburger button in App.tsx's header. The close (X) button lives inside the sidebar header (Fix 2).

### File: `frontend/src/components/features/HistorySidebar.tsx`

**Props change:**
```ts
interface Props {
  records: HistoryRecord[];
  onLoad: (record: HistoryRecord) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  open: boolean;                   // <-- added
  onToggle: () => void;           // <-- added
  onClose?: () => void;           // <-- added (for Escape + backdrop)
}
```

**Remove `useState(true)` for `open`** — the state is now lifted. Delete line:
```ts
const [open, setOpen] = useState(true);
```

**Update all internal references:**
- `setOpen(false)` → `onClose?.()` (Escape handler, backdrop)
- `setOpen((o) => !o)` → `onToggle()` (close button in header)

### File: `frontend/src/App.tsx`

**1. Add `sidebarOpen` state:**
```ts
const [sidebarOpen, setSidebarOpen] = useState(true);
```

**2. Pass new props to `<HistorySidebar>`:**
```tsx
<HistorySidebar
  records={history.records}
  onLoad={handleLoadRecord}
  onDelete={history.deleteRecord}
  onClearAll={history.clearAll}
  open={sidebarOpen}
  onToggle={() => setSidebarOpen(o => !o)}
  onClose={() => setSidebarOpen(false)}
/>
```

**3. Add a hamburger button in the page header** (inside the `<header>` element, before the `<div>` that contains `<h1>`):
```tsx
<header className="flex items-center justify-between">
  <div className="flex items-center gap-3">
    {/* Hamburger button — opens sidebar on all screen sizes */}
    <button
      onClick={() => setSidebarOpen(o => !o)}
      className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors light:bg-white light:border-slate-300 light:text-slate-500"
      aria-label="Open history sidebar"
      title="Open history sidebar"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>
    <div>
      <h1 className="text-2xl font-bold text-slate-100 light:text-slate-900">SpecAudit</h1>
      <p className="text-sm text-slate-400 light:text-slate-500">OpenAPI Contract Auditor</p>
    </div>
  </div>
  <div className="flex items-center gap-3">
    ...
  </div>
</header>
```

**Edge cases:**
- `onToggle` is always provided (required prop) — no optional chaining needed for the header close button.
- `onClose` is optional for backward compatibility — Escape and backdrop use optional chaining.
- The hamburger button uses the same styling as the old fixed toggle for visual consistency.
- On mobile, the hamburger is always visible in the header; when sidebar opens as a drawer, the close button in the sidebar header and backdrop provide dismissal.

---

## Fix 5: Spec not replaced when loading history

**Problem:** Clicking a history record sets `spec` in App.tsx and the InputPanel syncs via a `useEffect` on `externalSpec`. But `useState(externalSpec ?? '')` only reads the initial value — the effect does update it, but there are edge cases where internal state like `fileInfo`, `dragOver`, or format flags don't reset properly (e.g., loading two records with the same spec text, or the same record twice).

**Solution:** Force React to unmount/remount InputPanel on every history load by using a `key` that changes.

### File: `frontend/src/App.tsx`

**1. Add a load counter ref** (alongside other state declarations):
```ts
const loadKeyRef = useRef(0);
```

**2. Update `handleLoadRecord`** to increment the counter on every load:
```ts
const handleLoadRecord = useCallback(
  (record: HistoryRecord) => {
    setSpec(record.spec);
    setSpecFormat(record.specFormat ?? undefined);
    if (record.result !== null) {
      restore(record.result, [], null, record.specFormat);
    }
    setCurrentAuditId(record.id);
    loadKeyRef.current += 1;           // <-- force key change every load
  },
  [restore]
);
```

**3. Add `key` prop to `<InputPanel>`:**
```tsx
<InputPanel
  key={loadKeyRef.current}
  status={state.status}
  spec={spec}
  onSpecChange={setSpec}
  specFormat={specFormat}
  onSpecFormatChange={setSpecFormat}
  onSubmit={handleSubmit}
  onAbort={abort}
/>
```

**Edge cases:**
- `loadKeyRef` starts at 0, first load sets it to 1, causing a remount on the first history click (which is desired).
- Initial render (before any history click) uses key=0, which is stable.
- Clicking the same record twice: key changes because counter increments, so InputPanel fully remounts.
- All internal InputPanel state (`spec`, `format`, `fileInfo`, `dragOver`, `fileLoadStatus`, `fileError`) is reset on remount.
- `currentAuditId` is NOT changed by the counter — it still holds the actual record ID for the history-save effect.

**Import `useRef`** if not already imported in App.tsx:
```ts
import { useCallback, useEffect, useRef, useState } from 'react';
```

---

## Verification

1. **Build:** `npm run build` — 0 errors.
2. **Tests:** `npm test` — all existing tests pass (no test snapshots or logic changed, only props/state lifted).
3. **Fix 1 (title extraction):**
   - Save a JSON OpenAPI spec with `info.title: "Petstore API"` → sidebar shows "Petstore API" with a subtitle of the first 80 raw chars.
   - Save a JSON OpenAPI spec without `info.title` → sidebar shows raw spec preview (first 80 chars).
   - Save a YAML OpenAPI spec → sidebar shows raw spec preview.
4. **Fix 2 (close button placement):**
   - Sidebar open → close (X) button is inside the sidebar header, to the left of "History" text, not overlapping it.
   - Clicking the X button closes the sidebar.
5. **Fix 3 (sidebar width):**
   - Sidebar is visually wider: 320px on mobile (<768px), 384px on desktop (≥768px).
6. **Fix 4 (no overlap):**
   - Sidebar collapsed → "SpecAudit" page title is fully visible, no fixed button overlapping it.
   - Hamburger button is in the page header, to the left of "SpecAudit".
   - Sidebar open → hamburger still visible in header (can't open again, but doesn't break anything).
   - Escape key closes sidebar.
   - Backdrop tap closes sidebar on mobile.
7. **Fix 5 (spec replacement):**
   - Click a history record → spec appears in textarea, result appears in ResultPanel.
   - Click another history record → spec AND result both change.
   - Click the same record twice → spec and result are re-loaded (InputPanel remounts).
   - `fileInfo` and `dragOver` state are clean on each load (no stale file banner from previous load).
