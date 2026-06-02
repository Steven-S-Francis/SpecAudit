# Spec: Integration Tests with Real OpenAPI Fixture

## Overview

Add integration-style tests that exercise the **full frontend feature pipeline** using **real data** (both input spec and AI audit output) instead of hand-crafted mocks. This gives confidence that all features (audit streaming, display, copy, download, export PDF) work correctly with realistic content.

**Input fixture:** The `FraudLabs Pro Fraud Detection-swagger.json` file (OpenAPI 3.0.1 spec)
**Output fixture:** The AI's actual audit response for that spec (14 findings, 6 critical, 4 warning, 4 info — provided by the user)

---

## Files to Create / Modify

| File | Action | Purpose |
|---|---|---|
| `frontend/src/test-fixtures/fraudlabs-swagger.json` | **Create** | Copy of the swagger spec with clean name |
| `frontend/src/test-fixtures/fraudlabs-audit-result.md` | **Create** | The AI's actual audit output for this spec |
| `frontend/src/__tests__/integration/feature-pipeline.test.ts` | **Create** | Integration tests exercising the full feature chain |
| `.gitignore` | **Modify** | Remove `*swagger.json` pattern (we want the fixture tracked) |

### Not modified
- `frontend/src/utils/exportPdf.ts` — no changes needed
- `frontend/src/App.tsx` — no changes needed
- `frontend/src/api/auditClient.ts` — no changes needed
- `frontend/src/hooks/useAudit.ts` — no changes needed

---

## Fixtures

### 1. `frontend/src/test-fixtures/fraudlabs-swagger.json`

Copy of `FraudLabs Pro Fraud Detection-swagger.json`. The original file stays at the repo root (for direct user access), the fixture copy lives in `test-fixtures/` for clean imports.

### 2. `frontend/src/test-fixtures/fraudlabs-audit-result.md`

The exact markdown output provided by the user:

````markdown
# SpecAudit Report

## Summary
**Total Findings:** 14 | **Critical:** 6 | **Warnings:** 4 | **Info:** 4

**Spec Format:** OpenAPI 3.0.1
**Endpoints Analyzed:** 2
**Audit Verdict:** FAIL

---

## Findings

### [CRITICAL] Missing Security Scheme Definition
**Category:** Security
**Location:** Global
**Issue:** The OpenAPI specification does not define a security scheme, which is required to secure the API endpoints.
**Recommendation:** Add a security scheme definition to the OpenAPI specification, such as OAuth2 or API key-based authentication.

### [CRITICAL] API Keys Passed as Query Parameters
**Category:** Security
**Location:** /v1/order/feedback, /v1/order/screen
**Issue:** API keys are passed as query parameters, which is insecure and vulnerable to tampering.
**Recommendation:** Pass API keys as headers instead of query parameters.

... (full content as provided by user) ...
````

---

## Integration Test Design

### Test file: `frontend/src/__tests__/integration/feature-pipeline.test.ts`

**Environment:** `jsdom` (same as other tests)

**Architecture:** The test mocks `fetch` to return the real audit output as SSE chunks, then exercises the actual frontend code paths (no module-level mocking of features).

### Component under test

The full pipeline:
```
Swagger fixture (JSON)
  → auditStream reads it as mock SSE response
  → onChunk accumulates into result string
  → markdownToContent parses the real output
  → exportPdf builds docDefinition
  → Download creates Blob
  → Copy writes to clipboard
```

### Mock Strategy

Only `fetch` is mocked. All other modules (`auditClient`, `exportPdf`, `parseSSEChunks`, etc.) use their real implementations.

```ts
// Mock fetch only — everything else is real
vi.spyOn(globalThis, 'fetch').mockResolvedValue(createSSEMockResponse(fixtureChunks));

// For exportPdf, we mock pdfmake (same as existing tests)
vi.mock('pdfmake/build/pdfmake', () => { ... });
vi.mock('pdfmake/build/vfs_fonts', () => ({ default: {} }));
```

### SSE Mock Helper

```ts
function createSSEMockResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  // Each chunk is JSON-encoded and wrapped in `data: <json>\n`
  const encoded = chunks.map(c => encoder.encode(`data: ${JSON.stringify(c)}\n`));

  let i = 0;
  const reader: ReadableStreamDefaultReader<Uint8Array> = {
    read() {
      if (i < encoded.length) {
        return Promise.resolve({ done: false, value: encoded[i++] });
      }
      return Promise.resolve({ done: true, value: undefined as unknown as Uint8Array });
    },
    cancel() { /* noop */ },
    releaseLock() { /* noop */ },
    closed: Promise.resolve(undefined),
  } as ReadableStreamDefaultReader<Uint8Array>;

  return {
    ok: true,
    status: 200,
    body: { getReader: () => reader },
  } as unknown as Response;
}
```

### Test Cases

All tests use the **real audit result fixture** as input data. The swagger JSON fixture is imported for context but the primary data flow starts from the audit result.

#### Group 1: SSE Streaming Pipeline

| # | Test | Assertions |
|---|------|------------|
| 1 | `auditStream` accumulates all chunks into the correct final result | On complete, the accumulated string exactly matches the fixture content |
| 2 | `auditStream` calls `onChunk` for each SSE data line | `onChunk` called correct number of times |
| 3 | `auditStream` handles the full content without errors | Resolves successfully, no thrown errors |
| 4 | `auditStream` with `AbortSignal` cancels mid-stream | Creates abort controller, calls `abort()`, verifies rejection with `AbortError` |
| 5 | Source map smoke test: the fixture file is valid markdown | String starts with `# SpecAudit Report`, contains `[CRITICAL]`, `[WARNING]`, `[INFO]`, `Governance Score` |

