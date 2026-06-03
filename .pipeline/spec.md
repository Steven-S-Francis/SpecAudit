# Severity Filter — Spec

## OPEN QUESTIONS

None. All design decisions resolved below.

---

## 1. Design Decisions & Rationale

### 1.1 Filter state lives in ResultPanel (not App)

The severity filter is a pure display concern — it controls which rendered findings are visible in the result panel. Keeping the state inside `ResultPanel.tsx` avoids unnecessary re-renders of `App.tsx` and its other children (input panel, export buttons) when toggling filters.

### 1.2 Block splitting on `\n---\n` before ReactMarkdown

The AI-generated markdown uses `\n---\n` (horizontal rules) to separate individual finding blocks. Each block is a section starting with `### [SEVERITY] Title`. The utility `filterMarkdownBySeverity` splits on this separator, filters out blocks whose severity is hidden, then rejoins. Non-finding blocks (Summary, Governance Score) pass through because they lack a `### [SEVERITY]` header.

### 1.3 Three severity toggle buttons using SEVERITY_STYLES

Three buttons (CRITICAL / WARNING / INFO) are rendered above the markdown content. They use the existing `SEVERITY_STYLES` constants:
- **Active** (visible): Filled badge style from `SEVERITY_STYLES[severity].badge` (red/amber/blue backgrounds)
- **Inactive** (hidden): Muted border with `opacity-50`, no background color

### 1.4 Always-on dynamic filtering

Toggles are never disabled. If all three are turned off, only non-finding content (Summary, Governance Score, plain headings) remains visible. Partial streaming content that hasn't yet formed a complete `### [SEVERITY]` header passes through harmlessly — the utility's `extractSeverityFromBlock` regex simply won't match, so the block is kept.

---

## 2. Data Structures (Types/Interfaces)

### 2.1 Filter state type (internal to ResultPanel)

```typescript
// No new shared type needed. Inline type in ResultPanel.tsx:
const [severityFilter, setSeverityFilter] = useState<Record<SeverityLevel, boolean>>({
  CRITICAL: true,
  WARNING: true,
  INFO: true,
});
```

### 2.2 Utility function signature

```typescript
// frontend/src/utils/filterMarkdown.ts
export function filterMarkdownBySeverity(
  content: string,
  hiddenSeverities: Set<SeverityLevel>
): string;
```

### 2.3 Helper (private, not exported)

```typescript
// extractSeverityFromBlock — regex-based detection of finding block headers
function extractSeverityFromBlock(block: string): SeverityLevel | null;
// Matches: /^### \[CRITICAL\]/m, /^### \[WARNING\]/m, /^### \[INFO\]/m
```

---

## 3. Data Flow

```
User clicks toggle button (e.g. "CRITICAL")
│
▼
toggleSeverity('CRITICAL')
  → setSeverityFilter(prev => ({ ...prev, CRITICAL: !prev.CRITICAL }))
│
▼
Derived: hiddenSeverities = Set of keys where value is false
│
▼
filteredContent = filterMarkdownBySeverity(content, hiddenSeverities)
│
▼
ReactMarkdown receives filteredContent instead of raw content
│
▼
Findings with hidden severity are absent from rendered output
Non-finding blocks (Summary, Governance) always pass through
```

**Key invariant**: The filter never mutates `content` (the prop). It creates a derived `filteredContent` string on every render. ReactMarkdown re-renders only when `filteredContent` changes.

---

## 4. Changes Per File

### 4.1 CREATE: `frontend/src/utils/filterMarkdown.ts`

**What**: Pure utility function.

```
export function filterMarkdownBySeverity(
  content: string,
  hiddenSeverities: Set<SeverityLevel>
): string
```

- If `hiddenSeverities.size === 0`, return `content` unchanged (fast path)
- Split content on `\n---\n`
- For each block, check if the block starts with `### [CRITICAL]`, `### [WARNING]`, or `### [INFO]` (multiline regex `^### \[SEVERITY\]/m`)
- If a severity is matched AND is in `hiddenSeverities`, drop the block
- All other blocks (non-finding) are kept
- Rejoin remaining blocks with `\n---\n`

**Edge cases**:
- Empty content → returns `''`
- No findings at all → returns content unchanged
- Malformed severity header (`### [CRITI`) → regex doesn't match, block passes through (handles partial streaming)
- `---` appearing inside non-finding sections (e.g. Governance Score body text) → split by `\n---\n` only, not arbitrary `---`
- All severities hidden → only non-finding sections remain
- Toggling back on → block reappears because original content is preserved

### 4.2 CREATE: `frontend/src/utils/__tests__/filterMarkdown.test.ts`

**What**: 13 unit tests for `filterMarkdownBySeverity` (see §5.1).

### 4.3 MODIFY: `frontend/src/components/features/ResultPanel.tsx`

**What**: Add filter state, toggle buttons, and apply filtered content.

**Changes**:

1. **New imports**:
   - `filterMarkdownBySeverity` from `'../../utils/filterMarkdown'`

2. **New state** inside `ResultPanel`:
   ```typescript
   const [severityFilter, setSeverityFilter] = useState<Record<SeverityLevel, boolean>>({
     CRITICAL: true,
     WARNING: true,
     INFO: true,
   });
   ```

3. **New callback**:
   ```typescript
   const toggleSeverity = useCallback((severity: SeverityLevel) => {
     setSeverityFilter((prev) => ({ ...prev, [severity]: !prev[severity] }));
   }, []);
   ```

