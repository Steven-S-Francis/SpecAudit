# Changes Made — Session History Feature

## Files Created

### 1. `frontend/src/hooks/useHistory.ts`
React hook for localStorage-backed audit history with LRU eviction.

**What it does:**
- Stores `HistoryRecord[]` in localStorage under key `'specaudit-history'`, newest-first
- On mount, loads records from localStorage (handles corrupt JSON, localStorage unavailable)
- `addRecord`: generates `id` via `crypto.randomUUID()` and `timestamp` via `Date.now()` if not provided; updates in-place if id matches existing; prepends if new
- `deleteRecord(id)`: removes record by id
- `clearAll()`: empties all records
- `loadRecord(id)`: returns record or undefined
- LRU eviction: before writing to localStorage, estimates total size via `TextEncoder`. If > 4 MB, removes oldest records until under limit
- All localStorage access wrapped in try/catch — fails silently if unavailable
- Uses useState + useEffect pattern matching useTheme.ts

### 2. `frontend/src/hooks/__tests__/useHistory.test.tsx`
12 tests covering:
- Initializes empty when localStorage empty
- Initializes from pre-seeded localStorage
- `addRecord` generates id when none provided
- `addRecord` with existing id updates in-place
- `deleteRecord` removes by id
- `clearAll` empties all
- `loadRecord` returns correct record or undefined
- LRU eviction triggers when storage exceeds 4 MB (mocks TextEncoder)
- Handles corrupt JSON gracefully
- Handles localStorage unavailable (getItem throws)
- Records persist across hook instances (localStorage is source of truth)
- `addRecord` auto-sets id and timestamp if not provided

### 3. `frontend/src/components/features/HistorySidebar.tsx`
Collapsible sidebar showing past audit records.

**Key features:**
- Toggle button (hamburger/X icon) in top-left
- Desktop (>= 768px): sidebar pushed by layout, fixed width (w-72)
- Mobile (< 768px): overlay drawer with semi-transparent backdrop, fixed z-50
- Record rows show: spec preview (first 50 chars of spec, or specName if available), relative timestamp, delete (X) button on hover
- "No past audits" message when empty
- "Clear all" button in header
- `relativeTime()` helper: "just now" / "X min ago" / "X hour(s) ago" / "X day(s) ago" / formatted date
- Escape key closes sidebar
- Dark theme: slate-900 bg, slate-800 borders, slate-200 text, indigo-400 accents

### 4. `frontend/src/components/features/__tests__/HistorySidebar.test.tsx`
8 tests covering:
- Renders "No past audits" when empty
- Renders list of records
- Clicking a record calls onLoad with that record
- Delete button calls onDelete with record id
- Clear all button calls onClearAll
- Toggle button opens/closes sidebar
- Shows relative timestamps
- Escape key closes sidebar

## Files Modified

### 5. `frontend/src/App.tsx`
Integrated history sidebar and controlled InputPanel.

**Changes:**
- Imported `useHistory`, `HistoryRecord` type, and `HistorySidebar`
- Added state: `currentAuditId`, `spec`, `specFormat`
- Used `useHistory()` hook
- Added `handleLoadRecord`: sets spec/specFormat, calls `restore` (from useAudit) to populate audit result with record data
- Added `handleSubmit`: wraps the original `audit()` call, first creates a history record with `result: null`, then triggers audit
- Added `useEffect` on `state.status === 'complete'`: updates the history record with the audit result
- Layout changed from single-column to flex container: sidebar sits left of main content area
- Passed `spec`, `specFormat`, `onSpecChange`, `onSpecFormatChange` to InputPanel as controlled props

### 6. `frontend/src/hooks/useAudit.ts`
Added `restore` function to allow setting audit state from a history record.

**Changes:**
- Added `Finding` and `AuditSummary` to type imports
- Added `restore(result, findings, summary, specFormat)` method that aborts any in-progress audit and sets state to `complete` with provided data

### 7. `frontend/src/components/features/InputPanel.tsx`
Made InputPanel optionally externally controllable.

**Changes:**
- Added optional `spec`, `onSpecChange`, `specFormat`, `onSpecFormatChange` props
- Added `useEffect` blocks to sync internal state when external props change
- Updated textarea `onChange` to call `onSpecChange` when provided
- Updated YAML/JSON format button handlers to call `onSpecFormatChange` when provided
- Updated file reader `onload` handler to call `onSpecChange` when provided
- All new props are optional — existing usage (without them) continues to work unchanged

### 8. `frontend/src/components/features/__tests__/App.test.tsx`
Updated to handle new history sidebar and restore functionality.

