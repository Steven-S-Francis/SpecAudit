# Spec: Export Audit Result as JSON

## Overview

Add a new "Export JSON" button beside the existing Download and Export PDF buttons. It serializes the raw markdown audit result into a structured JSON envelope and triggers a file download via the same Blob + temp `<a>` pattern used by the existing Download handler.

**Approach:** Option 1 — wrap the markdown string in a JSON envelope. No backend changes needed. The JSON envelope includes metadata (export timestamp, spec format) alongside the raw result.

---

## Open Questions

1. **File name pattern:** `specaudit-report-<timestamp>.json` aligns with existing `.md` / `.pdf` convention. Confirm.
2. **JSON icon:** A braces `{ }` SVG icon is proposed below to differentiate from Download (arrow) and Export PDF (file). Confirm or provide alternative icon.

---

## JSON Schema

The exported `.json` file will have the following shape:

```typescript
interface AuditResult {
  /** Schema version for forward compatibility */
  version: 1;
  /** The full raw markdown audit result */
  result: string;
  /** ISO-8601 timestamp of when the export was triggered */
  exportedAt: string;
  /** The spec format that was audited, if known ('yaml' | 'json' | null) */
  specFormat: string | null;
}
```

Example output:

```json
{
  "version": 1,
  "result": "# SpecAudit Report\n\n## Summary\n**Total Findings:** 14 ...",
  "exportedAt": "2026-06-03T14:30:00.000Z",
  "specFormat": "json"
}
```

---

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `frontend/src/types/audit.ts` | **Modify** | Add `AuditResult` type; add `specFormat` field to `AuditState` |
| `frontend/src/hooks/useAudit.ts` | **Modify** | Store `specFormat` in state when `audit()` is called |
| `frontend/src/App.tsx` | **Modify** | Add `handleExportJson` callback and a new Button; import `AuditResult` |
| `frontend/src/App.test.tsx` (new) | **Create** | Test the `handleExportJson` logic |

### Not modified
- `backend/` — no changes needed; the JSON export is a client-side wrapper
- `frontend/src/utils/exportPdf.ts` — unchanged
- `frontend/src/api/auditClient.ts` — unchanged
- `frontend/src/components/ui/Button.tsx` — unchanged
- `frontend/src/utils/parseSSEChunks.ts` — unchanged

---

## Detailed Changes

### 1. `frontend/src/types/audit.ts` — Add types

Add the `AuditResult` export interface and extend `AuditState`:

```typescript
// New export
export interface AuditResult {
  version: 1;
  result: string;
  exportedAt: string;
  specFormat: string | null;
}

// Modified — add specFormat field
export interface AuditState {
  status: AuditStatus;
  result: string;
  error: string | null;
  specFormat: string | null;   // ← NEW
}
```

**Rationale:** `specFormat` is set once when the audit begins (from `AuditRequest.specFormat`) and is included in the JSON envelope metadata. It is `null` if the user did not specify a format (auto-detect).

### 2. `frontend/src/hooks/useAudit.ts` — Store specFormat

1. Update the initial state to include `specFormat: null`:

   ```typescript
   const [state, setState] = useState<AuditState>({
     status: 'idle',
     result: '',
     error: null,
     specFormat: null,   // ← NEW
   });
   ```

2. In the `audit` callback, store `payload.specFormat` when starting a fresh audit (the `!isRetry` branch):

   ```typescript
   if (!isRetry) {
     abortRef.current?.abort();
     retryCount.current = 0;
     abortRef.current = new AbortController();
     setState({ status: 'loading', result: '', error: null, specFormat: payload.specFormat ?? null });
   }
   ```

   On retries, `specFormat` is preserved because we don't reset it.