4. **Derived hidden severities**:
   ```typescript
   const hiddenSeverities = new Set(
     (Object.keys(severityFilter) as SeverityLevel[]).filter((s) => !severityFilter[s])
   );
   const filteredContent = filterMarkdownBySeverity(content, hiddenSeverities);
   ```

5. **Toggle button row** (rendered inside `{content && ...}` guard, before the markdown area):
   ```tsx
   <div className="flex gap-2 mb-3">
     {(['CRITICAL', 'WARNING', 'INFO'] as const).map((severity) => {
       const active = severityFilter[severity];
       const base = SEVERITY_STYLES[severity];
       return (
         <button
           key={severity}
           onClick={() => toggleSeverity(severity)}
           className={`
             text-xs font-bold px-2 py-0.5 rounded border transition-opacity
             ${active
               ? `${base.badge} border-transparent`
               : 'text-slate-500 border-slate-600 bg-transparent opacity-50 light:text-slate-400 light:border-slate-300'
             }
           `}
         >
           {severity}
         </button>
       );
     })}
   </div>
   ```

6. **Use `filteredContent`** instead of `content` in the `<ReactMarkdown>` component.

**Edge cases**:
- Empty content → skeleton shown (no toggle buttons)
- Streaming → toggles work during streaming; partial blocks filter harmlessly
- All toggles off → non-finding sections still render
- Toggle back on → finding reappears

**Pattern to follow**: Existing `SEVERITY_STYLES` constant, existing ReactMarkdown component structure (copy from current `ResultPanel.tsx`).

### 4.4 MODIFY: `frontend/src/components/features/__tests__/ResultPanel.test.tsx`

**What**: Add 10 new tests for toggle behavior (see §5.2). Existing severity styling tests remain unchanged.

### 4.5 No change: `frontend/src/App.tsx`

The filter is entirely internal to `ResultPanel`. No prop changes, no state changes in App.

### 4.6 No change: `frontend/src/types/audit.ts`

No new types needed. Uses existing `SeverityLevel`.

---

## 5. Test Strategy

### 5.1 Unit tests: `filterMarkdown.test.ts` (13 tests)

| # | Test | What it verifies |
|---|------|------------------|
| 1 | returns content unchanged when no severities are hidden | Empty `hiddenSeverities` Set → pass-through |
| 2 | removes CRITICAL finding blocks | Only CRITICAL blocks removed |
| 3 | removes WARNING finding blocks | Only WARNING blocks removed |
| 4 | removes INFO finding blocks | Only INFO blocks removed |
| 5 | removes multiple severity types simultaneously | Two severities hidden at once |
| 6 | keeps non-finding sections (Summary, Governance Score) | Always preserved even with all severities hidden |
| 7 | keeps plain h3 headings without severity | Non-severity headings pass through |
| 8 | handles empty content | Empty string → empty string |
| 9 | handles content with no findings at all | No `### [SEVERITY]` → content unchanged |
| 10 | handles content with one finding | Single block removed → empty string |
| 11 | handles malformed severity header (partial streaming) | `### [CRITI` not matched → passes through |
| 12 | preserves block order when filtering | Remaining blocks keep original order |
| 13 | handles `---` inside Governance Score section | Only `\n---\n` separators split blocks |

### 5.2 Component tests: `ResultPanel.test.tsx` (10 new tests, lines 82–172)

| # | Test | What it verifies |
|---|------|------------------|
| 1 | renders three filter toggle buttons when content is present | CRITICAL, WARNING, INFO buttons exist |
| 2 | does not render filter buttons when content is empty | Skeleton view has no buttons |
| 3 | clicking CRITICAL toggle hides CRITICAL findings | CRITICAL text disappears, WARNING remains |
| 4 | clicking WARNING toggle hides WARNING findings | WARNING text disappears, CRITICAL remains |
| 5 | clicking INFO toggle hides INFO findings | INFO text disappears, CRITICAL remains |
| 6 | clicking toggle again re-shows findings | Toggle on → off → on restores content |
| 7 | non-finding content (Governance Score) unaffected by filter | Always visible even with all severities hidden |
| 8 | filter works during streaming | Toggle still functions with `isStreaming={true}` |

### 5.3 Existing tests that must pass unchanged

All pre-existing ResultPanel tests (lines 7–80: skeleton rendering, streaming cursor, severity styling for CRITICAL/WARNING/INFO, plain H3 rendering) plus all other utility and component tests in the project.

### 5.4 Test count

- **Pre-existing tests**: ~177 (`it()` calls across entire project)
- **New unit tests**: 13 (`filterMarkdown.test.ts`)
- **New component tests**: 10 (`ResultPanel.test.tsx`)
- **Total**: ~200 tests

---

## 6. Files Summary

| Action | Path |
|--------|------|
| CREATE | `frontend/src/utils/filterMarkdown.ts` |
| CREATE | `frontend/src/utils/__tests__/filterMarkdown.test.ts` |
| MODIFY | `frontend/src/components/features/ResultPanel.tsx` |
| MODIFY | `frontend/src/components/features/__tests__/ResultPanel.test.tsx` |
| No change | `frontend/src/App.tsx` |
| No change | `frontend/src/types/audit.ts` |
| No change | `frontend/src/hooks/useAudit.ts` |
| No change | `frontend/src/api/auditClient.ts` |
