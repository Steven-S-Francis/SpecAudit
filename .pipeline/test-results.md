# Test Results

## Summary
PASS

## Frontend Tests
- Count: 199 tests in 15 files
- Status: ✅ Pass
- Failures: None

## Backend Tests
- Count: 18 tests in 4 test classes
- Status: ✅ Pass
- Failures: None

## TypeScript
- Status: ✅ Zero errors
- Errors: None

## Backend Build
- Status: ✅ Build succeeded (0 warnings, 0 errors)
- Output: `backend -> D:\Work\Personal\SpecAudit\backend\bin\Debug\net10.0\backend.dll`

## Notes
- Only **Group 1** changes (A, G, H — critical bugs) have been applied per `.pipeline/changes.md`.
- Groups 2, 3, and 4 have **not** been applied yet. The following existing tests reflect pre-Group-3 behavior:
  - `ExtractStructuredJson_WithTextAfterJsonBlock_ReturnsNull` passes because `SpecAuditService.cs` still uses the regex-based `ExtractStructuredJson` (Group 3/D not yet applied).
  - No rate-limit test exists yet because Group 4/I is not yet applied.
  - No `status === 'loading'` button disable test exists yet because Group 2/B is not yet applied.
- These are **expected** given the scope of applied changes and do not represent regressions.

## New Tests Written
None — the task was to run the full test suite and report results, not to write new tests. All 217 tests (199 frontend + 18 backend) pass.