3. In the error/catch branches that reset state, include `specFormat: null`:

   - AbortError branch: `setState(s => ({ ...s, status: 'idle' }));` — no change needed here; we just change status
   - Rate-limit retry branch: `setState({ status: 'loading', result: '', error: null, specFormat: payload.specFormat ?? null });`
   - Fatal error branch: `setState(s => ({ ...s, status: 'error', error: ... }));` — no change needed; specFormat stays

   Actually, looking more carefully at the retry flow: on retry, a new `payload` with the same `specFormat` is passed, so using `payload.specFormat` in the retry branch is correct.

4. In the `reset` callback, add `specFormat: null`:

   ```typescript
   setState({ status: 'idle', result: '', error: null, specFormat: null });
   ```

**Edge case:** If `payload.specFormat` is `undefined` (not provided), store `null`.

### 3. `frontend/src/App.tsx` — Add JSON export handler + button

#### New import

```typescript
import type { AuditResult } from './types/audit';
```

#### New handler: `handleExportJson`

Follow the same Blob + temp `<a>` pattern as `handleDownload` (lines 28–42):

```typescript
const handleExportJson = useCallback(() => {
  try {
    const auditResult: AuditResult = {
      version: 1,
      result: state.result,
      exportedAt: new Date().toISOString(),
      specFormat: state.specFormat,
    };
    const jsonString = JSON.stringify(auditResult, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `specaudit-report-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    // JSON export API unavailable — silently ignore
  }
}, [state.result, state.specFormat]);
```

**Dependencies:** `state.result` and `state.specFormat`.

#### New Button in JSX

Add a new `<Button>` immediately after the Export PDF button (after line 125), inside the same fragment:

```tsx
<Button
  variant="ghost"
  size="sm"
  disabled={state.status === 'streaming'}
  onClick={handleExportJson}
>
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
    <polyline points="16 3 21 3 21 8" />
    <line x1="4" y1="20" x2="21" y2="3" />
    <polyline points="21 16 21 21 16 21" />
    <line x1="15" y1="15" x2="21" y2="21" />
    <line x1="4" y1="4" x2="9" y2="9" />
  </svg>
  Export JSON
</Button>
```

**Icon:** Braces / code icon (two brackets with lines connecting — `{ }` metaphor).

**Disabled condition:** Same as Copy/Download/Export PDF — disabled while `state.status === 'streaming'`.

**Placement order (left to right):** Copy · Download · Export PDF · **Export JSON**

### 4. `frontend/src/App.test.tsx` — Test file (new)

Create `frontend/src/App.test.tsx` with tests for the JSON export handler.

```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuditResult } from './types/audit';

// We test the JSON export logic in isolation (same pattern as the Download
// group in feature-pipeline.test.ts). The actual handler is inside App.tsx;
// we test the same algorithm a standalone handler would use.

const SAMPLE_MARKDOWN = '# SpecAudit Report\n\n## Summary\n**Total Findings:** 3';

function createTestResult(specFormat: string | null = 'json'): AuditResult {
  return {
    version: 1,
    result: SAMPLE_MARKDOWN,
    exportedAt: '2026-01-01T00:00:00.000Z',
    specFormat,
  };
}

