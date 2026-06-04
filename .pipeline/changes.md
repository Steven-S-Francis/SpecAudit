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

## Fix Round 2 — 2026-06-04

### Changes

**`frontend/src/components/features/HistorySidebar.tsx`**
- **Fix 1 (absolute timestamp tooltip):** When `result !== null`, the relative-time `<p>` now has a `title` attribute with the absolute locale date string. When `result === null`, shows yellow "Running..." text instead.
- **Fix 2 (pending indicator):** Right after the spec preview text, a yellow `(pending)` badge is rendered when `result === null`.

**`frontend/src/components/features/__tests__/HistorySidebar.test.tsx`**
- Updated `"shows relative timestamps"` test to `"shows relative timestamps and pending state"` — the second mock record has `result: null`, so it now asserts `Running...` and `(pending)` are displayed instead of `"1 hour ago"`.

### Spec Issues

- **Fix 3 cannot be applied:** Editing `.pipeline/test-results.md` is disallowed by hard rules (it belongs to the Test and Review agents). The intended line was:
  > `- **Backend Tests**: 29 passed across 6 files (unchanged, no backend files modified)`
  
  The Test agent should append this line during its review cycle.

## Verification

- `npm run build` — 0 errors (TypeScript + Vite build passed)
- `npm run test` — 282 tests passed across 19 test files (all 19 passing, 0 failures)
- TypeScript `tsc --noEmit` — 0 errors

## Tester Focus

1. Verify sidebar toggle open/close works on desktop and mobile
2. Verify loading a history record populates the spec textarea and (if available) the result
3. Verify running an audit creates a new record visible in the sidebar
4. Verify re-running the same audit updates the existing record
5. Verify deleting individual records and "Clear all" work
6. Verify LRU eviction: many large audits push out the oldest
7. Verify localStorage persistence: close browser, reopen, history records are still there
8. Verify the existing paste-into-textarea + Run Audit flow still works unchanged
