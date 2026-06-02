# Structured AI Output for Practical JSON Export — Spec

## OPEN QUESTIONS

None. All design decisions resolved below.

---

## 1. Design Decisions & Rationale

### 1.1 SSE event format: sentinel prefix, not `event:` type
The user suggested `event: structured` SSE events. However, the existing `parseSSEChunks` utility only extracts `data:` lines and silently discards non-data lines. Changing the parser for a single event type adds complexity and breaks the existing interface.  

**Decision**: Reuse the existing sentinel pattern (`[SPECAUDIT_ERROR]`) by defining `[SPECAUDIT_STRUCTURED]` as a prefix in a `data:` line. This is consistent, requires zero changes to `parseSSEChunks`, and is already proven by the error sentinel.

### 1.2 JSON extraction location: backend vs frontend
The full markdown is streamed chunk-by-chunk from backend to frontend. The frontend accumulates it in `state.result`.  

**Decision**: Extract the JSON block in the **backend** after streaming completes. The backend has the complete text, can regex-extract the JSON block, validate it, and send it as a final sentinel event. No frontend regex parsing needed. The backend already accumulates chunks during streaming (via `StringBuilder`) — we just add extraction after the loop.

### 1.3 Non-breaking markdown display
The AI's human-readable markdown must be rendered identically. The JSON block is embedded in a fenced code block at the very end of the AI response. The markdown renderer (`ReactMarkdown`) will render it as a code block — this is acceptable for display (users see the JSON at the bottom) and trivial to strip if desired later.

### 1.4 Fallback when AI omits JSON block
If the AI response contains no ` ```json ... ``` ` block at the end, the backend omits the structured sentinel. The frontend defaults `findings` to `[]` and `summary` to `null`. The JSON export falls back to including the full `result` field (current format).

### 1.5 AuditResult type shape
The `AuditResult` type gains optional `findings` and `summary` fields. When structured data is present, the JSON export omits `result` (since findings/summary are more useful). When absent, `result` is included as before. This keeps backward compatibility.

---

## 2. Data Structures (Types/Interfaces)

### 2.1 Frontend Types (`frontend/src/types/audit.ts`)

```typescript
export type SeverityLevel = 'CRITICAL' | 'WARNING' | 'INFO';

export interface Finding {
  severity: SeverityLevel;
  title: string;
  category: string;    // e.g. "Security", "REST Violation", "Schema", "Naming", "Consistency"
  location: string;    // path/method or "Global"
  issue: string;
  recommendation: string;
}

export interface AuditDimensions {
  security: number;
  restConformance: number;
  schemaCompleteness: number;
  documentationQuality: number;
}

export interface AuditSummary {
  totalFindings: number;
  critical: number;
  warnings: number;
  info: number;
  verdict: string;            // "FAIL" | "PASS WITH WARNINGS" | "PASS"
  governanceScore: number;
  endpointsAnalyzed: number;
  dimensions: AuditDimensions;
}

// --- New AuditState (added fields) ---
export interface AuditState {
  status: AuditStatus;
  result: string;
  findings: Finding[];        // NEW
  summary: AuditSummary | null; // NEW
  error: string | null;
  specFormat: string | null;
}

// --- New AuditResult (for export) ---
export interface AuditResult {
  version: 1;
  result?: string;            // present only when no structured data (fallback)
  findings: Finding[];         // may be empty if AI didn't include JSON
  summary: AuditSummary | null; // null if AI didn't include JSON
  exportedAt: string;
  specFormat: string | null;
}
```

### 2.2 Backend C# Types (`backend/src/Models/Responses/AuditResponse.cs`)

```csharp
// New model for the structured data extracted from AI response
namespace SpecAudit.Models.Responses;

public sealed record StructuredFinding(
    string Severity,      // "CRITICAL" | "WARNING" | "INFO"
    string Title,
    string Category,
    string Location,
    string Issue,
    string Recommendation
);

public sealed record StructuredDimensions(
    int Security,
    int RestConformance,
    int SchemaCompleteness,
    int DocumentationQuality
);

public sealed record StructuredSummary(
    int TotalFindings,
    int Critical,
    int Warnings,
    int Info,
    string Verdict,
    int GovernanceScore,
    int EndpointsAnalyzed,
    StructuredDimensions Dimensions
);

public sealed record StructuredData(
    List<StructuredFinding> Findings,
    StructuredSummary Summary
);
```

---

## 3. Data Flow Diagram (Text)