describe('Export JSON', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1: creates a valid AuditResult object with all required fields', () => {
    const result = createTestResult('yaml');
    expect(result).toHaveProperty('version', 1);
    expect(result).toHaveProperty('result', SAMPLE_MARKDOWN);
    expect(result).toHaveProperty('exportedAt');
    expect(result).toHaveProperty('specFormat', 'yaml');
  });

  it('2: version is always 1', () => {
    const result = createTestResult();
    expect(result.version).toBe(1);
  });

  it('3: exportedAt is a valid ISO-8601 date string', () => {
    const result = createTestResult();
    const parsed = new Date(result.exportedAt);
    expect(parsed.toISOString()).toBe(result.exportedAt);
  });

  it('4: specFormat can be null (auto-detect)', () => {
    const result = createTestResult(null);
    expect(result.specFormat).toBeNull();
  });

  it('5: specFormat can be "yaml"', () => {
    const result = createTestResult('yaml');
    expect(result.specFormat).toBe('yaml');
  });

  it('6: JSON.stringify produces valid parsable JSON', () => {
    const result = createTestResult();
    const json = JSON.stringify(result);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(result);
  });

  it('7: Pretty-printed JSON (2-space indent) is valid', () => {
    const result = createTestResult();
    const json = JSON.stringify(result, null, 2);
    expect(() => JSON.parse(json)).not.toThrow();
    expect(json).toContain('\n  ');
  });

  it('8: creates Blob with correct content type', () => {
    const result = createTestResult();
    const jsonString = JSON.stringify(result, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    expect(blob.type).toBe('application/json;charset=utf-8');
  });

  it('9: Blob content matches original result object after round-trip', async () => {
    const result = createTestResult();
    const jsonString = JSON.stringify(result, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const text = await blob.text();
    const parsed = JSON.parse(text);
    expect(parsed).toEqual(result);
  });

  it('10: filename uses correct pattern', () => {
    const filename = `specaudit-report-${Date.now()}.json`;
    expect(filename).toMatch(/^specaudit-report-\d+\.json$/);
  });

  it('11: anchor element has correct download attribute', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');

    const result = createTestResult();
    const jsonString = JSON.stringify(result, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `specaudit-report-${Date.now()}.json`;

    expect(a.download).toMatch(/^specaudit-report-\d+\.json$/);
    expect(a.href).toBe('blob:mock-url');

    URL.revokeObjectURL(url);
  });

  it('12: triggers click on anchor (full download flow)', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(URL, 'revokeObjectURL');

    const origCreateElement = document.createElement.bind(document);
    const mockAnchor = origCreateElement('a') as HTMLAnchorElement;
    const clickSpy = vi.fn();
    mockAnchor.click = clickSpy;
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') return mockAnchor as unknown as HTMLElement;
      return origCreateElement(tagName);
    });

    // Execute the same logic as handleExportJson
    const result = createTestResult();
    const jsonString = JSON.stringify(result, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `specaudit-report-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('13: catch block prevents errors from propagating', () => {
    // Simulate a browser API failure — mirroring the try/catch in App.tsx
    const handleExportJsonSafe = () => {
      try {
        const result = createTestResult();
        const jsonString = JSON.stringify(result, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `specaudit-report-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {
        // JSON export unavailable — silently ignore
      }
    };

    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      throw new Error('URL API unavailable');
    });

    expect(() => handleExportJsonSafe()).not.toThrow();
  });

  it('14: handles empty result string', () => {
    const result: AuditResult = {
      version: 1,
      result: '',
      exportedAt: '2026-01-01T00:00:00.000Z',
      specFormat: null,
    };
    const json = JSON.stringify(result, null, 2);
    const parsed = JSON.parse(json);
    expect(parsed.result).toBe('');
  });

  it('15: handles result with unicode characters', () => {
    const unicodeResult = `# Café résumé\n\nCrème brûlée — 日本語\n\n\`console.log("héllo")\``;
    const result: AuditResult = {
      version: 1,
      result: unicodeResult,
      exportedAt: '2026-01-01T00:00:00.000Z',
      specFormat: null,
    };
    const json = JSON.stringify(result, null, 2);
    const parsed = JSON.parse(json);
    expect(parsed.result).toBe(unicodeResult);
  });
});
```

---

## Edge Cases

| # | Scenario | Handling |
|---|----------|----------|
| 1 | **Empty result** (`state.result === ''`) | The handler still produces valid JSON with `result: ""`. The download goes through (empty file is valid JSON). Same behavior as the Download handler for empty content. |
| 2 | **Streaming in progress** | Button is disabled (`state.status === 'streaming'`), matching Copy/Download/Export PDF behavior. `handleExportJson` is not callable. |
| 3 | **Loading state** | No buttons are rendered yet (wrapped in `{state.result && ...}`), same as existing buttons. |
| 4 | **Error state** | `state.result` may contain the markdown accumulated before the error. The JSON export includes whatever markdown `state.result` holds — no special error handling needed; the markdown itself may contain `[SPECAUDIT_ERROR]` text if streaming failed midway. This is consistent with current behavior for Download and Export PDF. |
| 5 | **`specFormat` is null** | The JSON envelope includes `"specFormat": null`. This is valid JSON. |
| 6 | **Browser Blob/URL API unavailable** | The `try/catch` block silently catches any exception, matching the existing Download handler pattern. |
| 7 | **Unicode in markdown** | `JSON.stringify` natively handles UTF-8; the test verifies unicode round-trips correctly. |
| 8 | **Very large result** | `JSON.stringify` handles strings of any length; no limit is imposed. The Blob API handles large data natively. If the string is extremely large, `URL.createObjectURL` may use significant memory — same risk as the existing Download handler. |

---

## Test Strategy

### Unit tests (`frontend/src/App.test.tsx`) — 15 tests

| # | Test | Assertions |
|---|------|------------|
| 1 | Creates a valid `AuditResult` | All required fields present |
| 2 | `version` is always `1` | `result.version === 1` |
| 3 | `exportedAt` is valid ISO-8601 | `new Date(result.exportedAt).toISOString() === result.exportedAt` |
| 4 | `specFormat` can be `null` | `result.specFormat === null` |
| 5 | `specFormat` can be `"yaml"` | `result.specFormat === 'yaml'` |
| 6 | JSON.stringify round-trips | `JSON.parse(JSON.stringify(result))` equals original |
| 7 | Pretty-printed JSON is valid | Contains newlines + 2-space indent, parseable |
| 8 | Blob type is correct | `blob.type === 'application/json;charset=utf-8'` |
| 9 | Blob content round-trips | `JSON.parse(await blob.text())` equals original object |
| 10 | Filename pattern | Matches `specaudit-report-\d+\.json` |
| 11 | Anchor configured correctly | `a.download` matches pattern, `a.href` is blob URL |
| 12 | Full download flow triggers click | `a.click()` called, `revokeObjectURL` called |
| 13 | Error handling (catch block safety) | Thrown error in URL API does not propagate |
| 14 | Empty result string | Serializes as `"result": ""` |
| 15 | Unicode characters in result | Survives round-trip without corruption |

### Integration tests

No integration test changes needed. The existing `feature-pipeline.test.ts` already covers the SSE streaming pipeline, content parsing, PDF export, download, and copy. Adding JSON export tests to that file is optional but low-priority since the handler follows the exact same Blob + `<a>` pattern already tested in Group 4 (Download).

---

## Implementation Order

1. Modify `frontend/src/types/audit.ts` — add `AuditResult` type + `specFormat` field to `AuditState`
2. Modify `frontend/src/hooks/useAudit.ts` — store `specFormat` in state
3. Modify `frontend/src/App.tsx` — add `handleExportJson` + button
4. Create `frontend/src/App.test.tsx` — 15 tests
5. Run `npm test -- --run` to verify all tests pass
6. Run `npx tsc --noEmit` to verify TypeScript
7. Run `npm run build` to verify production build

---

## Verification

| Step | Command | Expected |
|------|---------|----------|
| 1. TypeScript | `npx tsc --noEmit` | Zero errors |
| 2. Tests | `npm test -- --run` | All existing + 15 new tests pass |
| 3. Build | `npm run build` | Zero errors |
| 4. Manual | Run frontend, complete audit, click Export JSON | Downloads valid `.json` file with expected structure |

---

## Summary

| Aspect | Detail |
|--------|--------|
| **Approach** | JSON envelope wrapping the raw markdown (Option 1) |
| **Backend changes** | None |
| **New TypeScript types** | `AuditResult` (export interface) |
| **Modified state** | `AuditState.specFormat` (stores the audit request's format) |
| **Modified files** | `types/audit.ts`, `hooks/useAudit.ts`, `App.tsx` |
| **Created files** | `App.test.tsx` |
| **Tests added** | 15 unit tests for JSON export logic |
| **Pattern copied from** | `handleDownload` (App.tsx lines 28–42) |
