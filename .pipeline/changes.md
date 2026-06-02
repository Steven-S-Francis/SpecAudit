# Changes Summary

## Files Modified

### `backend/src/Models/Responses/AuditResponse.cs`
- Replaced the single `AuditResponse` record with new structured types: `StructuredFinding`, `StructuredDimensions`, `StructuredSummary`, `StructuredData` — all as C# `sealed record` types in the `SpecAudit.Models.Responses` namespace.
- **Purpose**: Define the backend model for the structured JSON data extracted from AI responses.

### `backend/src/Services/SpecAuditService.cs`
- Added `System.Text`, `System.Text.Json`, `System.Text.RegularExpressions` using directives.
- Added `[SPECAUDIT_STRUCTURED]` sentinel constant (`StructuredSentinel`).
- Added `internal static ExtractStructuredJson(string markdown)` method that uses a `GeneratedRegex` to extract the last ` ```json...``` ` block, validates JSON via `JsonDocument.Parse()`, and returns the JSON string or `null`.
- Updated `AuditAsync()` to accumulate chunk text in a `StringBuilder` during streaming, then after the loop extract structured JSON and yield the sentinel.
- Changed class from `SpecAuditService` to `partial class` (for `GeneratedRegex`).
- Appended JSON schema instruction to the `SystemPrompt` constant (after the Governance Score section).
- **Purpose**: Backend extracts and validates structured JSON from the AI response and sends it as a final sentinel SSE event.

### `frontend/src/types/audit.ts`
- Added `SeverityLevel` type alias (`'CRITICAL' | 'WARNING' | 'INFO'`).
- Added `Finding`, `AuditDimensions`, `AuditSummary` interfaces.
- Added `findings: Finding[]` and `summary: AuditSummary | null` to `AuditState`.
- Changed `AuditResult.result` from required to optional (`result?: string`).
- Added `findings: Finding[]` and `summary: AuditSummary | null` to `AuditResult`.
- **Purpose**: Frontend types now model the structured audit data.

### `frontend/src/api/auditClient.ts`
- Added optional `onStructured` callback parameter to `auditStream()`.
- Added `[SPECAUDIT_STRUCTURED]` sentinel handling in the data processing loop: parses JSON and calls `onStructured`, with try/catch for invalid JSON.
- Skips structured chunks from `onChunk` (uses `continue`).
- **Purpose**: Frontend SSE client can receive and dispatch structured data.

### `frontend/src/hooks/useAudit.ts`
- Added `findings: []` and `summary: null` to initial state and all `setState` calls (including `loading`, `reset`, and retry paths).
- Passes `onStructured` callback to `auditStream()` that updates `findings` and `summary` in state.
- **Purpose**: Hook manages structured data state alongside markdown result.

### `frontend/src/App.tsx`
- Updated `handleExportJson` to build `AuditResult` with `findings` and `summary` fields.
- When both `findings` is empty and `summary` is null (no structured data), includes `result` field as fallback.
- Updated dependency array to include `state.findings` and `state.summary`.
- **Purpose**: JSON export now exports structured data when available, falling back to raw markdown.

### `frontend/src/hooks/__tests__/useAudit.test.tsx`
- Added `findings: []` and `summary: null` to state assertions in "returns initial state with idle status" and "reset clears result and sets idle" tests.
- Added new test: "onStructured callback updates findings and summary in state".
- **Purpose**: Tests pass with new state shape; structured data flow is tested.

### `frontend/src/components/features/__tests__/App.test.tsx`
- Updated `createTestResult()` helper to include `findings: []` and `summary: null`.
- Updated all mock state objects (22 occurrences) to include `findings: []` and `summary: null`.
- Updated test 4 assertions to check `parsed.findings` and `parsed.summary`.
- Updated tests 15 and 16 to include `findings`/`summary` in `AuditResult` construction.
- Updated trailing newline test assertion to verify `findings`/`summary`.
- Added two new tests: "JSON export includes findings and summary when structured data available" and "JSON export includes result field when no structured data (fallback)".
- **Purpose**: Tests validate the new JSON export behavior with structured data.

### `frontend/src/api/__tests__/auditClient.test.ts`
- Added new `describe('structured event handling')` block with 4 tests:
  - "calls onStructured when chunk contains [SPECAUDIT_STRUCTURED] prefix"
  - "does not pass structured chunk to onChunk"
  - "ignores invalid JSON in structured sentinel"
  - "does not call onStructured when callback not provided"
- **Purpose**: Tests verify structured sentinel handling in the SSE client.

### `frontend/src/__tests__/integration/feature-pipeline.test.ts`
- Added new test (numbered 6 in Group 1): "SSE stream with structured sentinel at end extracts findings".
- **Purpose**: Integration test verifies end-to-end structured data flow through auditStream.

## File Added

### `backend.Tests/ExtractStructuredJsonTests.cs`
- 7 xUnit/FluentAssertions tests for `ExtractStructuredJson`:
  - `WithValidJsonBlock_ReturnsJsonString` — basic valid extraction
  - `WithNoJsonBlock_ReturnsNull` — plain markdown returns null
  - `WithInvalidJson_ReturnsNull` — invalid JSON returns null
  - `WithMultipleJsonBlocks_ExtractsOnlyLast` — only last block extracted
  - `WithEmptyCodeBlock_ReturnsNull` — empty code block returns null
  - `WithWhitespaceOnlyBlock_ReturnsNull` — whitespace-only returns null
  - `WithTextAfterJsonBlock_ReturnsNull` — text after block returns null
- **Purpose**: Backend unit tests for the extraction logic.

## Files NOT Modified (as required)
- `backend/src/Endpoints/AuditEndpoints.cs` — unchanged
- `frontend/src/components/features/ResultPanel.tsx` — unchanged
- `frontend/src/utils/exportPdf.ts` — unchanged
- `frontend/src/utils/parseSSEChunks.ts` — unchanged

## Verification Results

| Step | Result |
|------|--------|
| `npx tsc --noEmit` (frontend) | ✅ Zero TypeScript errors |
| `dotnet build` (backend) | ✅ Build succeeded, 0 warnings, 0 errors |
| `dotnet build` (backend.Tests) | ✅ Build succeeded, 0 warnings, 0 errors |
| `npm test -- --run` (frontend) | ✅ 177 tests passed (14 files) |
| `dotnet test` (backend.Tests) | ✅ 18 tests passed (including 7 new) |