#### Group 2: Content Structure Verification

| # | Test | Assertions |
|---|------|------------|
| 6 | `markdownToContent` parses the full realistic output | Returns an array of content nodes |
| 7 | All 14 findings produce content nodes | Count of severity blocks (tables with `noBorders`) equals 14 |
| 8 | 6 CRITICAL blocks with correct colors | Count of tables where badge text is "CRITICAL" = 6 |
| 9 | 4 WARNING blocks with correct colors | Count of tables where badge text is "WARNING" = 4 |
| 10 | 4 INFO blocks with correct colors | Count of tables where badge text is "INFO" = 4 |
| 11 | Summary heading is parsed as h2 | The "Summary" heading produces `{ text: 'Summary', fontSize: 14, bold: true }` |
| 12 | Findings heading is parsed as h1 | The "Findings" heading produces `{ text: 'Findings', fontSize: 18, bold: true }` |
| 13 | Governance Score heading is parsed as h1 | The "Governance Score" heading produces `{ text: 'Governance Score', fontSize: 18, bold: true }` |
| 14 | Horizontal rules preserved | Number of `---` lines in fixture matches count of `canvas` nodes |
| 15 | Inline bold preserved (e.g., **Total Findings:**) | At least one inline `bold: true` segment in the paragraph text |

#### Group 3: Export PDF

| # | Test | Assertions |
|---|------|------------|
| 16 | `exportPdf` creates docDefinition with correct structure | `pageSize: 'A4'`, `content` is array |
| 17 | Title block includes "SpecAudit Report" | First content element's stack has title text |
| 18 | All severity blocks are represented in the PDF content | The docDefinition content array contains the same number of table nodes as the fixture has severity blocks |
| 19 | `exportPdf` uses default filename format | `.download()` called with name matching `specaudit-report-\d+\.pdf` |
| 20 | `exportPdf` accepts custom filename | `.download()` called with custom name |

#### Group 4: Download (Markdown)

| # | Test | Assertions |
|---|------|------------|
| 21 | Download handler creates Blob with correct content | `Blob([result], { type: 'text/markdown;charset=utf-8' })` where result equals fixture text |
| 22 | Anchor element configured correctly | `a.download` matches `specaudit-report-<timestamp>.md` |
| 23 | Download triggers click on anchor | `a.click()` is called |

#### Group 5: Copy

| # | Test | Assertions |
|---|------|------------|
| 24 | Copy handler writes full fixture content to clipboard | `navigator.clipboard.writeText` called with content matching fixture exactly |
| 25 | Copy with partial content (single finding excerpt) | Copy handler works with any substring of the fixture |

#### Group 6: Spec Format Detection

| # | Test | Assertions |
|---|------|------------|
| 26 | Swagger fixture is valid parseable JSON | `JSON.parse(fixture)` does not throw |
| 27 | Fixture has expected OpenAPI structure | `parsed.openapi === '3.0.1'`, `parsed.info.title` contains "FraudLabs" |

---

## `.gitignore` Fix

Remove the `*swagger.json` line from `.gitignore` so the fixture files are tracked in version control.

---

## File Size Considerations

- `fraudlabs-swagger.json`: ~12KB (404 lines)
- `fraudlabs-audit-result.md`: ~6KB (the AI output)
- `feature-pipeline.test.ts`: ~250 lines of test code

These are small files, no performance concerns.

---

## Edge Cases

| # | Scenario | Handling |
|---|----------|----------|
| 1 | Empty fixture (file exists but is empty) | Test imports the file directly — if empty, the test fails on the first assertion |
| 2 | Fixture has unexpected formatting (AI output changes) | The test asserts structural properties (counts of severity blocks, headings) not exact text string — making it resilient to minor AI output variation |
| 3 | SSE chunk boundary splits a line | The `parseSSEChunks` function handles partial lines via `remainingBuffer` — the mock splits content at complete `data: ...\n` boundaries, which matches how the real backend sends them |
| 4 | `fetch` mock leak between tests | Use `beforeEach` to clear and restore the mock via `vi.restoreAllMocks()` |

---

## Files NOT Modified

- `frontend/src/App.tsx` — unchanged (the integration test exercises the same handler functions App.tsx would call)
- `frontend/src/hooks/useAudit.ts` — unchanged (the integration test calls `auditStream` directly with the same pattern)
- Any other production code file

---

## Verification

| Step | Command | Expected |
|---|---|---|
| 1. Fix gitignore | Remove `*swagger.json`, verify with `git check-ignore` | File not ignored |
| 2. Re-add fixture to git | `git add frontend/src/test-fixtures/` | Tracked |
| 3. TypeScript | `npx tsc --noEmit` | Zero errors |
| 4. Tests | `npm test -- --run` | All tests pass (existing + new integration tests) |
| 5. Build | `npm run build` in `frontend/` | Zero errors |

---

## Summary

| Aspect | Detail |
|---|---|
| **Goal** | Integration tests with real OpenAPI spec + real AI audit output |
| **New files** | 2 fixtures + 1 test file |
| **Modified files** | `.gitignore` |
| **Tests added** | 27 integration tests covering SSE streaming, content parsing, export PDF, download, copy |
| **Mock footprint** | Only `fetch` is mocked — all feature code runs with real implementations |
| **CI-safe** | ✅ Yes (no API key, no backend, no network — fixture data is in-repo) |