```
AI (LLM)
│
│  Returns streaming markdown with `\`\`\`json...\`\`\`` at end
│
▼
SpecAuditService.AuditAsync()
│
│  For each AI content chunk:
│    ├─ Append to StringBuilder (accumulate)
│    └─ yield return chunk (stream to endpoint)
│
│  After streaming loop completes:
│    ├─ Regex-extract JSON block from full StringBuilder
│    ├─ Validate JSON parses
│    └─ If valid: yield return "[SPECAUDIT_STRUCTURED]" + json
│
▼
AuditEndpoints (SSE stream)
│
│  data: "chunk1"       ← same as before (markdown)
│  data: "chunk2"
│  data: "[SPECAUDIT_STRUCTURED]{...}"   ← NEW sentinel at end
│
▼
Frontend auditClient.ts
│
│  For each data chunk:
│    ├─ [SPECAUDIT_ERROR]? → throw error
│    ├─ [SPECAUDIT_STRUCTURED]? → parse JSON, call onStructured()
│    └─ Otherwise → call onChunk() (markdown text)
│
▼
useAudit.ts hook
│
│  onChunk: append to state.result (unchanged)
│  onStructured: set state.findings, state.summary
│
▼
App.tsx / ResultPanel.tsx
│
│  Render: markdown from state.result (unchanged)
│  Copy:   state.result (unchanged)
│  PDF:    state.result (unchanged)
│  JSON:   exports { version, findings, summary (or result fallback), exportedAt, specFormat }
│
▼
Downloaded JSON file
  {
    "version": 1,
    "findings": [...],        ← clean, queryable
    "summary": {...},
    "exportedAt": "...",
    "specFormat": null
  }
```

---

## 4. Changes Needed Per File

### 4.1 Backend: `backend/src/Services/SpecAuditService.cs`

**What**: Modify `AuditAsync()` to:
1. Accumulate all chunk text in a `StringBuilder` during streaming
2. After the streaming loop, extract the ` ```json ... ``` ` block from the full text
3. Validate the JSON parses successfully
4. Yield a `[SPECAUDIT_STRUCTURED]` sentinel with the JSON payload

**What**: Add a new `internal static` method `ExtractStructuredJson(string markdown)`:
- Regex: `@"```json\s*([\s\S]*?)\s*```\s*$"` (match last fenced json block at end of string)
- Return the trimmed JSON string, or `null` if no match
- Validate using `JsonDocument.Parse()` before returning

**What**: Append instruction to `SystemPrompt` constant (lines 13–111):
- At the very end of the prompt (after the Governance Score section), add:

```
AFTER your complete markdown report, append a JSON code block at the very end with the structured findings summary. The JSON block must be the very last content — no text after it.

```json
{
  "findings": [
    {
      "severity": "CRITICAL",
      "title": "Missing Security Scheme Definition",
      "category": "Security",
      "location": "Global",
      "issue": "description...",
      "recommendation": "fix..."
    }
  ],
  "summary": {
    "totalFindings": 14,
    "critical": 6,
    "warnings": 4,
    "info": 4,
    "verdict": "FAIL",
    "governanceScore": 60,
    "endpointsAnalyzed": 2,
    "dimensions": {
      "security": 15,
      "restConformance": 15,
      "schemaCompleteness": 10,
      "documentationQuality": 20
    }
  }
}
```