**Changes:**
- Added `useHistory` mock (vi.mock)
- Added `restore: vi.fn()` to all `useAudit` mockReturnValue calls
- Added `mockUseHistory` mockReturnValue to all beforeEach blocks
- Added new describe block "App History Sidebar" with 5 tests:
  1. Renders history sidebar in App
  2. Shows "No past audits" when history is empty
  3. Adds a record to history on audit complete
  4. Loads a history record into spec and result
  5. Clear all removes records and shows empty state

---

## Fix Round 3 — 2026-06-04 (5 UX Fixes)

### Fix 1: Extract title from OpenAPI spec

**`frontend/src/hooks/useHistory.ts`:**
- Added `title?: string` to `HistoryRecord` interface
- Added `extractSpecTitle(spec)` helper: tries JSON.parse, returns `info.title` if found, else null
- Updated `addRecord` to auto-populate `title` from `extractSpecTitle(record.spec)` if `record.title` not provided

**`frontend/src/components/features/HistorySidebar.tsx`:**
- Changed `formatSpecPreview` signature from `(spec, specName, max)` to `(record, max = 80)` returning `{ primary, subtitle }`
- Prefers `record.title`, falls back to `record.specName`, then raw spec preview
- When title is shown, adds a smaller subtitle with first 80 chars of raw spec
- Updated the JSX in `records.map` to destructure the returned object and render both primary/subtitle

### Fix 2: Close button overlapping "History" header

**`frontend/src/components/features/HistorySidebar.tsx`:**
- Added a close (X) button as the first child of the sidebar header div, before the "History" `<h2>`
- The X button calls `onToggle` (from lifted state)
- Removed the old fixed-position toggle button block (hamburger/X combo)

### Fix 3: Sidebar too narrow

**`frontend/src/components/features/HistorySidebar.tsx`:**
- Changed sidebar width from `w-72` to `w-80 md:w-96` (320px mobile, 384px desktop)

### Fix 4: Toggle button overlaps page title when collapsed

**`frontend/src/components/features/HistorySidebar.tsx`:**
- Changed Props: added `open: boolean`, `onToggle: () => void`, `onClose?: () => void`
- Removed internal `const [open, setOpen] = useState(true)`
- Removed the fixed-position hamburger toggle button entirely
- Backdrop `onClick` now calls `onClose?.()` instead of `setOpen(false)`
- Escape handler now calls `onClose?.()` instead of `setOpen(false)`

**`frontend/src/App.tsx`:**
- Added `const [sidebarOpen, setSidebarOpen] = useState(true)`
- Added `const loadKeyRef = useRef(0)`
- Passed `open={sidebarOpen}`, `onToggle={() => setSidebarOpen(o => !o)}`, `onClose={() => setSidebarOpen(false)}` to `<HistorySidebar>`
- Added an inline hamburger button in the page header (left of "SpecAudit" title) that calls `setSidebarOpen(o => !o)`

### Fix 5: Spec not replaced when loading history

**`frontend/src/App.tsx`:**
- Added `loadKeyRef` counter using `useRef(0)`
- In `handleLoadRecord`, increments `loadKeyRef.current += 1` on every load
- Added `key={loadKeyRef.current}` prop to `<InputPanel>` to force remount on history load

### Updated tests

**`frontend/src/components/features/__tests__/HistorySidebar.test.tsx`:**
- All renders now pass `open={true} onToggle={noop}` (and `onClose` where needed)
- "toggle button opens/closes the sidebar" replaced with "close button calls onToggle" — verifies the X button in the sidebar header calls `onToggle`
- "Escape key closes the sidebar" now verifies `onClose` was called instead of checking for a changed button label
- Comment updated from "first 50 chars" to "first 80 chars" to match new max

## Verification

- `npx tsc --noEmit` — 0 errors
- `npx vitest run` — 282 tests passed across 19 test files (all passed)
- `npm run build` — 0 errors (TypeScript + Vite build passed)

## Tester Focus

1. **Fix 1:** Save a JSON OpenAPI spec with `info.title` → sidebar shows title with raw-spec subtitle. Save YAML or JSON without title → shows raw spec preview.
2. **Fix 2:** Sidebar open → close (X) button is inside sidebar header, to the left of "History", not overlapping.
3. **Fix 3:** Sidebar is 320px on mobile, 384px on desktop.
4. **Fix 4:** Sidebar collapsed → "SpecAudit" title fully visible. Hamburger button in page header. Escape/backdrop close sidebar.
5. **Fix 5:** Click a history record → InputPanel remounts with clean state. Same record twice works correctly.