The `findings` array must contain one entry per finding block in the report, in the same order. The `summary` must reflect the same numbers as the human-readable report summary. Ensure severity values match exactly: "CRITICAL", "WARNING", or "INFO".
```

**Pattern to follow**: The existing `SystemPrompt` string constant (indentation, raw string literal).

**Edge cases**:
- AI omits the JSON block → `ExtractStructuredJson` returns `null`, no sentinel sent
- AI includes invalid JSON → `JsonDocument.Parse` throws, caught, returns `null`, no sentinel
- AI includes JSON that doesn't match expected schema → only basic parse validation (structural), schema validation is deferred to frontend runtime
- Multiple ` ```json ``` ` blocks → regex uses `\s*$` anchor to match only the last one

### 4.2 Backend: `backend/src/Endpoints/AuditEndpoints.cs`

**What**: No changes needed. The `[SPECAUDIT_STRUCTURED]` sentinel is yielded as a normal chunk from `AuditAsync()`, encoded as JSON inside the `data:` line, and streamed. The existing infrastructure handles it.

Exception: If we want to clean up tests, but the endpoint code itself is unchanged.

### 4.3 Backend: `backend/src/Models/Responses/AuditResponse.cs`

**What**: Replace the single `AuditResponse` record with the new structured types (`StructuredFinding`, `StructuredDimensions`, `StructuredSummary`, `StructuredData`). Keep `AuditResponse` for backward compat if needed, but remove if unused.

### 4.4 Frontend: `frontend/src/types/audit.ts`

**What**: Add `Finding`, `AuditDimensions`, `AuditSummary` interfaces. Add `findings` (Finding[]) and `summary` (AuditSummary | null) to both `AuditState` and `AuditResult`. Keep `AuditRequest`, `AuditStatus`, `SeverityLevel` as-is.

**Edge cases**:
- `summary` may be `null` when AI didn't provide structured data
- `findings` is always an array (possibly empty `[]`)

### 4.5 Frontend: `frontend/src/api/auditClient.ts`

**What**: Add new `onStructured` callback parameter to `auditStream()`:
```typescript
export async function auditStream(
  payload: AuditRequest,
  onChunk: (chunk: string) => void,
  signal: AbortSignal,
  onStructured?: (data: { findings: Finding[]; summary: AuditSummary }) => void
): Promise<void>
```

In the data processing loop, add a check after the `[SPECAUDIT_ERROR]` check:
```typescript
const STRUCTURED_PREFIX = '[SPECAUDIT_STRUCTURED]';
if (chunk.startsWith(STRUCTURED_PREFIX)) {
  if (onStructured) {
    const jsonStr = chunk.slice(STRUCTURED_PREFIX.length);
    const data = JSON.parse(jsonStr);
    onStructured(data);
  }
  continue; // don't pass to onChunk
}
```

**Edge cases**:
- No `onStructured` callback provided → ignore structured data silently
- JSON parse failure → silently ignore (don't break the stream)
- Multiple structured events → only the first is processed (defensive)

### 4.6 Frontend: `frontend/src/hooks/useAudit.ts`

**What**: Add `findings` and `summary` to initial state and all `setState` calls. Pass `onStructured` callback to `auditStream()`:

```typescript
const [state, setState] = useState<AuditState>({
  status: 'idle',
  result: '',
  findings: [],
  summary: null,
  error: null,
  specFormat: null,
});
```

In the `audit` callback:
```typescript
await auditStream(
  payload,
  (chunk) => setState(s => ({ ...s, result: s.result + chunk })),
  abortRef.current!.signal,
  (data) => setState(s => ({
    ...s,
    findings: data.findings,
    summary: data.summary,
  }))
);
```

**Edge cases**:
- Structured data arrives after stream is complete → state updates correctly
- No structured data → `findings` stays `[]`, `summary` stays `null`
- Reset () also clears findings/summary

### 4.7 Frontend: `frontend/src/App.tsx`

**What**: Change `handleExportJson` to use structured data when available:

```typescript
const handleExportJson = useCallback(() => {
  try {
    const auditResult: AuditResult = {
      version: 1,
      findings: state.findings,
      summary: state.summary,
      exportedAt: new Date().toISOString(),
      specFormat: state.specFormat,
    };
    // Only include result field if no structured data (fallback)
    if (state.findings.length === 0 && state.summary === null) {
      auditResult.result = state.result;
    }
    // ... rest same (JSON.stringify, Blob, download)
  } catch {
    // JSON export API unavailable — silently ignore
  }
}, [state.result, state.findings, state.summary, state.specFormat]);
```

**What**: The download (markdown) and copy button remain unchanged (they use `state.result`). The PDF export remains unchanged (uses `state.result`).

### 4.8 Frontend: `frontend/src/components/features/ResultPanel.tsx`

**What**: No changes needed. This component only receives `content` (markdown string) and `isStreaming`. It does not need structured data.

### 4.9 Frontend: `frontend/src/utils/exportPdf.ts`

**What**: No changes needed. This utility still converts `state.result` (markdown) to PDF. Structured data for PDF is deferred.

---

## 5. Test Strategy

### 5.1 Existing tests that MUST pass unchanged

All utility tests (parseSSEChunks, parseSeverity, exportPdf, useAutoScroll, Button, ThemeToggle, ScrollButton, InputPanel) must pass without modification. They don't interact with the structured data.

### 5.2 Tests that will break and need updates

#### `frontend/src/hooks/__tests__/useAudit.test.tsx`
- **Breakage**: All tests check `result.current.state` shape. They expect `{ status, result, error, specFormat }`. Now they need `{ status, result, findings, summary, error, specFormat }`.
- **Fix**: Add `findings: []` and `summary: null` to all state assertions (7 locations).
- **Add**: New test: "onStructured callback updates findings and summary in state".

#### `frontend/src/components/features/__tests__/App.test.tsx`
- **Breakage**: 
  - `createTestResult()` helper creates `AuditResult` without `findings`/`summary` → TypeScript error.
  - Test 4 ("creates correct JSON envelope on click") asserts `parsed.result` exists → now `result` may be absent if structured data present.
  - Test 15 ("handles empty result string"), Test 16 ("handles result with unicode characters") create `AuditResult` without `findings`/`summary`.
- **Fix**: 
  - Update `createTestResult()` to include `findings: []` and `summary: null`.
  - Update Test 4 to also assert `parsed.findings` and `parsed.summary` exist.
  - Update Test 15/16 to include `findings: []`, `summary: null`.
- **Add**: 
  - New test: "JSON export includes findings and summary when structured data available".
  - New test: "JSON export includes result field when no structured data (fallback)".

#### `frontend/src/api/__tests__/auditClient.test.ts`
- **Breakage**: None expected. The `onStructured` callback is optional and existing tests don't pass it.
- **Add**: New test group: "structured event handling":
  - "calls onStructured when chunk contains [SPECAUDIT_STRUCTURED] prefix"
  - "does not pass structured chunk to onChunk"
  - "ignores invalid JSON in structured sentinel"
  - "does not call onStructured when callback not provided"

#### `frontend/src/__tests__/integration/feature-pipeline.test.ts`
- **Breakage**: None expected. The test uses `auditStream` with the fixture chunks which don't include a structured sentinel. The `onStructured` parameter is optional.
- **Think about**: Should we add a test that includes a structured sentinel at the end? Yes — new test: "SSE stream with structured sentinel at end extracts findings".

#### `frontend/src/App.tsx` itself
The mock for `useAudit` in `App.test.tsx` returns `{ state: { status, result, error, specFormat } }`. Need to add `findings` and `summary` to the mock state.

### 5.3 New tests to write

| Test | File | What it verifies |
|------|------|------------------|
| ExtractStructuredJson matches valid block | Backend C# test | Given markdown with ` ```json...``` ` at end, returns the JSON string |
| ExtractStructuredJson returns null when no block | Backend C# test | Plain markdown returns null |
| ExtractStructuredJson returns null on invalid JSON | Backend C# test | ` ```json { invalid } ``` ` returns null |
| ExtractStructuredJson handles multiple blocks | Backend C# test | Only the LAST ` ```json ``` ` block is extracted |
| onStructured updates findings in state | `useAudit.test.tsx` | State.findings and state.summary are set |
| JSON export includes findings+summary | `App.test.tsx` | Downloaded JSON blob has `findings` and `summary` fields |
| JSON export includes result fallback | `App.test.tsx` | When findings=[], summary=null, `result` field is present |
| onStructured callback works in auditStream | `auditClient.test.ts` | Structured sentinel parsed correctly |
| AuditResult type is valid with all fields | `App.test.tsx` | Type compliance |

### 5.4 Test count

- **Existing tests**: ~169 (counting all `it()` calls)
- **Expected to break**: ~8–12 tests (state shape assertions + AuditResult construction)
- **Expected to pass unchanged**: ~157–161 tests
- **New tests to add**: ~10–15

---

## 6. Implementation Order (Recommended)

1. **Types first**: Update `frontend/src/types/audit.ts` with new interfaces
2. **Backend model**: Update `backend/src/Models/Responses/AuditResponse.cs`
3. **Backend service**: Update `SpecAuditService.cs` with `ExtractStructuredJson` and prompt change
4. **Frontend SSE client**: Update `auditClient.ts` with `onStructured` callback
5. **Frontend hook**: Update `useAudit.ts` with findings/summary state
6. **Frontend App**: Update `App.tsx` `handleExportJson`
7. **Test updates**: Fix broken tests, add new tests
8. **Backend tests**: Write unit tests for `ExtractStructuredJson`

---

## 7. Files Summary

| Action | Path |
|--------|------|
| Modify | `backend/src/Services/SpecAuditService.cs` |
| Modify | `backend/src/Models/Responses/AuditResponse.cs` |
| Modify | `frontend/src/types/audit.ts` |
| Modify | `frontend/src/api/auditClient.ts` |
| Modify | `frontend/src/hooks/useAudit.ts` |
| Modify | `frontend/src/App.tsx` |
| Modify | `frontend/src/hooks/__tests__/useAudit.test.tsx` |
| Modify | `frontend/src/components/features/__tests__/App.test.tsx` |
| Modify (minor) | `frontend/src/api/__tests__/auditClient.test.ts` |
| Add (minor) | `frontend/src/__tests__/integration/feature-pipeline.test.ts` (new tests within existing) |
| No change | `backend/src/Endpoints/AuditEndpoints.cs` |
| No change | `frontend/src/components/features/ResultPanel.tsx` |
| No change | `frontend/src/utils/exportPdf.ts` |
| No change | `frontend/src/utils/parseSSEChunks.ts` |
